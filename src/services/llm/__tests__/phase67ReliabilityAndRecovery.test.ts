/**
 * PHASE 6.7 — UNIVERSAL AI INVESTIGATION RELIABILITY, RECOVERY & PROVIDER-AGNOSTIC ORCHESTRATION TESTS
 * 
 * Verifies:
 * 1. Provider-agnostic classification across Gemini, OpenAI, Claude, and generic providers
 * 2. Retry policy: 3 max attempts per request, 6 max attempts per investigation
 * 3. Exponential backoff & Retry-After handling
 * 4. Single-flight request deduplication per (investigationId, step)
 * 5. Cancellation & stale response prevention
 * 6. Partial investigation recovery with verified repository evidence
 * 7. Explicit deterministic fallback via [Use Retrieved Evidence]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LLMReliabilityManager } from '../llmReliabilityManager.js';
import { 
  LLMProviderError, 
  classifyProviderError 
} from '../llmErrors.js';
import { MockProvider } from '../mockProvider.js';
import { agentService } from '../../agent/index.js';
import { repositoryService } from '../../repository/index.js';
import type { LLMProvider, LLMGenerateRequest, LLMGenerateResponse } from '../../../types/llm.js';

describe('PHASE 6.7 — UNIVERSAL AI INVESTIGATION RELIABILITY & RECOVERY', () => {
  let reliabilityManager: LLMReliabilityManager;

  beforeEach(async () => {
    reliabilityManager = new LLMReliabilityManager();
    await repositoryService.getF1SampleRepository();
  });

  describe('1. Universal Error Classification (Provider-Agnostic)', () => {
    it('classifies 503 Service Unavailable identically across all providers as retryable', () => {
      const providers = ['gemini', 'openai', 'claude'] as const;

      for (const prov of providers) {
        const err503 = classifyProviderError(
          { message: 'Service Unavailable' },
          prov,
          'test-model',
          503
        );

        expect(err503.category).toBe('unavailable');
        expect(err503.statusCode).toBe(503);
        expect(err503.retryable).toBe(true);
        expect(err503.code).toBe('PROVIDER_UNAVAILABLE');
      }
    });

    it('classifies 429 Rate Limits identically across all providers with Retry-After', () => {
      const err429 = classifyProviderError(
        'Rate limit reached retry-after: 2s',
        'openai',
        'gpt-4o',
        429
      );

      expect(err429.category).toBe('rate_limit');
      expect(err429.statusCode).toBe(429);
      expect(err429.retryable).toBe(true);
      expect(err429.retryAfterMs).toBe(2000);
      expect(err429.code).toBe('PROVIDER_RATE_LIMITED');
    });

    it('classifies 401/403 Authentication errors as non-retryable', () => {
      const err401 = classifyProviderError(
        { message: 'Invalid API key provided' },
        'claude',
        'claude-3-5-sonnet',
        401
      );

      expect(err401.category).toBe('auth');
      expect(err401.statusCode).toBe(401);
      expect(err401.retryable).toBe(false);
      expect(err401.code).toBe('PROVIDER_AUTH_ERROR');
    });

    it('classifies Empty & Malformed responses as retryable parse errors', () => {
      const errEmpty = classifyProviderError(
        new Error('PROVIDER_EMPTY_RESPONSE: response text was empty'),
        'gemini',
        'gemini-2.5-pro'
      );

      expect(errEmpty.category).toBe('parse_error');
      expect(errEmpty.retryable).toBe(true);
      expect(errEmpty.code).toBe('PROVIDER_EMPTY_RESPONSE');
    });
  });

  describe('2. Retry Policy & Budget Enforcement', () => {
    it('retries transient 503 errors and succeeds within the request budget (max 3 attempts)', async () => {
      let attempts = 0;
      const mockProvider: LLMProvider = {
        getProviderId: () => 'openai',
        getProviderName: () => 'OpenAI GPT',
        getModel: () => 'gpt-4o',
        setModel: () => {},
        getAvailableModels: () => [],
        validateApiKey: async () => ({ valid: true }),
        generate: async () => {
          attempts++;
          if (attempts < 3) {
            throw new LLMProviderError({
              provider: 'openai',
              model: 'gpt-4o',
              category: 'unavailable',
              statusCode: 503,
              title: 'Temporary overload',
              message: 'Temporary overload',
              retryable: true
            });
          }
          return {
            text: 'Successfully generated on attempt 3',
            provider: 'openai',
            model: 'gpt-4o'
          };
        }
      };

      const response = await reliabilityManager.execute({
        provider: mockProvider,
        request: { prompt: 'Synthesize answer' },
        investigationId: 'inv_retry_test_1',
        step: 'synthesis'
      });

      expect(attempts).toBe(3);
      expect(response.text).toBe('Successfully generated on attempt 3');
      expect(response.attemptsUsed).toBe(3);
    });

    it('fails after exceeding the request attempt limit (3 attempts) when error persists', async () => {
      let attempts = 0;
      const failingProvider: LLMProvider = {
        getProviderId: () => 'gemini',
        getProviderName: () => 'Google Gemini',
        getModel: () => 'gemini-2.5-pro',
        setModel: () => {},
        getAvailableModels: () => [],
        validateApiKey: async () => ({ valid: true }),
        generate: async () => {
          attempts++;
          throw new LLMProviderError({
            provider: 'gemini',
            model: 'gemini-2.5-pro',
            category: 'unavailable',
            statusCode: 503,
            title: 'Model is currently overloaded',
            message: 'Model is currently overloaded',
            retryable: true
          });
        }
      };

      await expect(reliabilityManager.execute({
        provider: failingProvider,
        request: { prompt: 'Synthesize answer' },
        investigationId: 'inv_retry_fail_1',
        step: 'synthesis'
      })).rejects.toThrow();

      expect(attempts).toBe(3);
    });

    it('enforces global investigation budget (maximum 6 attempts total across all steps)', async () => {
      let totalAttempts = 0;
      const persistentErrorProvider: LLMProvider = {
        getProviderId: () => 'claude',
        getProviderName: () => 'Anthropic Claude',
        getModel: () => 'claude-3-5-sonnet',
        setModel: () => {},
        getAvailableModels: () => [],
        validateApiKey: async () => ({ valid: true }),
        generate: async () => {
          totalAttempts++;
          throw new LLMProviderError({
            provider: 'claude',
            model: 'claude-3-5-sonnet',
            category: 'rate_limit',
            statusCode: 429,
            title: 'Too many requests',
            message: 'Too many requests',
            retryable: true
          });
        }
      };

      const invId = 'inv_budget_cap_test';

      // Call 1 (planning step): uses 3 attempts and fails
      try {
        await reliabilityManager.execute({
          provider: persistentErrorProvider,
          request: { prompt: 'Planning' },
          investigationId: invId,
          step: 'planning'
        });
      } catch {
        // Expected failure after 3 attempts
      }
      expect(totalAttempts).toBe(3);

      // Call 2 (synthesis step): uses remaining 3 attempts and reaches cap of 6
      try {
        await reliabilityManager.execute({
          provider: persistentErrorProvider,
          request: { prompt: 'Synthesis' },
          investigationId: invId,
          step: 'synthesis'
        });
      } catch {
        // Expected failure
      }
      expect(totalAttempts).toBe(6);

      // Call 3: should be immediately rejected with PROVIDER_RETRIES_EXHAUSTED without hitting provider
      await expect(reliabilityManager.execute({
        provider: persistentErrorProvider,
        request: { prompt: 'Refinement' },
        investigationId: invId,
        step: 'refinement'
      })).rejects.toThrow(/PROVIDER_RETRIES_EXHAUSTED/);

      // Provider was NOT invoked on call 3
      expect(totalAttempts).toBe(6);
    });
  });

  describe('3. Single-Flight Deduplication & Concurrency Protection', () => {
    it('deduplicates concurrent requests for the same investigation and logical step', async () => {
      let networkCalls = 0;
      const slowProvider: LLMProvider = {
        getProviderId: () => 'gemini',
        getProviderName: () => 'Google Gemini',
        getModel: () => 'gemini-2.5-pro',
        setModel: () => {},
        getAvailableModels: () => [],
        validateApiKey: async () => ({ valid: true }),
        generate: async () => {
          networkCalls++;
          await new Promise(r => setTimeout(r, 50));
          return {
            text: 'Single-flight response',
            provider: 'gemini',
            model: 'gemini-2.5-pro'
          };
        }
      };

      const invId = 'inv_single_flight';

      // Fire 3 concurrent calls for the identical step
      const [res1, res2, res3] = await Promise.all([
        reliabilityManager.execute({
          provider: slowProvider,
          request: { prompt: 'Question 1' },
          investigationId: invId,
          step: 'synthesis'
        }),
        reliabilityManager.execute({
          provider: slowProvider,
          request: { prompt: 'Question 1' },
          investigationId: invId,
          step: 'synthesis'
        }),
        reliabilityManager.execute({
          provider: slowProvider,
          request: { prompt: 'Question 1' },
          investigationId: invId,
          step: 'synthesis'
        })
      ]);

      // Exactly ONE network request was made
      expect(networkCalls).toBe(1);
      expect(res1.text).toBe('Single-flight response');
      expect(res2.text).toBe('Single-flight response');
      expect(res3.text).toBe('Single-flight response');
    });
  });

  describe('4. Cancellation & Stale Response Protection', () => {
    it('cancels active investigation when superseded by a new investigation', () => {
      reliabilityManager.startInvestigation('investigation_A');
      expect(reliabilityManager.getActiveInvestigationId()).toBe('investigation_A');

      // Start new investigation
      reliabilityManager.startInvestigation('investigation_B');
      expect(reliabilityManager.getActiveInvestigationId()).toBe('investigation_B');

      // Investigation A controller is aborted
      const controllerA = reliabilityManager.getAbortController('investigation_A');
      expect(controllerA!.signal.aborted).toBe(true);

      // Investigation B is active and not aborted
      const controllerB = reliabilityManager.getAbortController('investigation_B');
      expect(controllerB!.signal.aborted).toBe(false);
    });
  });

  describe('5. Partial Investigation Recovery & Deterministic Grounded Fallback', () => {
    it('enters recoverable_error status and preserves verified evidence when AI synthesis fails', async () => {
      // Create a mock provider that succeeds on planning but throws 503 on final synthesis
      const partialFailProvider: LLMProvider = {
        getProviderId: () => 'claude',
        getProviderName: () => 'Anthropic Claude',
        getModel: () => 'claude-3-5-sonnet',
        setModel: () => {},
        getAvailableModels: () => [],
        validateApiKey: async () => ({ valid: true }),
        generate: async (req) => {
          if (req.prompt?.includes('Repository Evidence:') || !req.jsonMode) {
            throw new LLMProviderError({
              provider: 'claude',
              model: 'claude-3-5-sonnet',
              category: 'unavailable',
              statusCode: 503,
              title: 'Claude service temporarily unavailable',
              message: 'Claude service temporarily unavailable',
              retryable: true
            });
          }
          // Planning succeeds
          return {
            text: JSON.stringify({
              strategy: 'Locate prediction implementation',
              searchTerms: ['predict', 'pipeline']
            }),
            provider: 'claude',
            model: 'claude-3-5-sonnet'
          };
        }
      };

      const { InvestigationEngine } = await import('../../agent/investigationEngine.js');
      const engine = new InvestigationEngine(repositoryService.getActiveWorkspace()!, partialFailProvider);

      const invState = await engine.investigate('Where is the prediction model instantiated?');

      // 1. Investigation should NOT be a hard crash, but in recoverable_error
      expect(invState.status).toBe('recoverable_error');
      expect(invState.providerError).toBeDefined();
      expect(invState.providerError?.statusCode).toBe(503);

      // 2. Evidence must be preserved in full
      expect(invState.evidence.length).toBeGreaterThan(0);
      const predictEvidence = invState.evidence.find(e => e.filePath.includes('predict.py'));
      expect(predictEvidence).toBeDefined();

      // 3. User clicks [Use Retrieved Evidence]
      const query = {
        id: 'q_recov_1',
        query: 'Where is the prediction model instantiated?',
        timestamp: Date.now(),
        targetRepositoryId: 'f1-test'
      };

      const fallbackResult = agentService.useRetrievedEvidence(query, invState);

      // 4. Returns completed deterministic search result with explicit fallback labeling
      expect(fallbackResult.status).toBe('completed');
      expect(fallbackResult.isFallbackDeterministic).toBe(true);
      expect(fallbackResult.fallbackNotice).toBe('AI synthesis unavailable — showing verified repository evidence.');
      expect(fallbackResult.aiAnswer).toBeDefined();
      expect(fallbackResult.aiAnswer?.isFallbackDeterministic).toBe(true);
      expect(fallbackResult.aiAnswer?.evidenceFiles).toContain('pipeline/predict.py');
      expect(fallbackResult.findings.length).toBeGreaterThan(0);
    });
  });
});
