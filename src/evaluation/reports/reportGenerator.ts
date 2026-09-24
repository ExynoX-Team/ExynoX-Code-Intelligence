/**
 * ExynoX Code Intelligence — Evaluation Report Generator
 * Samsung PRISM Gen AI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 *
 * Generates:
 *   1. Machine-readable JSON report
 *   2. Human-readable Markdown report suitable for repo documentation (evaluation/results/report.md)
 */

import type { BenchmarkSummary, QueryEvaluationResult } from '../types.js';

export function generateMarkdownReport(
  summary: BenchmarkSummary,
  queryResults: QueryEvaluationResult[]
): string {
  const dateStr = new Date(summary.timestamp).toISOString();

  let md = `# ExynoX Code Intelligence — Evaluation & Benchmark Report
**Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)**

- **Generated At:** ${dateStr}
- **Benchmark ID:** \`${summary.benchmarkId}\`
- **Repository:** \`${summary.repositoryIdentifier}\`
- **Dataset:** \`${summary.datasetIdentifier}\`
- **Execution Mode:** \`${summary.mode.toUpperCase()}\`
- **Runs / Repetitions:** ${summary.runsCount}
- **Total Benchmark Queries:** ${summary.totalQueries} (with explicit ground truth: ${summary.queriesWithGroundTruth})

---

## 1. Executive Summary & Retrieval Metrics

| Metric | Measured Value | Standard IR Formula / Status |
| :--- | :--- | :--- |
| **Precision@1** | ${summary.precisionAtKFormatted[1] || 'N/A'} | $|Rel \\cap Ret@1| / 1$ |
| **Precision@3** | ${summary.precisionAtKFormatted[3] || 'N/A'} | $|Rel \\cap Ret@3| / 3$ |
| **Precision@5** | ${summary.precisionAtKFormatted[5] || 'N/A'} | $|Rel \\cap Ret@5| / 5$ |
| **Precision@10** | ${summary.precisionAtKFormatted[10] || 'N/A'} | $|Rel \\cap Ret@10| / 10$ |
| **Recall@1** | ${summary.recallAtKFormatted[1] || 'N/A'} | $|Rel \\cap Ret@1| / |Expected|$ |
| **Recall@3** | ${summary.recallAtKFormatted[3] || 'N/A'} | $|Rel \\cap Ret@3| / |Expected|$ |
| **Recall@5** | ${summary.recallAtKFormatted[5] || 'N/A'} | $|Rel \\cap Ret@5| / |Expected|$ |
| **Recall@10** | ${summary.recallAtKFormatted[10] || 'N/A'} | $|Rel \\cap Ret@10| / |Expected|$ |
| **Grounding Rate** | ${summary.grounding.groundingRateFormatted} | Physically verified file/line citations |
| **Median Query Latency** | ${summary.latency.medianMs} ms | High-resolution timer (performance.now) |
| **Mean Query Latency** | ${summary.latency.meanMs} ms | Outliers preserved (min: ${summary.latency.minMs}ms, max: ${summary.latency.maxMs}ms) |
| **90th Percentile Latency** | ${summary.latency.p90Ms} ms | P90 response latency |

*Note: If ground truth is unavailable for any query, it is strictly marked "Not evaluated — ground truth unavailable". No synthetic or arbitrary scores are substituted.*

---

## 2. Indexing Cost & Resource Metrics

*Proxy metrics reflecting reproducible compute and storage footprint without monetary speculation.*

`;

  if (summary.indexing) {
    const idx = summary.indexing;
    md += `| Resource Dimension | Measured Metric |
| :--- | :--- |
| **Total Files Ingested** | ${idx.totalFiles} (${idx.sourceFiles} source code files) |
| **Total Source Lines** | ${idx.totalLines.toLocaleString()} lines |
| **Total Characters / Bytes** | ${idx.totalCharacters.toLocaleString()} bytes |
| **Code Chunks Generated** | ${idx.totalChunks} chunks |
| **AST Nodes Extracted** | ${idx.totalAstNodes.toLocaleString()} nodes |
| **Total Symbols** | ${idx.totalSymbols} (Functions: ${idx.totalFunctions}, Classes: ${idx.totalClasses}, Methods: ${idx.totalMethods}) |
| **Static Call Graph Edges** | ${idx.totalCallRelationships} calls |
| **Module Import Edges** | ${idx.totalImportRelationships} imports |
| **Semantic Vectors Generated** | ${idx.semanticVectorsGenerated} vectors |
| **Estimated Index Memory** | ${idx.approximateIndexMemoryFormatted} |
| **Indexing Duration** | ${idx.indexingDurationMs} ms |
`;
  } else {
    md += `*Indexing metrics not recorded for this run.*\n`;
  }

  md += `
---

## 3. Structural AST Query Accuracy

`;

  if (summary.structuralAccuracy.overallAccuracy !== null) {
    md += `- **Overall Structural Accuracy:** ${(summary.structuralAccuracy.overallAccuracy * 100).toFixed(1)}% (${summary.structuralAccuracy.evaluatedCount} queries evaluated)\n\n`;
    md += `| Category | Total Queries | Verified Correct | Category Accuracy |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    for (const [cat, data] of Object.entries(summary.structuralAccuracy.byCategory)) {
      md += `| **${cat}** | ${data.total} | ${data.correct} | ${(data.accuracy * 100).toFixed(1)}% |\n`;
    }
  } else {
    md += `*No structural AST queries evaluated in this dataset run.*\n`;
  }

  md += `
---

## 4. Evidence Grounding & Verification

- **Total Answers Evaluated:** ${summary.grounding.totalEvaluated}
- **Fully Grounded Answers:** ${summary.grounding.groundedCount} (${summary.grounding.groundingRateFormatted})
- **Fabricated Citations Detected:** ${summary.grounding.totalFabricatedEvidence}
- **Unsupported Claims:** ${summary.grounding.totalUnsupportedClaims}

---

## 5. Token & LLM Cost

- **Token Usage Status:** ${summary.tokenCost.summaryFormatted}
- **Monetary Cost:** ${summary.tokenCost.monetaryCostFormatted || 'Not calculated — pricing configuration required'}

---

## 6. Detailed Query Breakdown (${queryResults.length} Queries)

`;

  for (const q of queryResults) {
    md += `### Query \`${q.queryId}\`: "${q.query}"
- **Query Type:** \`${q.queryType}\`
- **Execution Time:** ${q.latency.durationMs} ms
- **Ground Truth Present:** ${q.hasGroundTruth ? 'Yes' : 'No (' + (q.groundTruthReason || 'None') + ')'}
- **Precision@5:** ${q.kMetrics[5]?.precisionFormatted || 'N/A'} | **Recall@5:** ${q.kMetrics[5]?.recallFormatted || 'N/A'}
- **Grounded in Workspace:** ${q.grounding.isGrounded ? '✅ Confirmed' : '❌ Citation issue'}
`;

    if (q.structuralAccuracy && q.structuralAccuracy.evaluated) {
      md += `- **Structural AST Status:** ${q.structuralAccuracy.exactMatch ? 'Exact Match' : (q.structuralAccuracy.partialMatch ? 'Partial Match' : 'Missed')} (${q.structuralAccuracy.notes || ''})\n`;
    }

    if (q.retrievedItems.length > 0) {
      md += `\n**Top Retrieved Evidence:**\n`;
      for (const item of q.retrievedItems.slice(0, 5)) {
        const relIcon = item.relevanceMatch.isRelevant ? '🎯 Relevant' : '⚪ Unmatched';
        md += `  - **Rank ${item.rank}** [${relIcon}]: \`${item.filePath}:${item.startLine}–${item.endLine}\` (${item.relevanceMatch.explanation})\n`;
      }
    } else {
      md += `\n*No evidence items returned for this query.*\n`;
    }
    md += `\n`;
  }

  md += `\n*Report compiled by ExynoX Code Intelligence Evaluation Runner.*\n`;
  return md;
}
