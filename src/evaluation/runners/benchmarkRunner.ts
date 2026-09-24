/**
 * ExynoX Code Intelligence — Benchmark Runner
 * Samsung PRISM Gen AI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 *
 * Requirements:
 *   1. Measures real, un-fabricated IR metrics: Precision@1, 3, 5, 10 and Recall@1, 3, 5, 10.
 *   2. High-resolution latency timing (performance.now).
 *   3. Outlier preservation (min, max, median, mean, p90).
 *   4. Structural AST accuracy breakdown.
 *   5. Grounding evaluation (citations verified physically against files in workspace).
 *   6. Repeatable runs (warm vs cold).
 *   7. Does NOT alter or slow down normal user queries.
 */

import type { 
  BenchmarkRunOptions, 
  BenchmarkReport, 
  BenchmarkSummary, 
  QueryEvaluationResult,
  PrecisionRecallMetrics,
  TokenUsageRecord
} from '../types.js';
import { RepositoryWorkspace } from '../../services/repository/repositoryWorkspace.js';
import { agentService } from '../../services/agent/index.js';
import { matchRetrievedEvidence } from '../metrics/relevanceMatcher.js';
import { calculatePrecisionRecallAtK, NOT_EVALUATED_MESSAGE } from '../metrics/retrievalMetrics.js';
import { HighResolutionTimer, calculateLatencyAggregate } from '../metrics/latencyMetrics.js';
import { extractIndexingMetrics } from '../metrics/indexingMetrics.js';
import { evaluateStructuralAccuracy } from '../metrics/structuralMetrics.js';
import { evaluateEvidenceGrounding } from '../metrics/groundingMetrics.js';
import { generateMarkdownReport } from '../reports/reportGenerator.js';

