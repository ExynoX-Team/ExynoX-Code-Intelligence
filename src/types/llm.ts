/**
 * Multi-Provider LLM Abstraction Types
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 * Supports Google Gemini, OpenAI GPT, and Anthropic Claude.
 */

export type LLMProviderType = 'gemini' | 'openai' | 'claude';

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  recommended?: boolean;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMGenerateRequest {
  prompt?: string;
  systemPrompt?: string;
  messages?: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMGenerateResponse {
  text: string;
  provider: LLMProviderType;
  model: string;
  finishReason?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface ProviderValidationResult {
  valid: boolean;
  error?: string;
  model?: string;
  providerName?: string;
}

export interface LLMGenerateOptions {
  signal?: AbortSignal;
  requestId?: string;
  timeoutMs?: number;
}

export interface LLMProvider {
  getProviderId(): LLMProviderType;
  getProviderName(): string;
  getModel(): string;
  setModel(model: string): void;
  getAvailableModels(): ModelOption[];
  validateApiKey(apiKey?: string): Promise<ProviderValidationResult>;
  generate(request: LLMGenerateRequest, apiKey?: string, options?: LLMGenerateOptions): Promise<LLMGenerateResponse>;
}

export interface AIConfig {
  enabled: boolean;
  provider: LLMProviderType;
  model: string;
  apiKey?: string; // in-memory/session storage only
  hasServerKey?: boolean; // if server has environment key (e.g. GEMINI_API_KEY)
}

export interface ServerLLMStatus {
  availableProviders: LLMProviderType[];
  hasServerGeminiKey: boolean;
  defaultProvider: LLMProviderType;
  defaultModel: string;
}

export type UniversalErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_AUTH_ERROR'
  | 'PROVIDER_PERMISSION_ERROR'
  | 'PROVIDER_BAD_REQUEST'
  | 'PROVIDER_NOT_FOUND'
  | 'PROVIDER_MODEL_UNAVAILABLE'
  | 'PROVIDER_BILLING_ERROR'
  | 'PROVIDER_EMPTY_RESPONSE'
  | 'PROVIDER_MALFORMED_RESPONSE'
  | 'NETWORK_ERROR'
  | 'REQUEST_ABORTED'
  | 'REQUEST_CONFLICT'
  | 'AGENT_ITERATION_LIMIT'
  | 'LLM_RETRY_BUDGET_EXHAUSTED'
  | 'PROVIDER_RETRIES_EXHAUSTED'
  | 'TOOL_EXECUTION_ERROR'
  | 'UNKNOWN_ERROR';

export type LLMErrorCategory = 
  | 'unavailable'
  | 'auth'
  | 'rate_limit'
  | 'timeout'
  | 'network'
  | 'bad_request'
  | 'parse_error'
  | 'unknown';

export interface LLMProviderErrorInfo {
  code?: UniversalErrorCode;
  category: LLMErrorCategory;
  provider: LLMProviderType | string;
  model: string;
  statusCode?: number;
  title: string;
  message: string;
  rawMessage?: string;
  retryable: boolean;
  requestId?: string;
  attempt?: number;
  maxAttempts?: number;
  retryAfterMs?: number;
}

export interface NormalizedLLMResponse {
  text: string;
  provider: string;
  model: string;
  requestId?: string;
  attemptsUsed?: number;
  finishReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export interface LLMReliabilityMetrics {
  totalInvestigations: number;
  successfulInvestigations: number;
  providerFailures: number;
  retryCount: number;
  timeoutCount: number;
  rateLimitCount: number;
  fallbackCount: number;
  averageLatencyMs: number;
  p90LatencyMs: number;
  averageAttemptsPerSuccess: number;
  deterministicFallbackRate: number;
}
