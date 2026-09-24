/**
 * Central Universal LLM Reliability & Orchestration Manager
 * Phase 6.7 — Universal AI Investigation Reliability, Recovery & Provider-Agnostic Orchestration
 *
 * Implements:
 * - Centralized common retry policy (Max 3 attempts per request: 1 initial + 2 retries)
 * - Investigation-level budget (Max 6 total LLM calls per investigation)
 * - Bounded exponential backoff with jitter and Retry-After support
 * - Single-flight request deduplication per (investigationId, step)
 * - Multi-investigation concurrency protection with AbortController cancellation
 * - Stale response protection
 * - Universal error classification and response validation
 * - Structured logging without secrets
 * - Comprehensive reliability metrics tracking
 *
 * Provider-agnostic: operates identically for Gemini, OpenAI, Claude, Mock, and future providers.
 */

import type { 
  LLMProvider, 
  LLMGenerateRequest, 
  LLMGenerateResponse, 
  NormalizedLLMResponse,
  LLMReliabilityMetrics,
  UniversalErrorCode
} from '../../types/llm.js';
import { LLMProviderError, classifyProviderError } from './llmErrors.js';

export interface ExecuteOptions {
  provider: LLMProvider;
  request: LLMGenerateRequest;
  apiKey?: string;
  investigationId: string;
  step: 'planning' | 'synthesis' | 'clarification' | 'refinement';
  timeoutMs?: number;
  expectedJson?: boolean;
}

interface ActiveInvestigation {
  id: string;
  abortController: AbortController;
  attemptsUsed: number;
  cancelled: boolean;
  startTime: number;
}

export class LLMReliabilityManager {
  // Hard retry limit: 1 initial + max 2 retries = 3 attempts total
  public static readonly MAX_REQUEST_ATTEMPTS = 3;

  // Investigation budget: max 6 total LLM attempts per investigation
  public static readonly MAX_INVESTIGATION_ATTEMPTS = 6;

  // Default timeout per request (ms)
  public static readonly DEFAULT_TIMEOUT_MS = 20000;

  // Track active investigations and their budgets
  private activeInvestigations = new Map<string, ActiveInvestigation>();
  private currentActiveInvestigationId?: string;

  // Single-flight in-flight request tracking: key = `${investigationId}:${step}`
  private activeFlights = new Map<string, Promise<NormalizedLLMResponse>>();

  // Reliability Metrics (Section 41)
  private metrics = {
    totalInvestigations: 0,
    successfulInvestigations: 0,
    providerFailures: 0,
    retryCount: 0,
    timeoutCount: 0,
    rateLimitCount: 0,
    fallbackCount: 0,
    totalLatencyMs: 0,
    latencies: [] as number[],
    totalAttemptsInSuccess: 0
  };

  /**
   * Starts or registers an investigation session.
   * Cancels any previously active investigation to guarantee stale response protection.
   */
  public startInvestigation(investigationId: string): void {
    if (!investigationId) return;

    // If an existing investigation is running and different, cancel/abort it
    if (this.currentActiveInvestigationId && this.currentActiveInvestigationId !== investigationId) {
      this.cancelInvestigation(this.currentActiveInvestigationId, 'Superseded by new investigation');
    }

    const abortController = new AbortController();
    this.activeInvestigations.set(investigationId, {
      id: investigationId,
      abortController,
      attemptsUsed: 0,
      cancelled: false,
      startTime: Date.now()
    });
    this.currentActiveInvestigationId = investigationId;
    this.metrics.totalInvestigations++;
  }

  /**
   * Returns current active investigation ID.
   */
  public getActiveInvestigationId(): string | undefined {
    return this.currentActiveInvestigationId;
  }

  /**
   * Returns the AbortController for a given investigation session.
   */
  public getAbortController(investigationId: string): AbortController | undefined {
    return this.activeInvestigations.get(investigationId)?.abortController;
  }

  /**
   * Safely cancels an investigation and aborts any in-flight requests.
   */
  public cancelInvestigation(investigationId?: string, reason = 'Investigation cancelled'): void {
    const id = investigationId || this.currentActiveInvestigationId;
    if (!id) return;

    const inv = this.activeInvestigations.get(id);
    if (inv && !inv.cancelled) {
      inv.cancelled = true;
      try {
        inv.abortController.abort(new Error(reason));
      } catch {
        // ignore already aborted
      }
    }

    // Clean up single-flight promises associated with this investigation
    for (const key of Array.from(this.activeFlights.keys())) {
      if (key.startsWith(`${id}:`)) {
        this.activeFlights.delete(key);
      }
    }

    if (this.currentActiveInvestigationId === id) {
      this.currentActiveInvestigationId = undefined;
    }
  }

