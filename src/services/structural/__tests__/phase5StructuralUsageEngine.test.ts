import { describe, it, expect, beforeAll } from 'vitest';
import { loadF1SampleRepository } from '../../repository/f1SampleRepository.js';
import { routeStructuralQuery } from '../queryRouter.js';
import type { RepositoryWorkspace } from '../../repository/repositoryWorkspace.js';

describe('PHASE 5 — STRUCTURAL & USAGE QUERY ENGINE VERIFICATION', () => {
  let workspace: RepositoryWorkspace;

  beforeAll(async () => {
    workspace = await loadF1SampleRepository();
  });

  describe('1. Call Chain Tracing', () => {
    it('discovers static call chain path from main to LapTimePredictor.predict or predict', () => {
      const outcome = routeStructuralQuery(
        'Show call chain from main to predict',
        workspace.structuralIndex,
        workspace
      );

      expect(outcome.handled).toBe(true);
      expect(outcome.queryResult?.queryType).toBe('find_call_chain');
      expect(outcome.queryResult?.callChain?.pathFound).toBe(true);
      expect(outcome.queryResult?.callChain?.steps.length).toBeGreaterThanOrEqual(2);
      expect(outcome.findings.length).toBeGreaterThanOrEqual(2);

      // Verify each hop in the chain has exact file and line grounding
      const steps = outcome.queryResult!.callChain!.steps;
      for (const step of steps) {
        expect(step.filePath).toBeTruthy();
        expect(step.line).toBeGreaterThan(0);
        expect(step.fromSymbol).toBeTruthy();
        expect(step.toSymbol).toBeTruthy();
        expect(['confirmed', 'likely']).toContain(step.confidence);
      }
    });

    it('handles alternative phrasing: "How does main reach LapTimePredictor?"', () => {
      const outcome = routeStructuralQuery(
        'How does main reach LapTimePredictor?',
        workspace.structuralIndex,
        workspace
      );

      expect(outcome.handled).toBe(true);
      expect(outcome.queryResult?.queryType).toBe('find_call_chain');
      expect(outcome.queryResult?.callChain?.pathFound).toBe(true);
    });
  });

  describe('2. Caller Analysis', () => {
    it('finds static callers of calculate_lap_time_degradation', () => {
      const outcome = routeStructuralQuery(
        'Who calls calculate_lap_time_degradation()?',
        workspace.structuralIndex,
        workspace
      );

      expect(outcome.handled).toBe(true);
      expect(outcome.queryResult?.queryType).toBe('find_callers');
      expect(outcome.queryResult?.matchedItemsCount).toBeGreaterThanOrEqual(1);

      // Caller should be inside pipeline/predict.py
      const callers = outcome.queryResult?.callSites || [];
      expect(callers.some(c => c.filePath.includes('predict.py'))).toBe(true);
      expect(outcome.findings.length).toBeGreaterThanOrEqual(1);
    });

    it('handles phrasing: "Which functions call load_dataset?"', () => {
      const outcome = routeStructuralQuery(
        'Which functions call load_dataset?',
        workspace.structuralIndex,
        workspace
      );

      expect(outcome.handled).toBe(true);
      expect(outcome.queryResult?.queryType).toBe('find_callers');
    });

    it('honestly returns 0 matches for functions that have no callers', () => {
      const outcome = routeStructuralQuery(
        'Who calls non_existent_telemetry_stub()?',
        workspace.structuralIndex,
        workspace
      );

      expect(outcome.handled).toBe(true);
      expect(outcome.queryResult?.queryType).toBe('find_callers');
      expect(outcome.queryResult?.matchedItemsCount).toBe(0);
      expect(outcome.queryResult?.explanation).toContain("No callers of 'non_existent_telemetry_stub' were found");
      expect(outcome.findings.length).toBe(0);
    });
  });

  describe('3. Callee Analysis', () => {
    it('lists static functions called by run_race_prediction_pipeline', () => {
      const outcome = routeStructuralQuery(
        'What does run_race_prediction_pipeline call?',
        workspace.structuralIndex,
        workspace
      );

      expect(outcome.handled).toBe(true);
      expect(outcome.queryResult?.queryType).toBe('find_callees');
      expect(outcome.queryResult?.matchedItemsCount).toBeGreaterThanOrEqual(1);

      // Should call calculate_lap_time_degradation or model predict
      const callees = outcome.queryResult?.callSites || [];
      const calledSymbols = callees.map(c => c.callee);
      expect(calledSymbols.some(s => s.includes('calculate_lap_time_degradation') || s.includes('predict'))).toBe(true);
    });

    it('handles phrasing: "Callees of main"', () => {
      const outcome = routeStructuralQuery(
        'Callees of main',
        workspace.structuralIndex,
        workspace
      );

      expect(outcome.handled).toBe(true);
      expect(outcome.queryResult?.queryType).toBe('find_callees');
    });
  });

  describe('4. Import & Dependency Queries', () => {
    it('finds which files import models.driver or Driver', () => {
      const outcome = routeStructuralQuery(
        'Which files import models.driver?',
        workspace.structuralIndex,
        workspace
      );

      expect(outcome.handled).toBe(true);
      expect(outcome.queryResult?.queryType).toBe('find_imports');
      expect(outcome.queryResult?.matchedItemsCount).toBeGreaterThanOrEqual(1);
    });

    it('lists all imports in pipeline/predict.py', () => {
      const outcome = routeStructuralQuery(
        'Imports in pipeline/predict.py',
        workspace.structuralIndex,
        workspace
      );

      expect(outcome.handled).toBe(true);
      expect(outcome.queryResult?.queryType).toBe('find_imports');
      expect(outcome.queryResult?.matchedItemsCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('5. Symbol References & Usages', () => {
    it('discovers multi-role usages of LapTimePredictor (instantiation, type hint, calls)', () => {
      const outcome = routeStructuralQuery(
        'Where is LapTimePredictor used?',
        workspace.structuralIndex,
        workspace
      );

      expect(outcome.handled).toBe(true);
      expect(outcome.queryResult?.queryType).toBe('find_references');
      expect(outcome.queryResult?.referenceItems?.length).toBeGreaterThanOrEqual(1);
      expect(outcome.findings.length).toBeGreaterThanOrEqual(1);
    });

    it('handles phrasing: "All usages of calculate_lap_time_degradation"', () => {
      const outcome = routeStructuralQuery(
        'All usages of calculate_lap_time_degradation',
        workspace.structuralIndex,
        workspace
      );

      expect(outcome.handled).toBe(true);
      expect(outcome.queryResult?.queryType).toBe('find_references');
      expect(outcome.findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('6. Fallback Behavior for Non-Structural Questions', () => {
    it('yields unhandled for non-structural conceptual questions', () => {
      const outcome = routeStructuralQuery(
        'Explain how the machine learning model was trained on tire telemetry',
        workspace.structuralIndex,
        workspace
      );

      // Should not be falsely intercepted by structural router
      expect(outcome.handled).toBe(false);
      expect(outcome.findings.length).toBe(0);
    });
  });
});
