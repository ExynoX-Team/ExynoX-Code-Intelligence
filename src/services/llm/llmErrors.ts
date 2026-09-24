/**
 * LLM Provider Error Handling & Universal Classification
 * Phase 6.7 — Universal AI Investigation Reliability, Recovery & Provider-Agnostic Orchestration
 * Supports Google Gemini, OpenAI GPT, Anthropic Claude, and future providers.
 */

import type { 
  LLMProviderType,
  LLMErrorCategory,
  LLMProviderErrorInfo,
  UniversalErrorCode
} from '../../types/llm.js';

export class LLMProviderError extends Error {
  public readonly info: LLMProviderErrorInfo;

  constructor(info: LLMProviderErrorInfo) {
    super(info.message);
    this.name = 'LLMProviderError';
    this.info = info;
  }
}

/**
 * Extracts and cleans raw error representations, stripping raw JSON braces for UI safety.
 * Never leaks API keys or secrets.
 */
export function sanitizeRawError(raw: unknown): string {
  if (!raw) return '';
  let str = raw instanceof Error ? raw.message : String(raw);
  
  // Strip potential keys or bearer tokens
  str = str.replace(/(?:AIza[0-9A-Za-z-_]{35}|sk-[a-zA-Z0-9]{32,}|Bearer\s+[a-zA-Z0-9._-]+)/g, '[REDACTED_SECRET]');

  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === 'object') {
      if (parsed.error && typeof parsed.error === 'object' && parsed.error.message) {
        return String(parsed.error.message);
      }
      if (parsed.error && typeof parsed.error === 'string') {
        return parsed.error;
      }
      if (parsed.message && typeof parsed.message === 'string') {
        return parsed.message;
      }
    }
  } catch {
    // not JSON
  }
  return str;
}

/**
 * Extracts Retry-After duration in milliseconds if provided by the provider header or error message.
 */
export function extractRetryAfter(err: unknown, headers?: Headers | Record<string, string | undefined>): number | undefined {
  if (headers) {
    const headerVal = 'get' in headers && typeof headers.get === 'function' 
      ? headers.get('retry-after') 
      : (headers as Record<string, string | undefined>)['retry-after'] || (headers as Record<string, string | undefined>)['Retry-After'];
    
    if (headerVal) {
      const sec = Number(headerVal);
      if (!isNaN(sec) && sec > 0) {
        return Math.min(sec * 1000, 10000); // capped at 10s max
      }
    }
  }

  const rawStr = err instanceof Error ? err.message : String(err || '');
  const match = rawStr.match(/retry(?:-after|\s+in|\s+after)?\s*[:=]?\s*(\d+)(?:\s*(s|sec|seconds|ms|millis))?/i);
  if (match) {
    const num = parseInt(match[1], 10);
    const unit = match[2]?.toLowerCase();
    if (unit === 'ms' || unit === 'millis') {
      return Math.min(num, 10000);
    }
    return Math.min(num * 1000, 10000);
  }

  return undefined;
}

/**
 * Normalizes any error, status code, or message into the Universal Error Model.
 */
