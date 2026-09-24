/**
 * ExynoX Code Intelligence — Phase 6 Evaluation & Benchmarking Tests
 * Samsung PRISM Gen AI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 *
 * Verifies:
 * 1. Precision@K calculation (0 retrieved, fewer than K, all relevant, none relevant, missing ground truth)
 * 2. High-resolution latency measurement, aggregation, outlier preservation
 * 3. Indexing cost / resource metrics proxies
 * 4. Structural AST accuracy evaluation
 * 5. Evidence grounding verification against repository workspace
 * 6. Relevance matcher and explanation generation
 * 7. APPS dataset handling (clear status, no fabricated data)
 */

import { describe, it, expect } from 'vitest';
import { 
  calculatePrecisionRecallAtK, 
  NOT_EVALUATED_MESSAGE,
  type RetrievedCandidate
} from '../metrics/retrievalMetrics.js';
import { 
  HighResolutionTimer, 
  calculateLatencyAggregate 
} from '../metrics/latencyMetrics.js';
import { matchRetrievedEvidence } from '../metrics/relevanceMatcher.js';
import { evaluateEvidenceGrounding } from '../metrics/groundingMetrics.js';
import { evaluateStructuralAccuracy } from '../metrics/structuralMetrics.js';
import { APPSDatasetManager } from '../datasets/appsDataset.js';
import { f1LapPredictorDataset } from '../datasets/index.js';
import type { BenchmarkQueryItem, BenchmarkEvidenceRange } from '../types.js';

describe('Phase 6 — Precision@K and Recall@K Calculation', () => {
  const groundTruth: BenchmarkEvidenceRange[] = [
    { file: 'src/model.py', startLine: 10, endLine: 35 },
    { file: 'src/train.py', startLine: 50, endLine: 80 }
  ];

  it('should return 0 precision and 0 recall when 0 items retrieved', () => {
    const retrieved: RetrievedCandidate[] = [];
    const metrics = calculatePrecisionRecallAtK(retrieved, 5, groundTruth);

    expect(metrics.precision).not.toBeNull();
    expect(metrics.k).toBe(5);
    expect(metrics.totalRetrievedCount).toBe(0);
    expect(metrics.relevantRetrievedCount).toBe(0);
    expect(metrics.precision).toBe(0);
    expect(metrics.precisionFormatted).toBe('0.0%');
    expect(metrics.recall).toBe(0);
    expect(metrics.recallFormatted).toBe('0.0%');
  });

  it('should strictly use K as the denominator when fewer than K items are retrieved', () => {
    // If 2 items retrieved, 1 relevant, and K=5:
    // Precision@5 MUST BE 1/5 = 0.20 (20%), NOT 1/2 = 50%!
    const retrieved: RetrievedCandidate[] = [
      {
        filePath: 'src/model.py',
        startLine: 12,
        endLine: 20,
        relevanceMatch: { isRelevant: true, matchType: 'line_overlap', explanation: 'Overlaps' }
      },
      {
        filePath: 'README.md',
        startLine: 1,
        endLine: 10,
        relevanceMatch: { isRelevant: false, matchType: 'none', explanation: 'No match' }
      }
    ];

    const metrics = calculatePrecisionRecallAtK(retrieved, 5, groundTruth);

    expect(metrics.k).toBe(5);
    expect(metrics.totalRetrievedCount).toBe(2);
    expect(metrics.relevantRetrievedCount).toBe(1);
    expect(metrics.precision).toBe(0.2); // 1 / 5
    expect(metrics.precisionFormatted).toBe('20.0%');
    expect(metrics.recall).toBe(0.5); // 1 / 2 expected items
    expect(metrics.recallFormatted).toBe('50.0%');
  });

  it('should calculate 100% precision and recall when all retrieved items are relevant up to K', () => {
    const retrieved: RetrievedCandidate[] = [
      {
        filePath: 'src/model.py',
        startLine: 10,
        endLine: 35,
        relevanceMatch: { isRelevant: true, matchType: 'exact_file_line', explanation: 'Exact' }
      },
      {
        filePath: 'src/train.py',
        startLine: 50,
        endLine: 80,
        relevanceMatch: { isRelevant: true, matchType: 'exact_file_line', explanation: 'Exact' }
      }
    ];

    const metrics = calculatePrecisionRecallAtK(retrieved, 2, groundTruth);

    expect(metrics.precision).toBe(1.0);
    expect(metrics.precisionFormatted).toBe('100.0%');
    expect(metrics.recall).toBe(1.0);
    expect(metrics.recallFormatted).toBe('100.0%');
  });

  it('should return 0% precision and recall when no retrieved items are relevant', () => {
    const retrieved: RetrievedCandidate[] = [
      {
        filePath: 'docs/guide.md',
        startLine: 1,
        endLine: 20,
        relevanceMatch: { isRelevant: false, matchType: 'none', explanation: 'Irrelevant' }
      },
      {
        filePath: 'test/test_other.py',
        startLine: 10,
        endLine: 20,
        relevanceMatch: { isRelevant: false, matchType: 'none', explanation: 'Irrelevant' }
      }
    ];

    const metrics = calculatePrecisionRecallAtK(retrieved, 2, groundTruth);

    expect(metrics.precision).toBe(0.0);
    expect(metrics.precisionFormatted).toBe('0.0%');
    expect(metrics.recall).toBe(0.0);
    expect(metrics.recallFormatted).toBe('0.0%');
  });

  it('should explicitly return "Not evaluated — ground truth unavailable" when ground truth is missing', () => {
    const retrieved: RetrievedCandidate[] = [
      {
        filePath: 'src/model.py',
        startLine: 10,
        endLine: 35,
        relevanceMatch: { isRelevant: false, matchType: 'none', explanation: 'No ground truth' }
      }
    ];

    // Undefined/empty ground truth
    const metrics = calculatePrecisionRecallAtK(retrieved, 5, [], []);

    expect(metrics.precision).toBeNull();
    expect(metrics.precisionFormatted).toBe(NOT_EVALUATED_MESSAGE);
    expect(metrics.recall).toBeNull();
    expect(metrics.recallFormatted).toBe(NOT_EVALUATED_MESSAGE);
  });
});

