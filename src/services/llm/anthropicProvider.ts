/**
 * Anthropic Claude LLM Provider Implementation
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 * Normalized behind LLMProvider interface.
 */

import type { 
  LLMProvider, 
  LLMProviderType, 
  ModelOption, 
  LLMGenerateRequest, 
  LLMGenerateResponse, 
  ProviderValidationResult 
} from '../../types/llm.js';
import { classifyProviderError, LLMProviderError } from './llmErrors.js';

export const ANTHROPIC_MODELS: ModelOption[] = [
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description: 'State of the art reasoning & code investigation',
    recommended: true
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    description: 'Fast, highly responsive code analysis'
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: 'Deep analytical synthesis for large investigations'
  }
];

export class AnthropicProvider implements LLMProvider {
  private model = 'claude-3-5-sonnet-20241022';

  getProviderId(): LLMProviderType {
    return 'claude';
  }

  getProviderName(): string {
    return 'Anthropic Claude';
  }

  getModel(): string {
    return this.model;
  }

  setModel(model: string): void {
    const valid = ANTHROPIC_MODELS.some(m => m.id === model);
    if (valid || model.startsWith('claude-')) {
      this.model = model;
    } else {
      throw new Error(`Unsupported model '${model}' for Anthropic Claude`);
    }
  }

  getAvailableModels(): ModelOption[] {
    return ANTHROPIC_MODELS;
  }

  async validateApiKey(apiKey?: string): Promise<ProviderValidationResult> {
    const keyToValidate = apiKey?.trim();
    if (!keyToValidate) {
      return { 
        valid: false, 
        error: 'Anthropic Claude API key is missing. Please provide a valid key (sk-ant-...).',
        providerName: this.getProviderName()
      };
    }

    if (!keyToValidate.startsWith('sk-ant-') || keyToValidate.length < 20) {
      return {
        valid: false,
        error: 'Invalid Anthropic API key format. Expected key starting with "sk-ant-".',
        providerName: this.getProviderName()
      };
    }

    try {
      const response = await this.generate({
        prompt: 'Ping: Respond with "OK"',
        maxTokens: 5
      }, keyToValidate);

      if (response && response.text) {
        return { valid: true, model: this.model, providerName: this.getProviderName() };
      }
      return { valid: false, error: 'Received empty response from Claude API', providerName: this.getProviderName() };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { valid: false, error: msg, providerName: this.getProviderName() };
    }
  }

  async generate(request: LLMGenerateRequest, apiKey?: string, options?: import('../../types/llm.js').LLMGenerateOptions): Promise<LLMGenerateResponse> {
    let res: Response;
    try {
      res = await fetch('/api/llm/generate', {
        method: 'POST',
        signal: options?.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {})
        },
        body: JSON.stringify({
          provider: 'claude',
          model: this.model,
          prompt: request.prompt,
          systemPrompt: request.systemPrompt,
          messages: request.messages,
          temperature: request.temperature ?? 0.1,
          maxTokens: request.maxTokens ?? 1024,
          jsonMode: request.jsonMode ?? false,
          requestId: options?.requestId
        })
      });
    } catch (networkOrOfflineErr) {
      if (options?.signal?.aborted) {
        throw new LLMProviderError(classifyProviderError('REQUEST_ABORTED', 'claude', this.model, 499, options?.requestId));
      }
      return this.generateDirect(request, apiKey, networkOrOfflineErr);
    }

    if (res.ok) {
      const data = await res.json();
      const text = data.text !== undefined ? data.text : (data.response?.text || '');
      if (!text || !text.trim()) {
        throw new LLMProviderError(classifyProviderError('PROVIDER_EMPTY_RESPONSE: empty response from claude', 'claude', this.model, 200, options?.requestId));
      }
      return {
        text,
        provider: 'claude',
        model: data.model || this.model,
        finishReason: data.finishReason || data.response?.finishReason || 'stop',
        usage: data.usage || data.response?.usage
      };
    }

    const errData = await res.json().catch(() => ({}));
    const errorInfo = classifyProviderError(
      errData.error || res.statusText,
      'claude',
      this.model,
      res.status,
      options?.requestId
    );
    throw new LLMProviderError(errorInfo);
  }

  private async generateDirect(request: LLMGenerateRequest, apiKey?: string, priorErr?: unknown): Promise<LLMGenerateResponse> {
    const key = apiKey || (typeof process !== 'undefined' ? process.env?.ANTHROPIC_API_KEY : undefined);
    if (!key) {
      const errorInfo = classifyProviderError(
        priorErr || 'Anthropic Claude API key is missing',
        'claude',
        this.model,
        401
      );
      throw new LLMProviderError(errorInfo);
    }

    const messages: { role: 'user' | 'assistant'; content: string }[] = [];
    if (request.messages && request.messages.length > 0) {
      for (const m of request.messages) {
        if (m.role === 'system') continue;
        messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
      }
    } else if (request.prompt) {
      messages.push({ role: 'user', content: request.prompt });
    }

    const systemPrompt = request.systemPrompt || request.messages?.find(m => m.role === 'system')?.content;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          system: systemPrompt,
          temperature: request.temperature ?? 0.1,
          max_tokens: request.maxTokens ?? 1024
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const errorInfo = classifyProviderError(
          err?.error?.message || response.statusText,
          'claude',
          this.model,
          response.status
        );
        throw new LLMProviderError(errorInfo);
      }

      const data = await response.json();
      const text = Array.isArray(data.content)
        ? data.content.map((c: { type: string; text?: string }) => c.text || '').join('')
        : (data.content || '');

      return {
        text,
        provider: 'claude',
        model: this.model,
        finishReason: data.stop_reason || 'stop',
        usage: {
          promptTokens: data.usage?.input_tokens,
          completionTokens: data.usage?.output_tokens
        }
      };
    } catch (directErr) {
      if (directErr instanceof LLMProviderError) {
        throw directErr;
      }
      const errorInfo = classifyProviderError(directErr, 'claude', this.model);
      throw new LLMProviderError(errorInfo);
    }
  }
}
