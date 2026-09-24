/**
 * Google Gemini LLM Provider Implementation
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

export const GEMINI_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Optimal for code intelligence, high accuracy & low latency',
    recommended: true
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro (Preview)',
    description: 'Deep reasoning for complex repository analysis'
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    description: 'Lightweight and fastest response turnaround'
  }
];

export class GeminiProvider implements LLMProvider {
  private model = 'gemini-3.8-flash';

  getProviderId(): LLMProviderType {
    return 'gemini';
  }

  getProviderName(): string {
    return 'Google Gemini';
  }

  getModel(): string {
    return this.model;
  }

  setModel(model: string): void {
    const valid = GEMINI_MODELS.some(m => m.id === model);
    if (valid || model.startsWith('gemini-')) {
      this.model = model;
    } else {
      throw new Error(`Unsupported model '${model}' for Google Gemini`);
    }
  }

  getAvailableModels(): ModelOption[] {
    return GEMINI_MODELS;
  }

  async validateApiKey(apiKey?: string): Promise<ProviderValidationResult> {
    const keyToValidate = apiKey?.trim();
    if (!keyToValidate) {
      return { 
        valid: false, 
        error: 'Google Gemini API key is missing. Please provide a valid Gemini API key.',
        providerName: this.getProviderName()
      };
    }

    // Basic format check for Gemini keys (AIzaSy...)
    if (!keyToValidate.startsWith('AIza') && keyToValidate.length < 20) {
      return {
        valid: false,
        error: 'Invalid Gemini API key format. Expected a standard Google AI Studio key.',
        providerName: this.getProviderName()
      };
    }

    // Attempt live validation via server or direct API call
    try {
      const response = await this.generate({
        prompt: 'Ping: Respond with "OK"',
        maxTokens: 5
      }, keyToValidate);

      if (response && response.text) {
        return { valid: true, model: this.model, providerName: this.getProviderName() };
      }
      return { valid: false, error: 'Received empty response from Gemini API', providerName: this.getProviderName() };
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
          provider: 'gemini',
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
        throw new LLMProviderError(classifyProviderError('REQUEST_ABORTED', 'gemini', this.model, 499, options?.requestId));
      }
      // If running directly in Node test runner or offline fallback without backend server listening:
      return this.generateDirect(request, apiKey, networkOrOfflineErr);
    }

    if (res.ok) {
      const data = await res.json();
      const text = data.text !== undefined ? data.text : (data.response?.text || '');
      if (!text || !text.trim()) {
        throw new LLMProviderError(classifyProviderError('PROVIDER_EMPTY_RESPONSE: empty response from gemini', 'gemini', this.model, 200, options?.requestId));
      }
      return {
        text,
        provider: 'gemini',
        model: data.model || this.model,
        finishReason: data.finishReason || data.response?.finishReason || 'stop',
        usage: data.usage || data.response?.usage
      };
    }

    const errData = await res.json().catch(() => ({}));
    const errorInfo = classifyProviderError(
      errData.error || res.statusText,
      'gemini',
      this.model,
      res.status,
      options?.requestId
    );
    throw new LLMProviderError(errorInfo);
  }

  /**
   * Direct invocation fallback for unit test environments or serverless Node runtimes
   */
  private async generateDirect(request: LLMGenerateRequest, apiKey?: string, priorErr?: unknown): Promise<LLMGenerateResponse> {
    const key = apiKey || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined);
    if (!key) {
      const errorInfo = classifyProviderError(
        priorErr || 'Google Gemini API key is missing',
        'gemini',
        this.model,
        401
      );
      throw new LLMProviderError(errorInfo);
    }

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ 
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      let contents = request.prompt || '';
      if (request.messages && request.messages.length > 0) {
        contents = request.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      }

      const response = await ai.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: request.systemPrompt,
          temperature: request.temperature ?? 0.1,
          maxOutputTokens: request.maxTokens ?? 1024,
          responseMimeType: request.jsonMode ? 'application/json' : undefined
        }
      });

      const responseText = response.text || '';
      if (!responseText.trim()) {
        throw new LLMProviderError(classifyProviderError('PROVIDER_EMPTY_RESPONSE: empty response from gemini', 'gemini', this.model));
      }

      return {
        text: responseText,
        provider: 'gemini',
        model: this.model,
        finishReason: 'stop'
      };
    } catch (directErr) {
      if (directErr instanceof LLMProviderError) {
        throw directErr;
      }
      const errorInfo = classifyProviderError(directErr, 'gemini', this.model);
      throw new LLMProviderError(errorInfo);
    }
  }
}
