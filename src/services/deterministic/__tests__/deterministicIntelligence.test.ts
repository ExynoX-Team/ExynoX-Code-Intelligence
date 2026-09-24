/**
 * Deterministic Query Intelligence Tests
 * Samsung PRISM Gen AI Hackathon (Theme 1: Agentic Code Intelligence)
 * Phase 6.5 — General Deterministic Query Intelligence Hardening
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { classifyQueryIntent } from '../queryIntent.js';
import { extractQueryEntities, normalizeSingular } from '../entityExtractor.js';
import { reformulateQuery } from '../queryReformulator.js';
import { getOrCreateResourceIndex } from '../resourceIndex.js';
import { deterministicEngine } from '../deterministicEngine.js';
import { repositoryService } from '../../repository/index.js';
import { llmRegistry } from '../../llm/index.js';

describe('PHASE 6.5 — GENERAL DETERMINISTIC QUERY INTELLIGENCE HARDENING', () => {
  let workspace: any;

  beforeAll(async () => {
    // Ensure AI is completely disabled
    llmRegistry.disableAI();
    expect(llmRegistry.isAIActive()).toBe(false);

    // Initialize F1 sample repository
    await repositoryService.getF1SampleRepository();
    workspace = repositoryService.getActiveWorkspace()!;
    expect(workspace).toBeDefined();
    expect(workspace.files).toBeDefined();
  }, 30000);

  // =========================================================================
  // SECTION 1: QUERY INTENT CLASSIFICATION (15 Structured Categories)
  // =========================================================================
  describe('Intent Classification without LLM', () => {
    it('correctly classifies Category A: File / Path / Location', () => {
      const intent = classifyQueryIntent('Where is the data loader?');
      expect(intent.primaryIntent).toBe('file_path_location');
    });

    it('correctly classifies Category B: Definition', () => {
      const intent = classifyQueryIntent('Where is the Driver class defined?');
      expect(intent.primaryIntent).toBe('definition');
    });

    it('correctly classifies Category C: Usage / Reference', () => {
      const intent = classifyQueryIntent('Where is the prediction model used?');
      expect(intent.primaryIntent).toBe('usage_reference');
    });

    it('correctly classifies Category D: Caller / Callee', () => {
      const callers = classifyQueryIntent('Who calls calculate_lap_time_degradation?');
      expect(callers.primaryIntent).toBe('caller_callee');
      expect(callers.callerCalleeDirection).toBe('callers');

      const callees = classifyQueryIntent('What functions are called by run_race_prediction_pipeline?');
      expect(callees.primaryIntent).toBe('caller_callee');
      expect(callees.callerCalleeDirection).toBe('callees');
    });

    it('correctly classifies Category E: Import / Dependency', () => {
      const intent = classifyQueryIntent('Where is this module imported?');
      expect(intent.primaryIntent).toBe('import_dependency');
      expect(intent.importDirection).toBe('importers');
    });

    it('correctly classifies Category F: Count / Quantity', () => {
      const intent1 = classifyQueryIntent('How many classes are there in the repository?');
      expect(intent1.primaryIntent).toBe('count_quantity');
      expect(intent1.isCountQuery).toBe(true);

      const intent2 = classifyQueryIntent('How many Python files are in this project?');
      expect(intent2.primaryIntent).toBe('count_quantity');
      expect(intent2.isCountQuery).toBe(true);
    });

    it('correctly classifies Category G: Structural / Architectural', () => {
      const intent = classifyQueryIntent('Where is the application entry point?');
      expect(intent.primaryIntent).toBe('structural_architectural');
    });

    it('correctly classifies Category H: Behavior / Workflow', () => {
      const intent = classifyQueryIntent('How does authentication work?');
      expect(intent.primaryIntent).toBe('behavior_workflow');

      const intent2 = classifyQueryIntent('How does the prediction pipeline work?');
      expect(intent2.primaryIntent).toBe('behavior_workflow');
    });

    it('correctly classifies Category I: Relationship / Data Flow', () => {
      const intent = classifyQueryIntent('How does run_prediction_cli reach calculate_lap_time_degradation?');
      expect(intent.primaryIntent).toBe('relationship_data_flow');
    });

    it('correctly classifies Category J: Configuration', () => {
      const intent1 = classifyQueryIntent('Where is Redis configured?');
      expect(intent1.primaryIntent).toBe('configuration');

      const intent2 = classifyQueryIntent('What port does the server use?');
      expect(intent2.primaryIntent).toBe('configuration');
    });

    it('correctly classifies Category K: Asset / Resource', () => {
      const intent1 = classifyQueryIntent('What is the path of the ExynoX logo?');
      expect(intent1.primaryIntent).toBe('asset_resource');

      const intent2 = classifyQueryIntent('Where is the team logo?');
      expect(intent2.primaryIntent).toBe('asset_resource');
    });

    it('correctly classifies Category L: Documentation', () => {
      const intent = classifyQueryIntent('Where are the setup instructions in the README?');
      expect(intent.primaryIntent).toBe('documentation');
    });

    it('correctly classifies Category M: Testing', () => {
      const intent = classifyQueryIntent('Where are the tests for this function?');
      expect(intent.primaryIntent).toBe('testing');
    });

    it('correctly classifies Category N: Error Handling', () => {
      const intent = classifyQueryIntent('Where is this error handled?');
      expect(intent.primaryIntent).toBe('error_handling');
    });
  });

  // =========================================================================
  // SECTION 2: ENTITY EXTRACTION & REFORMULATION
  // =========================================================================
  describe('Entity Extraction & Linguistic Normalization', () => {
    it('normalizes plurals to singular forms', () => {
      expect(normalizeSingular('classes')).toBe('class');
      expect(normalizeSingular('drivers')).toBe('driver');
      expect(normalizeSingular('functions')).toBe('function');
      expect(normalizeSingular('files')).toBe('file');
      expect(normalizeSingular('dependencies')).toBe('dependency');
    });

    it('extracts source and target from call chain question', () => {
      const query = 'How does run_prediction_cli reach calculate_lap_time_degradation?';
      const intent = classifyQueryIntent(query);
      const entities = extractQueryEntities(query, intent);

      expect(entities.sourceEntity).toBe('run_prediction_cli');
      expect(entities.targetEntity).toBe('calculate_lap_time_degradation');
    });

    it('expands domain concepts deterministically without LLM', () => {
      const expansions = reformulateQuery('auth', 'behavior_workflow', []);
      expect(expansions).toContain('auth');
      expect(expansions).toContain('login');
      expect(expansions).toContain('credentials');

      const logoExpansions = reformulateQuery('logo', 'asset_resource', []);
      expect(logoExpansions).toContain('logo');
      expect(logoExpansions).toContain('png');
      expect(logoExpansions).toContain('asset');
    });
  });

  // =========================================================================
  // SECTION 3: CROSS-MODAL RESOURCE INDEX
  // =========================================================================
  describe('Cross-Modal Resource Indexing', () => {
    it('indexes assets, configurations, and documentation files', () => {
      const resIdx = getOrCreateResourceIndex(workspace);

      // Assets
      expect(resIdx.assets.size).toBeGreaterThan(0);
      expect(resIdx.assets.has('assets/f1_logo.png')).toBe(true);

      // Configs
      expect(resIdx.configs.has('config/settings.yaml')).toBe(true);

      // Docs
      expect(resIdx.docs.has('README.md')).toBe(true);

      // Universal definitions
      expect(resIdx.definitions.length).toBeGreaterThan(0);
      const hasDriverDef = resIdx.definitions.some(d => d.name === 'Driver');
      expect(hasDriverDef).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 4: END-TO-END DETERMINISTIC QUERY EXECUTION
  // =========================================================================
  describe('End-to-End Deterministic Retrieval (AI OFF)', () => {
    it('Query 1: Asset Path Resolution ("What is the path of the F1 logo?")', async () => {
      const result = await deterministicEngine.execute('What is the path of the F1 logo?', workspace);

      expect(result.status).toBe('completed');
      expect(result.intent).toBe('asset_resource');
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings[0].location.filePath).toBe('assets/f1_logo.png');
      expect(result.explanation).toContain('assets/f1_logo.png');
      expect(result.isNegative).toBe(false);
    });

    it('Query 2: Class Definition ("Where is the Driver class defined?")', async () => {
      const result = await deterministicEngine.execute('Where is the Driver class defined?', workspace);

      expect(result.status).toBe('completed');
      expect(result.findings.length).toBeGreaterThan(0);
      const top = result.findings[0];
      expect(top.location.filePath).toBe('models/driver.py');
      expect(top.location.startLine).toBeGreaterThan(0);
      expect(result.isNegative).toBe(false);
    });

    it('Query 3: Callers Retrieval ("Who calls calculate_lap_time_degradation?")', async () => {
      const result = await deterministicEngine.execute('Who calls calculate_lap_time_degradation?', workspace);

      expect(result.status).toBe('completed');
      expect(result.intent).toBe('caller_callee');
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings.some(f => f.location.filePath.includes('predict.py'))).toBe(true);
      expect(result.isNegative).toBe(false);
    });

    it('Query 4: Call Chain Trace ("How does run_prediction_cli reach calculate_lap_time_degradation?")', async () => {
      const result = await deterministicEngine.execute(
        'How does run_prediction_cli reach calculate_lap_time_degradation?',
        workspace
      );

      expect(result.status).toBe('completed');
      expect(result.intent).toBe('relationship_data_flow');
      expect(result.structuralResult).toBeDefined();
      expect(result.structuralResult?.callChain?.pathFound).toBe(true);
      expect(result.findings.length).toBeGreaterThanOrEqual(2);
    });

    it('Query 5: Count Question ("How many classes are there in the repository?")', async () => {
      const result = await deterministicEngine.execute('How many classes are there in the repository?', workspace);

      expect(result.status).toBe('completed');
      expect(result.intent).toBe('count_quantity');
      expect(result.structuralResult?.matchedItemsCount).toBe(4);
      expect(result.explanation).toContain('4 class definition');
    });

    it('Query 6: Count Question ("How many Python files are in this project?")', async () => {
      const result = await deterministicEngine.execute('How many Python files are in this project?', workspace);

      expect(result.status).toBe('completed');
      expect(result.intent).toBe('count_quantity');
      expect(result.structuralResult?.matchedItemsCount).toBe(9);
      expect(result.explanation).toContain('9 Python files');
    });

    it('Query 7: Verified Negative Answer ("Where is Redis configured?")', async () => {
      const result = await deterministicEngine.execute('Where is Redis configured?', workspace);

      expect(result.status).toBe('completed');
      expect(result.isNegative).toBe(true);
      expect(result.findings.length).toBe(0);
      expect(result.explanation).toContain('No verified Redis configuration was found');
    });

    it('Query 8: Documentation Lookup ("Where are the setup instructions in the README?")', async () => {
      const result = await deterministicEngine.execute('Where are the setup instructions in the README?', workspace);

      expect(result.status).toBe('completed');
      expect(result.intent).toBe('documentation');
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings[0].location.filePath).toBe('README.md');
    });

    it('Query 9: Behavioral Workflow ("How does authentication work?")', async () => {
      const result = await deterministicEngine.execute('How does authentication work?', workspace);

      expect(result.status).toBe('completed');
      expect(result.intent).toBe('behavior_workflow');
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings[0].location.filePath).toBe('auth/login.py');
      expect(result.explanation).toContain('login_user');
      expect(result.explanation).toContain('authenticate_user');
    });

    it('Query 10: Behavioral Workflow ("How does the prediction pipeline work?")', async () => {
      const result = await deterministicEngine.execute('How does the prediction pipeline work?', workspace);

      expect(result.status).toBe('completed');
      expect(result.intent).toBe('behavior_workflow');
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings[0].location.filePath).toContain('predict.py');
      expect(result.explanation).toContain('pipeline');
    });

    it('Query 11: Ambiguity Handling ("How many drivers are there?")', async () => {
      const result = await deterministicEngine.execute('How many drivers are there?', workspace);

      expect(result.status).toBe('completed');
      expect(result.intent).toBe('count_quantity');
      // Confirms both 1 Driver class and 10 roster drivers
      expect(result.explanation).toContain('1 Driver class');
      expect(result.explanation).toContain('10 Formula 1 drivers');
    });
  });
});