  /**
   * Checks if an investigation is currently active and not cancelled.
   */
  public isInvestigationActive(investigationId: string): boolean {
    const inv = this.activeInvestigations.get(investigationId);
    return Boolean(inv && !inv.cancelled);
  }

  /**
   * Gets the remaining LLM budget for an investigation.
   */
  public getRemainingBudget(investigationId: string): number {
    const inv = this.activeInvestigations.get(investigationId);
    if (!inv) return LLMReliabilityManager.MAX_INVESTIGATION_ATTEMPTS;
    return Math.max(0, LLMReliabilityManager.MAX_INVESTIGATION_ATTEMPTS - inv.attemptsUsed);
  }

  /**
   * Executes an LLM request under the Universal Reliability Orchestration layer.
   * Enforces single-flight protection, request retry limit, investigation budget,
   * exponential backoff with jitter, abort cancellation, response validation, and logging.
   */
  public async execute(options: ExecuteOptions): Promise<NormalizedLLMResponse> {
    const { provider, request, apiKey, investigationId, step, timeoutMs = LLMReliabilityManager.DEFAULT_TIMEOUT_MS, expectedJson } = options;

    // Single-flight deduplication: return active promise if identical step is already in-flight
    const flightKey = `${investigationId}:${step}`;
    const existingFlight = this.activeFlights.get(flightKey);
    if (existingFlight) {
      return existingFlight;
    }

    const flightPromise = this.executeInternal(options, flightKey);
    this.activeFlights.set(flightKey, flightPromise);

    try {
      return await flightPromise;
    } finally {
      this.activeFlights.delete(flightKey);
    }
  }

