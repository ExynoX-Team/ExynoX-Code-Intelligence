/**
 * OpenAI GPT LLM Provider Implementation
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

export const OPENAI_MODELS: ModelOption[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'High intelligence flagship model for multi-step repository investigation',
    recommended: true
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast, lightweight and cost-effective code analysis'
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'High context window prior generation flagship'
  }
];

export class OpenAIProvider implements LLMProvider {
  private model = 'gpt-4o';

  getProviderId(): LLMProviderType {
    return 'openai';
  }

  getProviderName(): string {
    return 'OpenAI GPT';
  }

  getModel(): string {
    return this.model;
  }

  setModel(model: string): void {
    const valid = OPENAI_MODELS.some(m => m.id === model);
    if (valid || model.startsWith('gpt-')) {
      this.model = model;
    } else {
      throw new Error(`Unsupported model '${model}' for OpenAI`);
    }
  }

  getAvailableModels(): ModelOption[] {
    return OPENAI_MODELS;
  }

  async validateApiKey(apiKey?: string): Promise<ProviderValidationResult> {
    const keyToValidate = apiKey?.trim();
    if (!keyToValidate) {
      return { 
        valid: false, 
        error: 'OpenAI API key is missing. Please provide a valid OpenAI key (sk-...).',
        providerName: this.getProviderName()
      };
    }

    if (!keyToValidate.startsWith('sk-') || keyToValidate.length < 20) {
      return {
        valid: false,
        error: 'Invalid OpenAI API key format. Expected key starting with "sk-".',
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
      return { valid: false, error: 'Received empty response from OpenAI', providerName: this.getProviderName() };
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
          provider: 'openai',
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
        throw new LLMProviderError(classifyProviderError('REQUEST_ABORTED', 'openai', this.model, 499, options?.requestId));
      }
      return this.generateDirect(request, apiKey, networkOrOfflineErr);
    }

    if (res.ok) {
      const data = await res.json();
      const text = data.text !== undefined ? data.text : (data.response?.text || '');
      if (!text || !text.trim()) {
        throw new LLMProviderError(classifyProviderError('PROVIDER_EMPTY_RESPONSE: empty response from openai', 'openai', this.model, 200, options?.requestId));
      }
      return {
        text,
        provider: 'openai',
        model: data.model || this.model,
        finishReason: data.finishReason || data.response?.finishReason || 'stop',
        usage: data.usage || data.response?.usage
      };
    }

    const errData = await res.json().catch(() => ({}));
    const errorInfo = classifyProviderError(
      errData.error || res.statusText,
      'openai',
      this.model,
      res.status,
      options?.requestId
    );
    throw new LLMProviderError(errorInfo);
  }

  private async generateDirect(request: LLMGenerateRequest, apiKey?: string, priorErr?: unknown): Promise<LLMGenerateResponse> {
    const key = apiKey || (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : undefined);
    if (!key) {
      const errorInfo = classifyProviderError(
        priorErr || 'OpenAI API key is missing',
        'openai',
        this.model,
        401
      );
      throw new LLMProviderError(errorInfo);
    }

    const messages: { role: string; content: string }[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    if (request.messages && request.messages.length > 0) {
      messages.push(...request.messages);
    } else if (request.prompt) {
      messages.push({ role: 'user', content: request.prompt });
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: request.temperature ?? 0.1,
          max_tokens: request.maxTokens ?? 1024,
          response_format: request.jsonMode ? { type: 'json_object' } : undefined
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const errorInfo = classifyProviderError(
          err?.error?.message || response.statusText,
          'openai',
          this.model,
          response.status
        );
        throw new LLMProviderError(errorInfo);
      }

      const data = await response.json();
      return {
        text: data.choices?.[0]?.message?.content || '',
        provider: 'openai',
        model: this.model,
        finishReason: data.choices?.[0]?.finish_reason || 'stop',
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens
        }
      };
    } catch (directErr) {
      if (directErr instanceof LLMProviderError) {
        throw directErr;
      }
      const errorInfo = classifyProviderError(directErr, 'openai', this.model);
      throw new LLMProviderError(errorInfo);
    }
  }
}