export async function runBenchmark(options: BenchmarkRunOptions): Promise<BenchmarkReport> {
  const {
    dataset,
    workspace,
    mode = 'deterministic',
    kValues = [1, 3, 5, 10],
    iterations = 1,
    onProgress
  } = options;

  const repoWorkspace = workspace as RepositoryWorkspace;
  const benchmarkId = `bench_${Date.now()}`;
  const timestamp = Date.now();
  const repoName = repoWorkspace?.repositoryName || 'unknown_repository';

  // 1. Ingestion / Indexing resource proxies
  const indexingMetrics = repoWorkspace ? extractIndexingMetrics(repoWorkspace, 0) : null;

  const runsData: { runIndex: number; durationsMs: number[] }[] = [];
  let finalQueryResults: QueryEvaluationResult[] = [];

  // 2. Execute benchmark across requested iterations (supports repeatable runs: run 1, run 2, etc.)
  for (let r = 0; r < iterations; r++) {
    const runDurations: number[] = [];
    const currentRunResults: QueryEvaluationResult[] = [];

    for (let qIdx = 0; qIdx < dataset.queries.length; qIdx++) {
      const qItem = dataset.queries[qIdx];
      if (onProgress) {
        onProgress({
          currentQuery: qIdx + 1,
          totalQueries: dataset.queries.length,
          queryText: qItem.query
        });
      }

      const timer = new HighResolutionTimer().start();

      // Execute query through agentService with mode control
      const searchResult = await agentService.executePlan({
        id: `eval_${qItem.id}_${Date.now()}`,
        query: qItem.query,
        timestamp: Date.now(),
        targetRepositoryId: repoName
      }, {
        forceDeterministic: mode === 'deterministic'
      });

      const latency = timer.stop({
        retrievalMs: searchResult.executionTimeMs,
        structuralMs: searchResult.searchType === 'structural_ast' ? searchResult.executionTimeMs : undefined,
        agenticInvestigationMs: mode === 'agentic' ? searchResult.executionTimeMs : undefined
      });

      runDurations.push(latency.durationMs);

      // Only build detailed evaluation structures on the first (or last) run
      if (r === 0) {
        const hasGroundTruth = Boolean(
          (qItem.expectedEvidence && qItem.expectedEvidence.length > 0) ||
          (qItem.expectedSymbols && qItem.expectedSymbols.length > 0) ||
          (qItem.expectedCount !== undefined)
        );

        // Process retrieved candidates
        const rawFindings = searchResult.findings || [];
        const retrievedItems = rawFindings.map((f, idx) => {
          const filePath = f.location?.filePath || f.codeSnippet?.location?.filePath || '';
          const startLine = f.location?.startLine ?? f.codeSnippet?.location?.startLine ?? 1;
          const endLine = f.location?.endLine ?? f.codeSnippet?.location?.endLine ?? startLine;
          const symbolName = f.matchedSymbol?.name || f.location?.functionName;

          const match = matchRetrievedEvidence(
            { filePath, startLine, endLine, symbolName },
            qItem.expectedEvidence,
            qItem.expectedSymbols
          );

          return {
            rank: idx + 1,
            filePath,
            startLine,
            endLine,
            symbolName,
            snippet: f.codeSnippet?.content?.slice(0, 300),
            relevanceMatch: match
          };
        });

        // Compute Precision@K and Recall@K
        const kMetrics: Record<number, PrecisionRecallMetrics> = {};
        for (const k of kValues) {
          kMetrics[k] = calculatePrecisionRecallAtK(
            retrievedItems,
            k,
            qItem.expectedEvidence,
            qItem.expectedSymbols
          );
        }

        // Structural accuracy evaluation
        const structuralAcc = evaluateStructuralAccuracy(
          qItem,
          searchResult.structuralResult,
          retrievedItems.length
        );

        // Grounding evaluation
        const grounding = evaluateEvidenceGrounding(
          retrievedItems.map(item => ({
            filePath: item.filePath,
            startLine: item.startLine,
            endLine: item.endLine,
            content: item.snippet
          })),
          repoWorkspace,
          qItem.expectedEvidence
        );

        // Token usage evaluation: Never estimate; return unavailable if not exposed
        const tokens: TokenUsageRecord = {
          available: false,
          formatted: "Token usage unavailable"
        };

        currentRunResults.push({
          queryId: qItem.id,
          query: qItem.query,
          queryType: qItem.queryType,
          hasGroundTruth,
          groundTruthReason: hasGroundTruth ? undefined : 'No expected evidence or symbols defined in dataset',
          kMetrics,
          retrievedItems,
          latency,
          grounding,
          structuralAccuracy: structuralAcc,
          tokens
        });
      }
    }

    runsData.push({ runIndex: r + 1, durationsMs: runDurations });
    if (r === 0) {
      finalQueryResults = currentRunResults;
    }
  }

  // 3. Aggregate metrics across all queries
  const allDurations = runsData.flatMap(rd => rd.durationsMs);
  const latencyAggregate = calculateLatencyAggregate(allDurations);

  // Mean Precision@K and Recall@K over queries that actually have ground truth
  const queriesWithGT = finalQueryResults.filter(q => q.hasGroundTruth);
  const precisionAtK: Record<number, number | null> = {};
  const precisionAtKFormatted: Record<number, string> = {};
  const recallAtK: Record<number, number | null> = {};
  const recallAtKFormatted: Record<number, string> = {};

  for (const k of kValues) {
    if (queriesWithGT.length === 0) {
      precisionAtK[k] = null;
      precisionAtKFormatted[k] = NOT_EVALUATED_MESSAGE;
      recallAtK[k] = null;
      recallAtKFormatted[k] = NOT_EVALUATED_MESSAGE;
    } else {
      let precSum = 0;
      let precCount = 0;
      let recSum = 0;
      let recCount = 0;

      for (const q of queriesWithGT) {
        const km = q.kMetrics[k];
        if (km && km.precision !== null) {
          precSum += km.precision;
          precCount++;
        }
        if (km && km.recall !== null) {
          recSum += km.recall;
          recCount++;
        }
      }

      if (precCount > 0) {
        const meanPrec = precSum / precCount;
        precisionAtK[k] = Number(meanPrec.toFixed(4));
        precisionAtKFormatted[k] = `${(meanPrec * 100).toFixed(1)}%`;
      } else {
        precisionAtK[k] = null;
        precisionAtKFormatted[k] = NOT_EVALUATED_MESSAGE;
      }

      if (recCount > 0) {
        const meanRec = recSum / recCount;
        recallAtK[k] = Number(meanRec.toFixed(4));
        recallAtKFormatted[k] = `${(meanRec * 100).toFixed(1)}%`;
      } else {
        recallAtK[k] = null;
        recallAtKFormatted[k] = NOT_EVALUATED_MESSAGE;
      }
    }
  }

  // Aggregate structural query accuracy
  const structuralQueries = finalQueryResults.filter(q => q.structuralAccuracy?.evaluated);
  const categoryAcc: Record<string, { total: number; correct: number; accuracy: number }> = {};
  let totalStructuralScore = 0;

  for (const sq of structuralQueries) {
    const cat = sq.structuralAccuracy!.category;
    if (!categoryAcc[cat]) {
      categoryAcc[cat] = { total: 0, correct: 0, accuracy: 0 };
    }
    categoryAcc[cat].total++;
    if (sq.structuralAccuracy!.exactMatch) {
      categoryAcc[cat].correct++;
    } else if (sq.structuralAccuracy!.partialMatch) {
      categoryAcc[cat].correct += 0.5;
    }
    totalStructuralScore += sq.structuralAccuracy!.score;
  }

  for (const cat of Object.keys(categoryAcc)) {
    categoryAcc[cat].accuracy = categoryAcc[cat].total > 0
      ? Number((categoryAcc[cat].correct / categoryAcc[cat].total).toFixed(4))
      : 0;
  }

  const overallStructuralAccuracy = structuralQueries.length > 0
    ? Number((totalStructuralScore / structuralQueries.length).toFixed(4))
    : null;

  // Aggregate grounding
  let groundedCount = 0;
  let totalFabricatedEvidence = 0;
  let totalUnsupportedClaims = 0;

  for (const q of finalQueryResults) {
    if (q.grounding.isGrounded) groundedCount++;
    totalFabricatedEvidence += q.grounding.fabricatedEvidence.length;
    totalUnsupportedClaims += q.grounding.unsupportedClaims.length;
  }

  const groundingRate = finalQueryResults.length > 0 ? groundedCount / finalQueryResults.length : 0;

  const summary: BenchmarkSummary = {
    benchmarkId,
    timestamp,
    repositoryIdentifier: repoName,
    datasetIdentifier: dataset.name || dataset.id,
    mode,
    runsCount: iterations,
    totalQueries: dataset.queries.length,
    queriesWithGroundTruth: queriesWithGT.length,
    precisionAtK,
    precisionAtKFormatted,
    recallAtK,
    recallAtKFormatted,
    latency: latencyAggregate,
    indexing: indexingMetrics,
    structuralAccuracy: {
      overallAccuracy: overallStructuralAccuracy,
      evaluatedCount: structuralQueries.length,
      byCategory: categoryAcc
    },
    grounding: {
      totalEvaluated: finalQueryResults.length,
      groundedCount,
      groundingRate,
      groundingRateFormatted: `${(groundingRate * 100).toFixed(1)}%`,
      totalFabricatedEvidence,
      totalUnsupportedClaims
    },
    tokenCost: {
      isAvailable: false,
      summaryFormatted: "Token usage unavailable",
      pricingConfigured: false,
      monetaryCostFormatted: "Not calculated — pricing configuration required"
    }
  };

  const markdownOutput = generateMarkdownReport(summary, finalQueryResults);
  const jsonOutput = JSON.stringify({ summary, queries: finalQueryResults, runs: runsData }, null, 2);

  return {
    summary,
    queryResults: finalQueryResults,
    runs: runsData,
    generatedAt: new Date(timestamp).toISOString(),
    appVersion: "1.0.0-phase6",
    jsonOutput,
    markdownOutput
  };
}