  private async executeInternal(options: ExecuteOptions, flightKey: string): Promise<NormalizedLLMResponse> {
    const { provider, request, apiKey, investigationId, step, timeoutMs = LLMReliabilityManager.DEFAULT_TIMEOUT_MS, expectedJson } = options;

    let inv = this.activeInvestigations.get(investigationId);
    if (!inv) {
      this.startInvestigation(investigationId);
      inv = this.activeInvestigations.get(investigationId)!;
    }

    const providerId = provider.getProviderId();
    const model = provider.getModel();

    let attempt = 0;
    let lastError: LLMProviderError | null = null;

    while (attempt < LLMReliabilityManager.MAX_REQUEST_ATTEMPTS) {
      attempt++;

      // Check if investigation was aborted or superseded
      if (inv.cancelled || inv.abortController.signal.aborted) {
        throw new LLMProviderError({
          code: 'REQUEST_ABORTED',
          category: 'unknown',
          provider: providerId,
          model,
          statusCode: 499,
          title: 'Investigation cancelled',
          message: 'The AI investigation was cancelled.',
          retryable: false,
          attempt,
          maxAttempts: LLMReliabilityManager.MAX_REQUEST_ATTEMPTS
        });
      }

      // Check investigation budget (Hard cap: 6 attempts per investigation)
      if (inv.attemptsUsed >= LLMReliabilityManager.MAX_INVESTIGATION_ATTEMPTS) {
        const budgetError = new LLMProviderError({
          code: 'PROVIDER_RETRIES_EXHAUSTED',
          category: 'unknown',
          provider: providerId,
          model,
          statusCode: 429,
          title: 'AI investigation reached its retry limit',
          message: 'PROVIDER_RETRIES_EXHAUSTED: AI investigation reached its retry limit (6 attempts). Preserving verified repository evidence.',
          retryable: false,
          attempt,
          maxAttempts: LLMReliabilityManager.MAX_REQUEST_ATTEMPTS
        });

        console.error(`[LLM] investigation=${investigationId} step=${step} provider=${providerId} model=${model} attempt=${attempt}/${LLMReliabilityManager.MAX_REQUEST_ATTEMPTS} status=429 error=PROVIDER_RETRIES_EXHAUSTED retryable=false`);
        this.metrics.providerFailures++;
        throw budgetError;
      }

      inv.attemptsUsed++;
      const requestId = `req_${investigationId}_${step}_att${attempt}_${Date.now()}`;
      const attemptStartTime = performance.now();

      // Per-attempt timeout and abort controller linked to parent investigation signal
      const attemptController = new AbortController();
      const parentSignal = inv.abortController.signal;

      const abortHandler = () => {
        try { attemptController.abort(parentSignal.reason); } catch {}
      };
      parentSignal.addEventListener('abort', abortHandler);

      const timeoutTimer = setTimeout(() => {
        try { attemptController.abort(new Error(`Timeout after ${timeoutMs}ms`)); } catch {}
      }, timeoutMs);

      try {
        const rawResponse = await provider.generate(request, apiKey, {
          signal: attemptController.signal,
          requestId,
          timeoutMs
        });

        clearTimeout(timeoutTimer);
        parentSignal.removeEventListener('abort', abortHandler);

        // Validate response content
        const validatedText = this.validateResponseContent(rawResponse.text, expectedJson);
        const duration = Math.round(performance.now() - attemptStartTime);

        // Record metrics
        this.metrics.successfulInvestigations++;
        this.metrics.totalLatencyMs += duration;
        this.metrics.latencies.push(duration);
        this.metrics.totalAttemptsInSuccess += attempt;

        // Structured logging on success (no secrets)
        console.log(`[LLM] investigation=${investigationId} step=${step} provider=${providerId} model=${model} attempt=${attempt}/${LLMReliabilityManager.MAX_REQUEST_ATTEMPTS} status=200 durationMs=${duration} success=true`);

        return {
          text: validatedText,
          provider: rawResponse.provider || providerId,
          model: rawResponse.model || model,
          requestId,
          attemptsUsed: attempt,
          finishReason: rawResponse.finishReason || 'stop',
          usage: rawResponse.usage ? {
            inputTokens: rawResponse.usage.promptTokens,
            outputTokens: rawResponse.usage.completionTokens,
            totalTokens: (rawResponse.usage.promptTokens || 0) + (rawResponse.usage.completionTokens || 0)
          } : undefined
        };
      } catch (err: unknown) {
        clearTimeout(timeoutTimer);
        parentSignal.removeEventListener('abort', abortHandler);

        const duration = Math.round(performance.now() - attemptStartTime);
        const errorInfo = classifyProviderError(
          err,
          providerId,
          model,
          undefined,
          requestId,
          attempt
        );
        errorInfo.maxAttempts = LLMReliabilityManager.MAX_REQUEST_ATTEMPTS;

        lastError = new LLMProviderError(errorInfo);

        // Update diagnostic metrics
        if (errorInfo.code === 'PROVIDER_RATE_LIMITED') {
          this.metrics.rateLimitCount++;
        } else if (errorInfo.code === 'PROVIDER_TIMEOUT') {
          this.metrics.timeoutCount++;
        }

        // Check if non-retryable
        if (!errorInfo.retryable || inv.cancelled || parentSignal.aborted) {
          console.error(`[LLM] investigation=${investigationId} step=${step} provider=${providerId} model=${model} attempt=${attempt}/${LLMReliabilityManager.MAX_REQUEST_ATTEMPTS} status=${errorInfo.statusCode || 500} error=${errorInfo.code || 'ERROR'} retryable=false durationMs=${duration}`);
          this.metrics.providerFailures++;
          throw lastError;
        }

        // Check if request attempts exhausted
        if (attempt >= LLMReliabilityManager.MAX_REQUEST_ATTEMPTS) {
          console.error(`[LLM] investigation=${investigationId} step=${step} provider=${providerId} model=${model} attempt=${attempt}/${LLMReliabilityManager.MAX_REQUEST_ATTEMPTS} status=${errorInfo.statusCode || 500} error=${errorInfo.code || 'ERROR'} retryable=false durationMs=${duration}`);
          this.metrics.providerFailures++;
          throw lastError;
        }

        // Check if investigation budget reached
        if (inv.attemptsUsed >= LLMReliabilityManager.MAX_INVESTIGATION_ATTEMPTS) {
          console.error(`[LLM] investigation=${investigationId} step=${step} provider=${providerId} model=${model} attempt=${attempt}/${LLMReliabilityManager.MAX_REQUEST_ATTEMPTS} status=${errorInfo.statusCode || 429} error=LLM_RETRY_BUDGET_EXHAUSTED retryable=false durationMs=${duration}`);
          this.metrics.providerFailures++;
          throw new LLMProviderError({
            ...errorInfo,
            code: 'LLM_RETRY_BUDGET_EXHAUSTED',
            title: 'AI investigation reached its retry limit',
            message: 'AI investigation reached its retry limit (6 attempts). Preserving verified repository evidence.',
            retryable: false
          });
        }

        // Calculate bounded exponential backoff with jitter
        const backoffMs = this.calculateBackoffMs(attempt, errorInfo.retryAfterMs);
        this.metrics.retryCount++;

        console.warn(`[LLM] investigation=${investigationId} step=${step} provider=${providerId} model=${model} attempt=${attempt}/${LLMReliabilityManager.MAX_REQUEST_ATTEMPTS} status=${errorInfo.statusCode || 500} error=${errorInfo.code || 'ERROR'} retryable=true backoffMs=${backoffMs}`);

        // Wait for backoff duration, aborting immediately if investigation is cancelled
        await this.delayWithAbort(backoffMs, inv.abortController.signal);
      }
    }

    throw lastError || new LLMProviderError(classifyProviderError('Unknown retry failure', providerId, model));
  }