describe('Phase 6 — Latency Measurement & Aggregation', () => {
  it('should measure positive duration with HighResolutionTimer', async () => {
    const timer = new HighResolutionTimer().start();
    // Simulate minimal work
    let sum = 0;
    for (let i = 0; i < 100000; i++) sum += i;
    const record = timer.stop();

    expect(record.durationMs).toBeGreaterThanOrEqual(0);
    expect(record.queryEnd).toBeGreaterThanOrEqual(record.queryStart);
    expect(record.durationMs).toBeDefined();
  });

  it('should calculate accurate min, max, median, mean, and p90 while preserving outliers', () => {
    // Array of latencies with an outlier (500ms)
    const latencies = [10, 12, 14, 15, 18, 20, 22, 25, 30, 500];
    const agg = calculateLatencyAggregate(latencies);

    expect(agg.count).toBe(10);
    expect(agg.minMs).toBe(10);
    expect(agg.maxMs).toBe(500); // Outlier preserved!
    expect(agg.medianMs).toBe(19); // (18 + 20) / 2
    expect(agg.meanMs).toBe(66.6); // Total 666 / 10 = 66.6
    expect(agg.p90Ms).toBe(500); // 9th index (p90)
    expect(agg.rawDurationsMs).toEqual(latencies); // Raw samples preserved
  });

  it('should handle empty latencies gracefully', () => {
    const agg = calculateLatencyAggregate([]);
    expect(agg.count).toBe(0);
    expect(agg.meanMs).toBe(0);
    expect(agg.medianMs).toBe(0);
    expect(agg.minMs).toBe(0);
    expect(agg.maxMs).toBe(0);
  });
});

describe('Phase 6 — Evidence Relevance Matcher', () => {
  it('should detect exact file and line matches', () => {
    const candidate = { filePath: 'src/model.py', startLine: 10, endLine: 20 };
    const expected = [{ file: 'src/model.py', startLine: 10, endLine: 20 }];
    const match = matchRetrievedEvidence(candidate, expected);

    expect(match.isRelevant).toBe(true);
    expect(match.matchType).toBe('exact_file_line');
    expect(match.matchedExpectedEvidence).toBeDefined();
  });

  it('should detect partial line overlap within the same file', () => {
    const candidate = { filePath: 'src/model.py', startLine: 15, endLine: 25 };
    const expected = [{ file: 'src/model.py', startLine: 10, endLine: 20 }];
    const match = matchRetrievedEvidence(candidate, expected);

    expect(match.isRelevant).toBe(true);
    expect(match.matchType).toBe('line_overlap');
    expect(match.explanation).toContain('Line range overlap');
  });

  it('should match expected symbol names in the expected file', () => {
    const candidate = { filePath: 'src/model.py', startLine: 50, endLine: 60, symbolName: 'LapPredictor' };
    const expectedEvidence = [{ file: 'src/model.py', symbol: 'LapPredictor' }];
    const match = matchRetrievedEvidence(candidate, expectedEvidence);

    expect(match.isRelevant).toBe(true);
    expect(match.matchType).toBe('file_symbol');
  });

  it('should reject candidates from different files', () => {
    const candidate = { filePath: 'src/unrelated.py', startLine: 10, endLine: 20 };
    const expected = [{ file: 'src/model.py', startLine: 10, endLine: 20 }];
    const match = matchRetrievedEvidence(candidate, expected);

    expect(match.isRelevant).toBe(false);
    expect(match.matchType).toBe('none');
  });
});

