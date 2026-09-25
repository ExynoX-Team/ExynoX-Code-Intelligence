import { describe, it, expect, beforeAll } from 'vitest';
import { loadF1SampleRepository } from '../../repository/f1SampleRepository.js';
import { InvestigationEngine } from '../investigationEngine.js';
import type { RepositoryWorkspace } from '../../repository/repositoryWorkspace.js';

describe('PHASE 4 HARDENING — REAL INVESTIGATION AND EVIDENCE VERIFICATION', () => {
  let workspace: RepositoryWorkspace;
  let engine: InvestigationEngine;

  beforeAll(async () => {
    workspace = await loadF1SampleRepository();
    engine = new InvestigationEngine(workspace);
  }, 30000);

  it('TEST 1: "Where is the prediction model used?" — distinguishes actual usage from definitions, callers, docs, and unrelated files', async () => {
    const result = await engine.investigate('Where is the prediction model used?');

    // 1. Evidence Verification
    expect(result.isVerified).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);

    // 2. Candidate Files & Tool Execution Records
    const toolNames = result.toolCalls.map(t => t.toolName);
    expect(toolNames).toContain('retrieve_candidates');
    expect(toolNames).toContain('inspect_file');
    expect(toolNames).toContain('check_prediction_calls');
    expect(toolNames).toContain('classify_roles');
    expect(toolNames).toContain('verify_evidence');

    // 3. Evidence classification & roles
    const actualUsages = result.evidence.filter(e => e.evidenceType === 'prediction_usage' || e.relationshipType === 'usage');
    expect(actualUsages.length).toBeGreaterThanOrEqual(1);
    expect(actualUsages.some(e => e.filePath === 'pipeline/predict.py')).toBe(true);

    const modelDefs = result.evidence.filter(e => e.evidenceType === 'model_definition');
    expect(modelDefs.length).toBeGreaterThanOrEqual(1);
    expect(modelDefs.some(e => e.filePath === 'models/predictor.py')).toBe(true);

    // Unrelated file auth/login.py MUST NOT be classified as prediction usage
    const loginUsages = result.evidence.filter(e => e.filePath === 'auth/login.py' && (e.evidenceType === 'prediction_usage' || e.relationshipType === 'usage'));
    expect(loginUsages.length).toBe(0);

    // 4. Grounded Answer Structure
    expect(result.finalAnswer).toBeDefined();
    const ans = result.finalAnswer!.answer;
    expect(ans).toContain('### Answer');
    expect(ans).toContain('### Actual prediction usages');
    expect(ans).toContain('pipeline/predict.py');
    expect(ans).toContain('models/predictor.py');
    expect(ans).toContain('main.py');
    expect(ans).toContain('README.md');
  });

  it('TEST 2: "First identify the model definition, then find every verified place where it is actually called for prediction. Distinguish the model definition from its usage."', async () => {
    const query = 'First identify the model definition, then find every verified place where it is actually called for prediction. Distinguish the model definition from its usage.';
    const result = await engine.investigate(query);

    expect(result.finalAnswer).toBeDefined();
    const ans = result.finalAnswer!.answer;

    // Distinguishes definition in models/predictor.py from usages in pipeline/predict.py
    expect(ans).toContain('models/predictor.py');
    expect(ans).toContain('LapTimePredictor');
    expect(ans).toContain('pipeline/predict.py');
    expect(ans).toContain('run_race_prediction_pipeline');
    expect(ans).toMatch(/`pipeline\/predict\.py` — Line \d+/);
  });

  it('TEST 3: "Are there any files that mention the prediction model but do not actually use it to generate predictions? Identify them and explain why."', async () => {
    const query = 'Are there any files that mention the prediction model but do not actually use it to generate predictions? Identify them and explain why.';
    const result = await engine.investigate(query);

    expect(result.finalAnswer).toBeDefined();
    const ans = result.finalAnswer!.answer;

    // Identifies non-usage files and explains why
    expect(ans).toContain('main.py');
    expect(ans).toContain('models/predictor.py');
    expect(ans).toContain('README.md');
    expect(ans).toContain('config/settings.yaml');
    expect(ans).toContain('Why');
  });

  it('TEST 4: "Which function actually generates the prediction?" — distinguishes math inference from orchestration', async () => {
    const query = 'Which function actually generates the prediction?';
    const result = await engine.investigate(query);

    expect(result.finalAnswer).toBeDefined();
    const ans = result.finalAnswer!.answer;

    expect(ans).toContain('LapTimePredictor.predict');
    expect(ans).toContain('models/predictor.py');
    expect(ans).toContain('run_race_prediction_pipeline');
    expect(ans).toContain('pipeline/predict.py');
  });

  it('TEST 5: "Who calls that function?" — follow-up query tracing callers via AST', async () => {
    const history = [
      {
        id: 'turn_1',
        timestamp: Date.now(),
        question: 'Where is the prediction model used?',
        answer: 'The prediction model is instantiated and used in run_race_prediction_pipeline inside pipeline/predict.py (Lines 48–80).',
        evidence: [
          {
            id: 'ev_pipeline',
            filePath: 'pipeline/predict.py',
            startLine: 48,
            endLine: 80,
            codeSnippet: 'def run_race_prediction_pipeline(track_name, laps):',
            relevanceReason: 'Instantiates and uses prediction model',
            confidence: 0.95,
            sourceTool: 'inspect_file',
            symbolName: 'run_race_prediction_pipeline',
            symbolType: 'function',
            relationshipType: 'usage' as const,
            verified: true
          }
        ]
      }
    ];

    const result = await engine.investigate('Who calls that function?', {
      conversationHistory: history
    });

    expect(result.finalAnswer).toBeDefined();
    const ans = result.finalAnswer!.answer;

    // Traces caller in main.py
    expect(ans).toContain('main.py');
    expect(ans).toContain('run_prediction_cli');
    expect(ans).toMatch(/`main\.py` \(Lines? \d+/);
  });

  it('TEST 6: "How does the application calculate lap-time degradation, and where is that calculation used?"', async () => {
    const query = 'How does the application calculate lap-time degradation, and where is that calculation used?';
    const result = await engine.investigate(query);

    // Tool calls verified
    const toolNames = result.toolCalls.map(t => t.toolName);
    expect(toolNames).toContain('inspect_file');
    expect(toolNames).toContain('check_calculation_formula');
    expect(toolNames).toContain('find_callers');
    expect(toolNames).toContain('verify_evidence');

    expect(result.finalAnswer).toBeDefined();
    const ans = result.finalAnswer!.answer;

    // Cites calculation definition in models/degradation.py
    expect(ans).toContain('models/degradation.py');
    expect(ans).toContain('calculate_lap_time_degradation');
    expect(ans).toContain('Formula Breakdown');

    // Cites usage in pipeline/predict.py
    expect(ans).toContain('pipeline/predict.py');
    expect(ans).toContain('run_race_prediction_pipeline');
  });
});