export function classifyProviderError(
  err: unknown,
  provider: LLMProviderType | string,
  model: string,
  statusCode?: number,
  requestId?: string,
  attempt?: number
): LLMProviderErrorInfo {
  if (err instanceof LLMProviderError && err.info) {
    return {
      ...err.info,
      provider: provider || err.info.provider,
      model: model || err.info.model,
      requestId: requestId || err.info.requestId,
      attempt: attempt || err.info.attempt
    };
  }

  const rawStr = sanitizeRawError(err);
  const lower = rawStr.toLowerCase();
  const retryAfterMs = extractRetryAfter(err);

  // 1. Aborted / Cancelled
  if (
    lower.includes('abort') || 
    lower.includes('aborted') || 
    lower.includes('cancelled') || 
    lower.includes('canceled')
  ) {
    return {
      code: 'REQUEST_ABORTED',
      category: 'unknown',
      provider,
      model,
      statusCode: 499,
      title: 'Investigation cancelled',
      message: 'The AI request was cancelled.',
      rawMessage: rawStr,
      retryable: false,
      requestId,
      attempt
    };
  }

  // 2. Retry Budget Exhausted
  if (
    lower.includes('retry budget exhausted') || 
    lower.includes('retry limit reached') || 
    lower.includes('budget_exhausted')
  ) {
    return {
      code: 'LLM_RETRY_BUDGET_EXHAUSTED',
      category: 'unknown',
      provider,
      model,
      statusCode: 429,
      title: 'AI investigation reached its retry limit',
      message: 'AI investigation reached its retry limit. Showing verified repository evidence where available.',
      rawMessage: rawStr,
      retryable: false,
      requestId,
      attempt
    };
  }

  // 3. Rate Limit / Quota (HTTP 429)
  if (
    statusCode === 429 ||
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('too many requests')
  ) {
    return {
      code: 'PROVIDER_RATE_LIMITED',
      category: 'rate_limit',
      provider,
      model,
      statusCode: 429,
      title: 'AI provider rate limit reached',
      message: 'AI provider rate limit reached. Please try again in a moment or choose another provider/model.',
      rawMessage: rawStr,
      retryable: true,
      requestId,
      attempt,
      retryAfterMs
    };
  }

  // 4. Provider Unavailable / Overloaded / Server Error (HTTP 500, 502, 503)
  if (
    statusCode === 503 ||
    statusCode === 500 ||
    statusCode === 502 ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('500') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('bad gateway') ||
    lower.includes('temporarily unavailable')
  ) {
    return {
      code: 'PROVIDER_UNAVAILABLE',
      category: 'unavailable',
      provider,
      model,
      statusCode: statusCode === 500 ? 500 : (statusCode === 502 ? 502 : 503),
      title: 'AI provider is temporarily unavailable',
      message: 'The AI provider is temporarily unavailable or experiencing high demand. Please try again in a moment.',
      rawMessage: rawStr,
      retryable: true,
      requestId,
      attempt,
      retryAfterMs
    };
  }

  // 5. Timeout (HTTP 504 or network timeout)
  if (
    statusCode === 504 ||
    lower.includes('504') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('gateway timeout') ||
    lower.includes('etimedout')
  ) {
    return {
      code: 'PROVIDER_TIMEOUT',
      category: 'timeout',
      provider,
      model,
      statusCode: 504,
      title: 'AI provider did not respond in time',
      message: 'AI provider did not respond in time. Request timed out.',
      rawMessage: rawStr,
      retryable: true,
      requestId,
      attempt
    };
  }

  // 6. Auth Error (HTTP 401)
  if (
    statusCode === 401 ||
    lower.includes('401') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid api key') ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key is missing')
  ) {
    return {
      code: 'PROVIDER_AUTH_ERROR',
      category: 'auth',
      provider,
      model,
      statusCode: 401,
      title: 'The API key was rejected by the provider',
      message: 'The API key was rejected by the provider. Please verify your API key in AI Configuration.',
      rawMessage: rawStr,
      retryable: false,
      requestId,
      attempt
    };
  }

  // 7. Permission Error (HTTP 403)
  if (
    statusCode === 403 ||
    lower.includes('403') ||
    lower.includes('forbidden') ||
    lower.includes('permission_denied') ||
    lower.includes('permission denied')
  ) {
    return {
      code: 'PROVIDER_PERMISSION_ERROR',
      category: 'auth',
      provider,
      model,
      statusCode: 403,
      title: 'Provider permission error',
      message: 'Your account does not have permission to access the requested model or feature.',
      rawMessage: rawStr,
      retryable: false,
      requestId,
      attempt
    };
  }

  // 8. Billing / Account Error (HTTP 402)
  if (
    statusCode === 402 ||
    lower.includes('402') ||
    lower.includes('billing') ||
    lower.includes('insufficient_quota') ||
    lower.includes('credit')
  ) {
    return {
      code: 'PROVIDER_BILLING_ERROR',
      category: 'unknown',
      provider,
      model,
      statusCode: 402,
      title: 'Provider billing error',
      message: 'The AI provider account has a billing or balance issue. Please check your provider account.',
      rawMessage: rawStr,
      retryable: false,
      requestId,
      attempt
    };
  }

  // 9. Model Unavailable / Not Found (HTTP 404)
  if (
    statusCode === 404 ||
    lower.includes('404') ||
    lower.includes('model not found') ||
    lower.includes('unsupported model') ||
    lower.includes('invalid model') ||
    lower.includes('does not exist')
  ) {
    return {
      code: 'PROVIDER_MODEL_UNAVAILABLE',
      category: 'unknown',
      provider,
      model,
      statusCode: 404,
      title: 'The selected model is unavailable',
      message: `The selected model '${model}' is unavailable for provider '${provider}'.`,
      rawMessage: rawStr,
      retryable: false,
      requestId,
      attempt
    };
  }

  // 10. Bad Request (HTTP 400)
  if (
    statusCode === 400 ||
    lower.includes('400') ||
    lower.includes('bad request') ||
    lower.includes('invalid_argument') ||
    lower.includes('invalid argument')
  ) {
    return {
      code: 'PROVIDER_BAD_REQUEST',
      category: 'bad_request',
      provider,
      model,
      statusCode: 400,
      title: 'Invalid request sent to AI provider',
      message: 'The AI request format or parameters were rejected by the provider.',
      rawMessage: rawStr,
      retryable: false,
      requestId,
      attempt
    };
  }

  // 11. Empty Response
  if (
    lower.includes('empty response') ||
    lower.includes('empty_response') ||
    lower.includes('no content') ||
    lower.includes('empty text') ||
    lower.includes('response text was empty') ||
    lower.includes('empty')
  ) {
    return {
      code: 'PROVIDER_EMPTY_RESPONSE',
      category: 'parse_error',
      provider,
      model,
      title: 'The AI provider returned an empty response',
      message: 'The AI provider returned an empty response.',
      rawMessage: rawStr,
      retryable: true,
      requestId,
      attempt
    };
  }

  // 12. Malformed Response
  if (
    lower.includes('malformed') ||
    lower.includes('malformed_response') ||
    lower.includes('invalid json') ||
    lower.includes('syntaxerror')
  ) {
    return {
      code: 'PROVIDER_MALFORMED_RESPONSE',
      category: 'parse_error',
      provider,
      model,
      title: 'The AI provider returned an invalid response',
      message: 'The AI provider returned an invalid response.',
      rawMessage: rawStr,
      retryable: true,
      requestId,
      attempt
    };
  }

  // 13. Network Error
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('network error')
  ) {
    return {
      code: 'NETWORK_ERROR',
      category: 'network',
      provider,
      model,
      title: 'Unable to reach the AI provider',
      message: 'Unable to reach the AI provider. Please check your network connection.',
      rawMessage: rawStr,
      retryable: true,
      requestId,
      attempt
    };
  }

  // 14. Unknown Error Fallback
  return {
    code: 'UNKNOWN_ERROR',
    category: 'unknown',
    provider,
    model,
    statusCode,
    title: 'AI investigation encountered an unexpected error',
    message: 'AI investigation encountered an unexpected error. Please try again.',
    rawMessage: rawStr,
    retryable: true,
    requestId,
    attempt
  };
}