describe('Phase 6 — Evidence Grounding Verification', () => {
  const mockWorkspace: any = {
    files: new Map([
      ['src/lap_time.py', { lines: new Array(150).fill('source line') }],
      ['src/features.py', { lines: new Array(80).fill('feature line') }]
    ])
  };

  it('should verify evidence citations that physically exist in the workspace', () => {
    const findings = [
      { filePath: 'src/lap_time.py', startLine: 10, endLine: 25, content: 'source line' },
      { filePath: 'src/features.py', startLine: 5, endLine: 15, content: 'feature line' }
    ];

    const result = evaluateEvidenceGrounding(findings, mockWorkspace);

    expect(result.isGrounded).toBe(true);
    expect(result.evidenceCount).toBe(2);
    expect(result.fabricatedEvidence.length).toBe(0);
    expect(result.unsupportedClaims.length).toBe(0);
  });

  it('should flag citations pointing to non-existent files as fabricated', () => {
    const findings = [
      { filePath: 'src/hallucinated_file.py', startLine: 10, endLine: 20, content: 'fake' }
    ];

    const result = evaluateEvidenceGrounding(findings, mockWorkspace);

    expect(result.isGrounded).toBe(false);
    expect(result.fabricatedEvidence.length).toBe(1);
    expect(result.fabricatedEvidence[0]).toContain('src/hallucinated_file.py');
  });

  it('should flag line numbers exceeding file length as unsupported claims', () => {
    const findings = [
      { filePath: 'src/features.py', startLine: 200, endLine: 250, content: 'out of bounds' }
    ];

    const result = evaluateEvidenceGrounding(findings, mockWorkspace);

    expect(result.isGrounded).toBe(false);
    expect(result.unsupportedClaims.length).toBeGreaterThan(0);
    expect(result.unsupportedClaims.some(c => c.includes('exceeds file boundary') || c.includes('invalid'))).toBe(true);
  });
});

describe('Phase 6 — Structural AST Accuracy Evaluation', () => {
  it('should evaluate exact count queries accurately', () => {
    const queryItem: BenchmarkQueryItem = {
      id: 'Q_COUNT_1',
      query: 'How many methods are in LapPredictor?',
      queryType: 'count',
      expectedCount: 5
    };

    const structuralResult: any = {
      queryType: 'structural_counts',
      targetSymbol: 'LapPredictor',
      matchedItemsCount: 5,
      explanation: 'Found 5 methods'
    };

    const result = evaluateStructuralAccuracy(queryItem, structuralResult, 5);

    expect(result.evaluated).toBe(true);
    expect(result.exactMatch).toBe(true);
    expect(result.score).toBe(1.0);
    expect(result.notes).toContain('Exact count matched: 5');
  });

  it('should penalize incorrect count queries', () => {
    const queryItem: BenchmarkQueryItem = {
      id: 'Q_COUNT_2',
      query: 'How many methods are in LapPredictor?',
      queryType: 'count',
      expectedCount: 5
    };

    const structuralResult: any = {
      queryType: 'structural_counts',
      targetSymbol: 'LapPredictor',
      matchedItemsCount: 1, // Significant discrepancy
      explanation: 'Found 1 method'
    };

    const result = evaluateStructuralAccuracy(queryItem, structuralResult, 1);

    expect(result.evaluated).toBe(true);
    expect(result.exactMatch).toBe(false);
    expect(result.incorrectResult).toBe(true);
    expect(result.score).toBe(0.0);
  });
});

describe('Phase 6 — APPS Dataset Handling & Real Datasets', () => {
  it('should report clear not-loaded status when APPS dataset is not provided', () => {
    const status = APPSDatasetManager.getStatus();
    expect(status.isLoaded).toBe(false);
    expect(status.statusMessage).toContain('Not evaluated — dataset not loaded');
  });

  it('should provide built-in F1 Telemetry benchmark with ground truth definitions', () => {
    expect(f1LapPredictorDataset.queries.length).toBeGreaterThan(0);
    const firstQuery = f1LapPredictorDataset.queries[0];
    expect(firstQuery.id).toBeDefined();
    expect(firstQuery.query).toBeDefined();
    expect(firstQuery.expectedEvidence).toBeDefined();
  });
});