  /**
   * Validates response text. Throws PROVIDER_EMPTY_RESPONSE or PROVIDER_MALFORMED_RESPONSE if invalid.
   */
  private validateResponseContent(text: unknown, expectedJson?: boolean): string {
    if (text === null || text === undefined) {
      throw new Error('PROVIDER_EMPTY_RESPONSE: response text was null or undefined');
    }

    const str = String(text).trim();
    if (!str) {
      throw new Error('PROVIDER_EMPTY_RESPONSE: response text was empty or whitespace');
    }

    if (expectedJson) {
      const cleanJson = str.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try {
        JSON.parse(cleanJson);
      } catch (jsonErr) {
        throw new Error(`PROVIDER_MALFORMED_RESPONSE: expected valid JSON structure: ${String(jsonErr)}`);
      }
    }

    return str;
  }

  /**
   * Calculates exponential backoff with jitter:
   * Attempt 1 failure: ~1000–1500ms
   * Attempt 2 failure: ~3000–4000ms
   * Respects Retry-After header up to 8000ms.
   */
  public calculateBackoffMs(attempt: number, retryAfterMs?: number): number {
    const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true');
    if (isTest) {
      return 20 + attempt * 10;
    }

    if (retryAfterMs && retryAfterMs > 0) {
      return Math.min(retryAfterMs, 8000);
    }

    if (attempt === 1) {
      // 1000ms to 1500ms
      return Math.round(1000 + Math.random() * 500);
    }
    // Attempt 2: 3000ms to 4200ms
    return Math.round(3000 + Math.random() * 1200);
  }

  /**
   * Delays execution for specified ms, resolving or rejecting immediately if signal aborts.
   */
  private delayWithAbort(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        return reject(new Error('REQUEST_ABORTED: Investigation was cancelled'));
      }

      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abortHandler);
        resolve();
      }, ms);

      const abortHandler = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abortHandler);
        reject(new Error('REQUEST_ABORTED: Investigation was cancelled'));
      };

      signal.addEventListener('abort', abortHandler, { once: true });
    });
  }

  /**
   * Records a deterministic fallback event when AI synthesis fails and verified evidence is preserved.
   */
  public recordFallback(): void {
    this.metrics.fallbackCount++;
  }

  /**
   * Returns current measured reliability metrics.
   */
  public getMetrics(): LLMReliabilityMetrics {
    const latencies = [...this.metrics.latencies].sort((a, b) => a - b);
    const avgLatency = latencies.length > 0 
      ? Math.round(this.metrics.totalLatencyMs / latencies.length) 
      : 0;
    const p90Latency = latencies.length > 0 
      ? latencies[Math.floor(latencies.length * 0.9)] || latencies[latencies.length - 1] 
      : 0;
    const avgAttempts = this.metrics.successfulInvestigations > 0
      ? Number((this.metrics.totalAttemptsInSuccess / this.metrics.successfulInvestigations).toFixed(2))
      : 0;
    const fallbackRate = this.metrics.totalInvestigations > 0
      ? Number((this.metrics.fallbackCount / this.metrics.totalInvestigations).toFixed(3))
      : 0;

    return {
      totalInvestigations: this.metrics.totalInvestigations,
      successfulInvestigations: this.metrics.successfulInvestigations,
      providerFailures: this.metrics.providerFailures,
      retryCount: this.metrics.retryCount,
      timeoutCount: this.metrics.timeoutCount,
      rateLimitCount: this.metrics.rateLimitCount,
      fallbackCount: this.metrics.fallbackCount,
      averageLatencyMs: avgLatency,
      p90LatencyMs: p90Latency,
      averageAttemptsPerSuccess: avgAttempts,
      deterministicFallbackRate: fallbackRate
    };
  }

  /**
   * Resets metrics (useful between test runs or benchmarks).
   */
  public resetMetrics(): void {
    this.metrics = {
      totalInvestigations: 0,
      successfulInvestigations: 0,
      providerFailures: 0,
      retryCount: 0,
      timeoutCount: 0,
      rateLimitCount: 0,
      fallbackCount: 0,
      totalLatencyMs: 0,
      latencies: [],
      totalAttemptsInSuccess: 0
    };
    this.activeInvestigations.clear();
    this.activeFlights.clear();
    this.currentActiveInvestigationId = undefined;
  }
}

export const llmReliabilityManager = new LLMReliabilityManager();
