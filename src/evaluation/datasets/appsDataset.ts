/**
 * ExynoX Code Intelligence — APPS Dataset Architecture Support
 * Samsung PRISM Gen AI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 *
 * Official Requirement (Theme 1 FAQ):
 * The APPS Python dataset is the designated dataset for Theme 1.
 *
 * Strict Compliance:
 * - Architecture is prepared to load and evaluate APPS benchmark problems.
 * - If the APPS dataset files are not loaded or present in the runtime environment,
 *   it explicitly returns status: "Not evaluated — dataset not loaded".
 * - Never fabricate APPS benchmark numbers or pretend metrics exist without actual execution.
 */

import type { BenchmarkDataset } from '../types.js';

export interface APPSDatasetStatus {
  isLoaded: boolean;
  statusMessage: string;
  problemCount: number;
  dataset: BenchmarkDataset | null;
}

export class APPSDatasetManager {
  private static cachedDataset: BenchmarkDataset | null = null;

  /**
   * Checks whether the APPS dataset is loaded in the current runtime environment.
   */
  public static getStatus(): APPSDatasetStatus {
    if (this.cachedDataset && this.cachedDataset.queries.length > 0) {
      return {
        isLoaded: true,
        statusMessage: `APPS dataset loaded with ${this.cachedDataset.queries.length} benchmark problems`,
        problemCount: this.cachedDataset.queries.length,
        dataset: this.cachedDataset
      };
    }

    return {
      isLoaded: false,
      statusMessage: "Not evaluated — dataset not loaded",
      problemCount: 0,
      dataset: null
    };
  }

  /**
   * Loads an APPS dataset JSON object (e.g. from user file upload or test fixture).
   */
  public static loadCustomAPPSDataset(rawJson: unknown): APPSDatasetStatus {
    if (!rawJson || typeof rawJson !== 'object') {
      return {
        isLoaded: false,
        statusMessage: "Not evaluated — dataset not loaded (invalid JSON structure)",
        problemCount: 0,
        dataset: null
      };
    }

    const obj = rawJson as Record<string, unknown>;
    const problems = Array.isArray(obj.problems) ? obj.problems : (Array.isArray(obj.queries) ? obj.queries : []);

    if (problems.length === 0) {
      return {
        isLoaded: false,
        statusMessage: "Not evaluated — dataset not loaded (empty problem list)",
        problemCount: 0,
        dataset: null
      };
    }

    const convertedDataset: BenchmarkDataset = {
      id: "apps-python-benchmark",
      name: "APPS Python Dataset Benchmark",
      description: "Official Theme 1 APPS Python Benchmark Suite",
      version: String(obj.version || "1.0.0"),
      targetRepository: "apps-repo",
      queries: problems.map((prob: any, idx: number) => ({
        id: prob.id || `apps_p_${idx + 1}`,
        query: prob.query || prob.problem || prob.question || `APPS Problem ${idx + 1}`,
        description: prob.description || `APPS Python coding problem ${prob.problem_id || idx + 1}`,
        expectedEvidence: prob.expectedEvidence || [],
        expectedSymbols: prob.expectedSymbols || [],
        queryType: prob.queryType || 'retrieval',
        expectedCount: prob.expectedCount,
        tags: ['apps', 'python', prob.difficulty || 'standard']
      }))
    };

    this.cachedDataset = convertedDataset;

    return {
      isLoaded: true,
      statusMessage: `APPS dataset loaded with ${convertedDataset.queries.length} benchmark problems`,
      problemCount: convertedDataset.queries.length,
      dataset: convertedDataset
    };
  }

  public static clear(): void {
    this.cachedDataset = null;
  }
}
