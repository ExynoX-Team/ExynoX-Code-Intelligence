/**
 * ExynoX Code Intelligence — Retrieval Metrics (Precision@K and Recall@K)
 * Samsung PRISM Gen AI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 *
 * Mathematical Definitions:
 *   Precision@K = (relevant retrieved results in top K) / K
 *   Recall@K    = (distinct expected ground-truth items covered by top K) / (total expected ground-truth items)
 *
 * Negative Constraints:
 * - Never treat "Retrieval relevance: XX%" UI score as Precision@K.
 * - Never treat AI confidence as Precision.
 * - If ground truth is missing, explicitly return:
 *   "Not evaluated — ground truth unavailable"
 * - Never fabricate metrics.
 */

import type { 
  BenchmarkEvidenceRange, 
  PrecisionRecallMetrics, 
  RelevanceMatchResult 
} from '../types.js';
import { matchRetrievedEvidence } from './relevanceMatcher.js';

export const NOT_EVALUATED_MESSAGE = 'Not evaluated — ground truth unavailable';

export interface RetrievedCandidate {
  filePath: string;
  startLine: number;
  endLine: number;
  symbolName?: string;
  relevanceMatch?: RelevanceMatchResult;
}

/**
 * Computes Precision@K and Recall@K for a specific K value.
 */
export function calculatePrecisionRecallAtK(
  retrievedItems: RetrievedCandidate[],
  k: number,
  expectedEvidence?: BenchmarkEvidenceRange[],
  expectedSymbols?: string[]
): PrecisionRecallMetrics {
  const hasExpectedEvidence = Boolean(expectedEvidence && expectedEvidence.length > 0);
  const hasExpectedSymbols = Boolean(expectedSymbols && expectedSymbols.length > 0);
  const hasGroundTruth = hasExpectedEvidence || hasExpectedSymbols;

  if (!hasGroundTruth || k <= 0) {
    return {
      k,
      precision: null,
      recall: null,
      precisionFormatted: NOT_EVALUATED_MESSAGE,
      recallFormatted: NOT_EVALUATED_MESSAGE,
      relevantRetrievedCount: 0,
      totalExpectedCount: 0,
      totalRetrievedCount: Math.min(retrievedItems.length, k)
    };
  }

  const topKItems = retrievedItems.slice(0, k);
  const totalExpectedCount = (expectedEvidence?.length || 0) + (expectedSymbols?.length || 0);

  // Track matched ground truth items to compute true Recall without double-counting
  const coveredExpectedEvidenceIndices = new Set<number>();
  const coveredExpectedSymbolIndices = new Set<number>();
  let relevantRetrievedCount = 0;

  for (const item of topKItems) {
    const match = item.relevanceMatch || matchRetrievedEvidence(item, expectedEvidence, expectedSymbols);
    if (match.isRelevant) {
      relevantRetrievedCount++;

      // Track which ground-truth evidence range was matched
      if (match.matchedExpectedEvidence && expectedEvidence) {
        const idx = expectedEvidence.findIndex(e => 
          e.file === match.matchedExpectedEvidence?.file && 
          e.startLine === match.matchedExpectedEvidence?.startLine &&
          e.endLine === match.matchedExpectedEvidence?.endLine
        );
        if (idx >= 0) coveredExpectedEvidenceIndices.add(idx);
      }

      // Track which ground-truth symbol was matched
      if (match.matchedSymbol && expectedSymbols) {
        const symIdx = expectedSymbols.findIndex(s => s.toLowerCase() === match.matchedSymbol?.toLowerCase());
        if (symIdx >= 0) coveredExpectedSymbolIndices.add(symIdx);
      }
    }
  }

  // Precision@K = relevant retrieved results / K
  const precision = relevantRetrievedCount / k;
  
  // Recall@K = distinct expected items found / total expected ground truth
  const distinctFound = coveredExpectedEvidenceIndices.size + coveredExpectedSymbolIndices.size;
  // If distinct tracking captured matches, use it; otherwise fallback to min(relevantCount, totalExpected)
  const effectiveCovered = distinctFound > 0 ? distinctFound : Math.min(relevantRetrievedCount, totalExpectedCount);
  const recall = totalExpectedCount > 0 ? Math.min(1.0, effectiveCovered / totalExpectedCount) : null;

  return {
    k,
    precision,
    recall,
    precisionFormatted: `${(precision * 100).toFixed(1)}%`,
    recallFormatted: recall !== null ? `${(recall * 100).toFixed(1)}%` : NOT_EVALUATED_MESSAGE,
    relevantRetrievedCount,
    totalExpectedCount,
    totalRetrievedCount: topKItems.length
  };
}

/**
 * Computes metrics across all standard K values: [1, 3, 5, 10].
 */
export function calculateMultiKMetrics(
  retrievedItems: RetrievedCandidate[],
  kValues: number[] = [1, 3, 5, 10],
  expectedEvidence?: BenchmarkEvidenceRange[],
  expectedSymbols?: string[]
): Record<number, PrecisionRecallMetrics> {
  const result: Record<number, PrecisionRecallMetrics> = {};
  for (const k of kValues) {
    result[k] = calculatePrecisionRecallAtK(retrievedItems, k, expectedEvidence, expectedSymbols);
  }
  return result;
}
