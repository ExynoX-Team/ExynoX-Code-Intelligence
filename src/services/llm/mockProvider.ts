/**
 * Mock LLM Provider for unit tests & offline deterministic validation
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 */

import type { 
  LLMProvider, 
  LLMProviderType, 
  ModelOption, 
  LLMGenerateRequest, 
  LLMGenerateResponse, 
  ProviderValidationResult 
} from '../../types/llm.js';

export class MockProvider implements LLMProvider {
  private model = 'mock-model';
  public customResponses: Map<string, string> = new Map();
  public defaultResponse = 'OK';
  public callCount = 0;
  public lastRequest?: LLMGenerateRequest;

  getProviderId(): LLMProviderType {
    return 'gemini';
  }

  getProviderName(): string {
    return 'Mock Provider';
  }

  getModel(): string {
    return this.model;
  }

  setModel(model: string): void {
    this.model = model;
  }

  getAvailableModels(): ModelOption[] {
    return [{ id: 'mock-model', name: 'Mock Model' }];
  }

  async validateApiKey(apiKey?: string): Promise<ProviderValidationResult> {
    if (!apiKey || apiKey === 'invalid_key') {
      return { valid: false, error: 'Invalid API key', providerName: this.getProviderName() };
    }
    return { valid: true, model: this.model, providerName: this.getProviderName() };
  }

  async generate(request: LLMGenerateRequest, apiKey?: string, options?: import('../../types/llm.js').LLMGenerateOptions): Promise<LLMGenerateResponse> {
    if (options?.signal?.aborted) {
      throw new Error('REQUEST_ABORTED');
    }
    this.callCount++;
    this.lastRequest = request;

    const promptText = request.prompt || request.messages?.map(m => m.content).join(' ') || '';

    // Check if custom response registered for prompt pattern
    for (const [pattern, resp] of this.customResponses.entries()) {
      if (promptText.toLowerCase().includes(pattern.toLowerCase())) {
        return {
          text: resp,
          provider: 'gemini',
          model: this.model,
          finishReason: 'stop'
        };
      }
    }

    return {
      text: this.defaultResponse,
      provider: 'gemini',
      model: this.model,
      finishReason: 'stop'
    };
  }
}
