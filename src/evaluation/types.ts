/**
 * ExynoX Code Intelligence — Phase 6 Evaluation & Benchmarking Data Model
 * Samsung PRISM Gen AI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 *
 * Strict Rule: Never generate fake metrics. If ground truth is missing,
 * explicitly return "Not evaluated — ground truth unavailable".
 */

export type BenchmarkQueryType =
  | 'retrieval'
  | 'definition'
  | 'reference'
  | 'caller'
  | 'callee'
  | 'import'
  | 'count'
  | 'call_chain'
  | 'semantic'
  | 'hybrid'
  | 'usage';

export interface BenchmarkEvidenceRange {
  file: string;
  startLine?: number;
  endLine?: number;
  symbol?: string;
}

export interface BenchmarkQueryItem {
  id: string;
  query: string;
  description?: string;
  expectedEvidence?: BenchmarkEvidenceRange[];
  expectedSymbols?: string[];
  queryType: BenchmarkQueryType;
  expectedAnswerSubstring?: string;
  expectedCount?: number;
  tags?: string[];
}

export interface BenchmarkDataset {
  id: string;
  name: string;
  description: string;
  version?: string;
  targetRepository?: string;
  queries: BenchmarkQueryItem[];
  metadata?: Record<string, unknown>;
}

export type RelevanceMatchType =
  | 'exact_file_line'
  | 'line_overlap'
  | 'file_symbol'
  | 'exact_symbol'
  | 'none';

export interface RelevanceMatchResult {
  isRelevant: boolean;
  matchType: RelevanceMatchType;
  matchedExpectedEvidence?: BenchmarkEvidenceRange;
  matchedSymbol?: string;
  overlapLines?: { start: number; end: number };
  explanation: string;
}

export interface PrecisionRecallMetrics {
  k: number;
  precision: number | null; // null if ground truth unavailable
  recall: number | null;    // null if ground truth unavailable
  precisionFormatted: string; // e.g. "60.0%" or "Not evaluated — ground truth unavailable"
  recallFormatted: string;    // e.g. "75.0%" or "Not evaluated — ground truth unavailable"
  relevantRetrievedCount: number;
  totalExpectedCount: number;
  totalRetrievedCount: number;
}

export interface QueryLatencyBreakdown {
  retrievalMs?: number;
  structuralMs?: number;
  agenticInvestigationMs?: number;
  llmMs?: number;
}

export interface QueryLatencyRecord {
  queryStart: number;
  queryEnd: number;
  durationMs: number;
  breakdown?: QueryLatencyBreakdown;
}

export interface GroundingEvaluation {
  isGrounded: boolean;
  allCitationsValid: boolean;
  unsupportedClaims: string[];
  fabricatedEvidence: string[];
  missingEvidence: string[];
  evidenceCount: number;
}

export interface StructuralAccuracyResult {
  evaluated: boolean;
  category: string;
  exactMatch: boolean;
  partialMatch: boolean;
  missingResult: boolean;
  incorrectResult: boolean;
  expectedOutput?: unknown;
  actualOutput?: unknown;
  score: number; // 1.0 (exact), 0.5 (partial), 0.0 (miss/fail)
  notes?: string;
}

export interface TokenUsageRecord {
  available: boolean;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  formatted: string;
}

export interface QueryEvaluationResult {
  queryId: string;
  query: string;
  queryType: BenchmarkQueryType;
  hasGroundTruth: boolean;
  groundTruthReason?: string;
  kMetrics: Record<number, PrecisionRecallMetrics>;
  retrievedItems: {
    rank: number;
    filePath: string;
    startLine: number;
    endLine: number;
    symbolName?: string;
    snippet?: string;
    relevanceMatch: RelevanceMatchResult;
  }[];
  latency: QueryLatencyRecord;
  grounding: GroundingEvaluation;
  structuralAccuracy?: StructuralAccuracyResult;
  tokens?: TokenUsageRecord;
}

export interface IndexingResourceMetrics {
  label: "Indexing Cost / Resource Metrics";
  totalFiles: number;
  sourceFiles: number;
  totalLines: number;
  totalCharacters: number;
  totalChunks: number;
  totalAstNodes: number;
  totalSymbols: number;
  totalFunctions: number;
  totalClasses: number;
  totalMethods: number;
  totalCallRelationships: number;
  totalImportRelationships: number;
  semanticVectorsGenerated: number;
  approximateIndexMemoryBytes: number;
  approximateIndexMemoryFormatted: string;
  indexingDurationMs: number;
}

export interface LatencyAggregate {
  count: number;
  meanMs: number;
  medianMs: number;
  minMs: number;
  maxMs: number;
  p90Ms: number;
  rawDurationsMs: number[];
}

export interface BenchmarkSummary {
  benchmarkId: string;
  timestamp: number;
  repositoryIdentifier: string;
  datasetIdentifier: string;
  mode: 'deterministic' | 'agentic';
  runsCount: number;
  totalQueries: number;
  queriesWithGroundTruth: number;
  precisionAtK: Record<number, number | null>;
  precisionAtKFormatted: Record<number, string>;
  recallAtK: Record<number, number | null>;
  recallAtKFormatted: Record<number, string>;
  latency: LatencyAggregate;
  indexing: IndexingResourceMetrics | null;
  structuralAccuracy: {
    overallAccuracy: number | null;
    evaluatedCount: number;
    byCategory: Record<string, { total: number; correct: number; accuracy: number }>;
  };
  grounding: {
    totalEvaluated: number;
    groundedCount: number;
    groundingRate: number;
    groundingRateFormatted: string;
    totalFabricatedEvidence: number;
    totalUnsupportedClaims: number;
  };
  tokenCost: {
    isAvailable: boolean;
    summaryFormatted: string;
    pricingConfigured: boolean;
    monetaryCostFormatted?: string;
  };
}

export interface BenchmarkRunOptions {
  dataset: BenchmarkDataset;
  workspace: unknown; // RepositoryWorkspace
  mode?: 'deterministic' | 'agentic';
  kValues?: number[]; // default [1, 3, 5, 10]
  iterations?: number; // default 1 (supports 1, 3, 5 runs for repeatability)
  onProgress?: (progress: { currentQuery: number; totalQueries: number; queryText: string }) => void;
}

export interface BenchmarkReport {
  summary: BenchmarkSummary;
  queryResults: QueryEvaluationResult[];
  runs: { runIndex: number; durationsMs: number[] }[];
  generatedAt: string;
  appVersion: string;
  jsonOutput: string;
  markdownOutput: string;
}
