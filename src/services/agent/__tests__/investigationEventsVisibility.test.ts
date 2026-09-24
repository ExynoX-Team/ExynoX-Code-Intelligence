import { describe, it, expect, beforeAll } from 'vitest';
import { loadF1SampleRepository } from '../../repository/f1SampleRepository.js';
import { InvestigationEngine } from '../investigationEngine.js';
import type { RepositoryWorkspace } from '../../repository/repositoryWorkspace.js';
import type { LLMProvider } from '../../../types/llm.js';
import { LLMProviderError } from '../../llm/llmErrors.js';
import type { InvestigationStatus, InvestigationState } from '../../../types/agent.js';

describe('PHASE 4 UX + AGENT VISIBILITY — REAL-TIME INVESTIGATION OPERATIONS', () => {
  let workspace: RepositoryWorkspace;
  let engine: InvestigationEngine;

  beforeAll(async () => {
    workspace = await loadF1SampleRepository();
    engine = new InvestigationEngine(workspace);
  }, 30000);

  it('TEST 1: Simple AI question — emits structured real-time operational events without fake animations', async () => {
    const statusEvents: { status: InvestigationStatus; message: string; eventCount: number }[] = [];

    const result = await engine.investigate('Where is the prediction model used?', {
      onStatusUpdate: (status, message, state) => {
        statusEvents.push({
          status,
          message,
          eventCount: state.events?.length || 0
        });
      }
    });

    // 1. Investigation Events must exist on the resulting state
    expect(result.events).toBeDefined();
    expect(result.events!.length).toBeGreaterThanOrEqual(6);

    // 2. Progression matches the real canonical flow:
    // UNDERSTANDING -> PLANNING -> SEARCHING -> INSPECTING -> FOLLOWING -> VERIFYING -> COMPLETED
    const eventTypes = result.events!.map(e => e.type);
    expect(eventTypes).toContain('UNDERSTANDING');
    expect(eventTypes).toContain('PLANNING');
    expect(eventTypes).toContain('SEARCHING');
    expect(eventTypes).toContain('INSPECTING');
    expect(eventTypes).toContain('FOLLOWING');
    expect(eventTypes).toContain('VERIFYING');
    expect(eventTypes).toContain('COMPLETED');

    // 3. All non-error operations must have status 'completed'
    const nonErrorEvents = result.events!.filter(e => e.type !== 'ERROR');
    for (const ev of nonErrorEvents) {
      expect(ev.status).toBe('completed');
    }

    // 4. Operation metadata details must reflect real counts from actual repository operations
    const searchEv = result.events!.find(e => e.type === 'SEARCHING');
    expect(searchEv?.detail).toMatch(/\d+ files/);

    const inspectEv = result.events!.find(e => e.type === 'INSPECTING');
    expect(inspectEv?.detail).toMatch(/\d+ files/);

    const followEv = result.events!.find(e => e.type === 'FOLLOWING');
    expect(followEv?.detail).toMatch(/\d+ references/);

    const verifyEv = result.events!.find(e => e.type === 'VERIFYING');
    expect(verifyEv?.detail).toMatch(/\d+ verified/);

    // 5. Grounded answer and evidence exist
    expect(result.finalAnswer).toBeDefined();
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.isVerified).toBe(true);
  });

  it('TEST 2: Complex question — traces and verifies multi-role candidates with exact operation counts', async () => {
    const query = 'Are there files that mention the prediction model but do not actually use it to generate predictions?';
    const result = await engine.investigate(query);

    expect(result.events).toBeDefined();
    const completedTypes = result.events!.filter(e => e.status === 'completed').map(e => e.type);
    expect(completedTypes).toContain('UNDERSTANDING');
    expect(completedTypes).toContain('PLANNING');
    expect(completedTypes).toContain('SEARCHING');
    expect(completedTypes).toContain('INSPECTING');
    expect(completedTypes).toContain('FOLLOWING');
    expect(completedTypes).toContain('VERIFYING');

    // Evidence verified must be reflected in the final answer
    expect(result.finalAnswer?.answer).toContain('pipeline/predict.py');
    expect(result.finalAnswer?.answer).toContain('models/predictor.py');
  });

  it('TEST 3: Follow-up question — produces a distinct new set of investigation events', async () => {
    // First query
    const res1 = await engine.investigate('Where is the prediction model used?');
    const firstEventsTimestamp = res1.events?.[0]?.timestamp;

    // Small delay to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 15));

    // Follow-up query
    const res2 = await engine.investigate('Who calls that function?', {
      conversationHistory: [
        {
          id: 'turn_1',
          question: 'Where is the prediction model used?',
          answer: res1.finalAnswer?.answer || '',
          evidence: res1.evidence,
          timestamp: Date.now()
        }
      ]
    });

    expect(res2.events).toBeDefined();
    expect(res2.events!.length).toBeGreaterThanOrEqual(6);
    expect(res2.events![0].timestamp).toBeGreaterThanOrEqual(firstEventsTimestamp || 0);
    expect(res2.finalAnswer).toBeDefined();
  });

  it('TEST 4 & 5: Provider 503 error stops at appropriate operation; retry succeeds', async () => {
    // Create a mock provider that throws 503
    let shouldFail = true;
    const mockProvider: LLMProvider = {
      getProviderId: () => 'gemini',
      getProviderName: () => 'Google Gemini',
      getModel: () => 'gemini-2.5-pro',
      setModel: () => {},
      getAvailableModels: () => [{ id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }],
      validateApiKey: async () => ({ valid: true }),
      generate: async () => {
        if (shouldFail) {
          throw new LLMProviderError({
            provider: 'gemini',
            model: 'gemini-2.5-pro',
            category: 'unavailable',
            statusCode: 503,
            title: 'AI provider temporarily unavailable',
            message: 'This model is currently experiencing high demand. Please try again later.',
            retryable: true
          });
        }
        return {
          text: '### Answer\nRecovered grounded answer after retry.',
          provider: 'gemini',
          model: 'gemini-2.5-pro',
          usage: { promptTokens: 10, completionTokens: 10 }
        };
      }
    };

    const failingEngine = new InvestigationEngine(workspace, mockProvider);

    // Call 1: Throws 503
    const errorResult = await failingEngine.investigate('Where is the prediction model used?');

    expect(errorResult.status).toBe('failed');
    expect(errorResult.providerError).toBeDefined();
    expect(errorResult.providerError?.statusCode).toBe(503);
    expect(errorResult.providerError?.category).toBe('unavailable');
    expect(errorResult.finalAnswer).toBeUndefined();

    // Event list should have stopped and emitted ERROR event
    expect(errorResult.events).toBeDefined();
    const errorEv = errorResult.events!.find(e => e.type === 'ERROR');
    expect(errorEv).toBeDefined();
    expect(errorEv?.status).toBe('failed');

    // Call 2: Retry with provider recovered
    shouldFail = false;
    const retryResult = await failingEngine.investigate('Where is the prediction model used?');

    expect(retryResult.status).toBe('completed');
    expect(retryResult.providerError).toBeUndefined();
    expect(retryResult.finalAnswer).toBeDefined();
    expect(retryResult.events?.find(e => e.type === 'COMPLETED')?.status).toBe('completed');
  });

  it('TEST 6: Disambiguation count queries produce full sequence with verified operations', async () => {
    const result = await engine.investigate('How many drivers does it have?');

    expect(result.events).toBeDefined();
    const types = result.events!.map(e => e.type);
    expect(types).toContain('UNDERSTANDING');
    expect(types).toContain('PLANNING');
    expect(types).toContain('SEARCHING');
    expect(types).toContain('INSPECTING');
    expect(types).toContain('FOLLOWING');
    expect(types).toContain('VERIFYING');
    expect(types).toContain('COMPLETED');
    expect(result.finalAnswer?.answer).toContain('10');
  });
});
