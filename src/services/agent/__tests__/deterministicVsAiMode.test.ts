import { describe, it, expect, beforeAll } from 'vitest';
import { loadF1SampleRepository } from '../../repository/f1SampleRepository.js';
import { repositoryService } from '../../repository/index.js';
import { agentService } from '../index.js';
import { llmRegistry } from '../../llm/index.js';
import { MockProvider } from '../../llm/mockProvider.js';

describe('PHASE 4 FINAL UX POLISH — DISTINGUISH DETERMINISTIC AND AI MODES', () => {
  beforeAll(async () => {
    await repositoryService.getF1SampleRepository();
  }, 30000);

  const testQuestion = 'Where is the prediction model used?';

  it('TEST 1: WITHOUT AI — Fast deterministic retrieval, concise state, no fake agentic steps', async () => {
    // Ensure AI is disabled
    llmRegistry.disableAI();
    expect(llmRegistry.isAIActive()).toBe(false);

    let statusUpdateCalled = false;
    const result = await agentService.executePlan({
      id: 'q_det_1',
      query: testQuestion,
      timestamp: Date.now(),
      targetRepositoryId: 'f1-test'
    }, {
      onStatusUpdate: () => {
        statusUpdateCalled = true;
      }
    });

    // 1. Fast deterministic retrieval
    expect(result.status).toBe('completed');
    expect(result.executionTimeMs).toBeDefined();
    expect(result.executionTimeMs).toBeLessThan(1000);

    // 2. Search type is deterministic (hybrid_semantic or structural_ast)
    expect(result.searchType).not.toBe('agentic_planned');
    expect(['hybrid_semantic', 'structural_ast', 'lexical']).toContain(result.searchType);

    // 3. No fake agentic investigation or events created
    expect(result.investigation).toBeUndefined();
    expect(result.aiAnswer).toBeUndefined();
    expect(statusUpdateCalled).toBe(false);

    // 4. Findings present with retrieval relevance scores (not artificial 100% confidence)
    expect(result.findings.length).toBeGreaterThan(0);
    for (const finding of result.findings) {
      expect(finding.confidenceScore).toBeDefined();
      expect(finding.confidenceScore).toBeGreaterThan(0);
      expect(finding.confidenceScore).toBeLessThanOrEqual(1.0);
    }

    // 5. Top result is pipeline/predict.py or similar actual prediction location
    const hasPredict = result.findings.some(f => f.location.filePath.includes('predict.py'));
    expect(hasPredict).toBe(true);
  });

  it('TEST 2: WITH AI — Agentic investigation, real operations panel, verified evidence, grounded AI answer', async () => {
    // Register mock provider for reliable deterministic unit testing
    const mockProvider = new MockProvider();
    mockProvider.defaultResponse = `### Answer
The lap prediction model is instantiated and used in \`pipeline/predict.py\` within \`run_race_prediction_pipeline\`.

### Verified Evidence
- \`pipeline/predict.py\`: lines 10-42 (actual prediction inference usage)
- \`models/driver.py\`: lines 1-25 (data definitions only)`;

    llmRegistry.registerProvider('gemini', mockProvider);

    // Activate AI with test credentials
    await llmRegistry.activateAI('gemini', 'valid_test_key', 'mock-model');
    expect(llmRegistry.isAIActive()).toBe(true);

    const receivedStatuses: string[] = [];
    const result = await agentService.executePlan({
      id: 'q_ai_1',
      query: testQuestion,
      timestamp: Date.now(),
      targetRepositoryId: 'f1-test'
    }, {
      onStatusUpdate: (status) => {
        receivedStatuses.push(status);
      }
    });

    // 1. Agentic search mode
    expect(result.status).toBe('completed');
    expect(result.searchType).toBe('agentic_planned');

    // 2. Real investigation panel state & events are populated
    expect(result.investigation).toBeDefined();
    expect(result.investigation?.events).toBeDefined();
    expect(result.investigation!.events!.length).toBeGreaterThanOrEqual(6);

    const eventTypes = result.investigation!.events!.map(e => e.type);
    expect(eventTypes).toContain('UNDERSTANDING');
    expect(eventTypes).toContain('PLANNING');
    expect(eventTypes).toContain('SEARCHING');
    expect(eventTypes).toContain('INSPECTING');
    expect(eventTypes).toContain('FOLLOWING');
    expect(eventTypes).toContain('VERIFYING');
    expect(eventTypes).toContain('COMPLETED');

    // 3. Grounded AI Answer is produced with verified evidence citations
    expect(result.aiAnswer).toBeDefined();
    expect(result.aiAnswer?.isVerified).toBe(true);
    expect(result.aiAnswer?.evidenceFiles.length).toBeGreaterThan(0);
    expect(result.aiAnswer?.evidenceFiles).toContain('pipeline/predict.py');

    // 4. Evidence metrics reflect actual verified counts, not arbitrary 100% confidence
    expect(result.investigation?.evidence.length).toBeGreaterThan(0);
    const verifiedEvidenceCount = result.investigation?.evidence.filter(e => e.verified).length || 0;
    expect(verifiedEvidenceCount).toBeGreaterThan(0);

    // 5. Reset AI back to disabled for clean environment state
    llmRegistry.disableAI();
    expect(llmRegistry.isAIActive()).toBe(false);
  });
});
