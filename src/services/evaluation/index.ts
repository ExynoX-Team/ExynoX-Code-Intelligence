export interface EvaluationBenchmark {
  benchmarkName: 'APPS_DATASET' | 'CUSTOM_BENCHMARK';
  totalQueries: number;
  precisionAtK: number;
  recallAtK: number;
  meanReciprocalRank: number;
}

export interface IEvaluationService {
  runBenchmark(datasetPath: string): Promise<EvaluationBenchmark>;
}

/**
 * EvaluationService - Planned for future phase
 * Evaluates code localization accuracy against the APPS dataset and reference ground truths.
 */
export class EvaluationService implements IEvaluationService {
  async runBenchmark(): Promise<EvaluationBenchmark> {
    // Stub for future phase
    return {
      benchmarkName: 'APPS_DATASET',
      totalQueries: 0,
      precisionAtK: 0,
      recallAtK: 0,
      meanReciprocalRank: 0
    };
  }
}

export const evaluationService = new EvaluationService();
