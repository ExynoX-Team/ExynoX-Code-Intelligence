/**
 * ExynoX Code Intelligence — Benchmark Datasets Registry
 * Samsung PRISM Gen AI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 */

import type { BenchmarkDataset } from '../types.js';
import f1BenchmarkRaw from './f1-lap-predictor.json';
import { APPSDatasetManager } from './appsDataset.js';
import { jsGatewayBenchmarkDataset } from './jsGatewayBenchmark.js';

export * from './appsDataset.js';
export * from './jsGatewayBenchmark.js';

export const f1LapPredictorDataset: BenchmarkDataset = f1BenchmarkRaw as unknown as BenchmarkDataset;

export interface DatasetOption {
  id: string;
  name: string;
  description: string;
  queryCount: number;
  isAvailable: boolean;
  statusText?: string;
  dataset?: BenchmarkDataset;
}

export function listAvailableDatasets(): DatasetOption[] {
  const appsStatus = APPSDatasetManager.getStatus();

  return [
    {
      id: jsGatewayBenchmarkDataset.id,
      name: jsGatewayBenchmarkDataset.name,
      description: jsGatewayBenchmarkDataset.description,
      queryCount: jsGatewayBenchmarkDataset.queries.length,
      isAvailable: true,
      dataset: jsGatewayBenchmarkDataset
    },
    {
      id: f1LapPredictorDataset.id,
      name: f1LapPredictorDataset.name,
      description: f1LapPredictorDataset.description,
      queryCount: f1LapPredictorDataset.queries.length,
      isAvailable: true,
      dataset: f1LapPredictorDataset
    },
    {
      id: 'apps-python-benchmark',
      name: 'APPS Python Dataset (Theme 1 Official)',
      description: 'Official Theme 1 Benchmark Suite. Requires APPS dataset files loaded.',
      queryCount: appsStatus.problemCount,
      isAvailable: appsStatus.isLoaded,
      statusText: appsStatus.statusMessage,
      dataset: appsStatus.dataset || undefined
    }
  ];
}

export function parseCustomBenchmarkDataset(jsonContent: string | object): BenchmarkDataset {
  const data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid benchmark dataset: input must be a JSON object');
  }

  const queries = Array.isArray(data.queries) ? data.queries : [];
  if (queries.length === 0) {
    throw new Error("Invalid benchmark dataset: missing or empty 'queries' array");
  }

  return {
    id: String(data.id || `custom_dataset_${Date.now()}`),
    name: String(data.name || 'Custom Benchmark Dataset'),
    description: String(data.description || 'User-provided evaluation benchmark'),
    version: String(data.version || '1.0.0'),
    targetRepository: data.targetRepository ? String(data.targetRepository) : undefined,
    queries: queries.map((q: any, idx: number) => ({
      id: String(q.id || `q_${idx + 1}`),
      query: String(q.query || ''),
      description: q.description ? String(q.description) : undefined,
      expectedEvidence: Array.isArray(q.expectedEvidence) ? q.expectedEvidence : [],
      expectedSymbols: Array.isArray(q.expectedSymbols) ? q.expectedSymbols : [],
      queryType: q.queryType || 'retrieval',
      expectedCount: typeof q.expectedCount === 'number' ? q.expectedCount : undefined,
      expectedAnswerSubstring: q.expectedAnswerSubstring ? String(q.expectedAnswerSubstring) : undefined,
      tags: Array.isArray(q.tags) ? q.tags : []
    })),
    metadata: data.metadata || {}
  };
}
