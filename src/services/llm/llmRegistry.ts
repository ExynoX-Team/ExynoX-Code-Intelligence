/**
 * LLM Registry & Active Provider Manager
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 * Multi-Provider Abstraction: Google Gemini, OpenAI GPT, Anthropic Claude.
 * Manages in-memory/session API keys and seamless provider switching.
 */

import type { 
  LLMProvider, 
  LLMProviderType, 
  AIConfig, 
  ProviderValidationResult,
  ModelOption 
} from '../../types/llm.js';
import { GeminiProvider } from './geminiProvider.js';
import { OpenAIProvider } from './openaiProvider.js';
import { AnthropicProvider } from './anthropicProvider.js';
import { MockProvider } from './mockProvider.js';

const SESSION_STORAGE_KEY_PREFIX = 'exynox_ai_key_';
const SESSION_STORAGE_CONFIG = 'exynox_ai_config';

export class LLMRegistry {
  private providers: Map<LLMProviderType, LLMProvider> = new Map();
  private activeProviderType: LLMProviderType = 'gemini';
  private inMemoryKeys: Map<LLMProviderType, string> = new Map();
  private aiEnabled = false;
  private hasServerGeminiKey = false;
  private listeners: Set<(config: AIConfig) => void> = new Set();

  constructor() {
    this.providers.set('gemini', new GeminiProvider());
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('claude', new AnthropicProvider());

    this.restoreSession();
    this.checkServerStatus().catch(() => {});
  }

  public getProvider(type?: LLMProviderType): LLMProvider {
    const targetType = type || this.activeProviderType;
    const provider = this.providers.get(targetType);
    if (!provider) {
      throw new Error(`Unsupported LLM provider '${targetType}'`);
    }
    return provider;
  }

  public getActiveProvider(): LLMProvider {
    return this.getProvider(this.activeProviderType);
  }

  public getActiveProviderType(): LLMProviderType {
    return this.activeProviderType;
  }

  public setProvider(type: LLMProviderType, model?: string): void {
    if (!this.providers.has(type)) {
      throw new Error(`Provider '${type}' is not registered`);
    }
    this.activeProviderType = type;
    if (model) {
      this.providers.get(type)!.setModel(model);
    }
    this.persistSession();
    this.notifyListeners();
  }

  public setModel(model: string, type?: LLMProviderType): void {
    const provider = this.getProvider(type);
    provider.setModel(model);
    this.persistSession();
    this.notifyListeners();
  }

  public getAvailableModels(type?: LLMProviderType): ModelOption[] {
    return this.getProvider(type).getAvailableModels();
  }

  /**
   * Set a custom mock provider (useful for unit tests)
   */
  public registerProvider(type: LLMProviderType, provider: LLMProvider): void {
    this.providers.set(type, provider);
  }

  // --------------------------------------------------------------------------
  // API Key & Activation Management
  // --------------------------------------------------------------------------

  public getApiKey(type?: LLMProviderType): string | undefined {
    const targetType = type || this.activeProviderType;
    return this.inMemoryKeys.get(targetType);
  }

  public async activateAI(type: LLMProviderType, apiKey?: string, model?: string): Promise<ProviderValidationResult> {
    const trimmedKey = apiKey?.trim();
    if (!trimmedKey) {
      return {
        valid: false,
        error: 'Enter an API key to activate AI.',
        providerName: this.getProvider(type).getProviderName()
      };
    }

    const provider = this.getProvider(type);
    if (model) {
      provider.setModel(model);
    }
    
    // Check validation
    const validation = await provider.validateApiKey(trimmedKey);
    if (!validation.valid) {
      return {
        valid: false,
        error: validation.error || 'Unable to activate AI. Please check your API key.',
        providerName: provider.getProviderName(),
        model: provider.getModel()
      };
    }

    this.inMemoryKeys.set(type, trimmedKey);
    this.activeProviderType = type;
    this.aiEnabled = true;

    this.persistSession();
    this.notifyListeners();

    return {
      valid: true,
      model: provider.getModel(),
      providerName: provider.getProviderName()
    };
  }

  public removeApiKey(type?: LLMProviderType): void {
    const targetType = type || this.activeProviderType;
    this.inMemoryKeys.delete(targetType);

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(`${SESSION_STORAGE_KEY_PREFIX}${targetType}`);
      } catch {
        // ignore
      }
    }

    // Immediately disable AI session when key is removed
    if (targetType === this.activeProviderType) {
      this.aiEnabled = false;
    }

    this.persistSession();
    this.notifyListeners();
  }

  public isAIActive(): boolean {
    if (!this.aiEnabled) return false;
    const currentKey = this.getApiKey(this.activeProviderType);
    // User API key is strictly required for active AI session
    return !!(currentKey && currentKey.trim().length > 0);
  }

  public disableAI(): void {
    this.aiEnabled = false;
    this.persistSession();
    this.notifyListeners();
  }

  public hasServerGeminiKeyAvailable(): boolean {
    return this.hasServerGeminiKey;
  }

  public setServerGeminiKeyAvailable(available: boolean): void {
    this.hasServerGeminiKey = available;
    this.notifyListeners();
  }

  public getConfig(): AIConfig {
    return {
      enabled: this.isAIActive(),
      provider: this.activeProviderType,
      model: this.getActiveProvider().getModel(),
      apiKey: this.getApiKey(this.activeProviderType),
      hasServerKey: this.hasServerGeminiKey
    };
  }

  public subscribe(listener: (config: AIConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const config = this.getConfig();
    for (const listener of this.listeners) {
      listener(config);
    }
  }

  // --------------------------------------------------------------------------
  // Server Status & Session Persistence
  // --------------------------------------------------------------------------

  private async checkServerStatus(): Promise<void> {
    try {
      if (typeof window === 'undefined') return;
      const res = await fetch('/api/llm/status');
      if (res.ok) {
        const data = await res.json();
        this.hasServerGeminiKey = !!data.hasServerGeminiKey;
        // Server key availability is strictly an informational backend capability indicator.
        // It does NOT automatically activate the user's AI session.
        this.notifyListeners();
      }
    } catch {
      // offline or testing
    }
  }

  private restoreSession(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;

    try {
      // Restore session keys first
      for (const type of ['gemini', 'openai', 'claude'] as LLMProviderType[]) {
        const key = window.sessionStorage.getItem(`${SESSION_STORAGE_KEY_PREFIX}${type}`);
        if (key && key.trim().length > 0) {
          this.inMemoryKeys.set(type, key.trim());
        }
      }

      const savedConfig = window.sessionStorage.getItem(SESSION_STORAGE_CONFIG);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.provider && this.providers.has(parsed.provider)) {
          this.activeProviderType = parsed.provider;
        }
        if (parsed.model) {
          try {
            this.providers.get(this.activeProviderType)?.setModel(parsed.model);
          } catch {
            // ignore
          }
        }
        // Only mark active if user explicitly had an enabled session WITH a valid user key
        const userKey = this.inMemoryKeys.get(this.activeProviderType);
        this.aiEnabled = !!(parsed.enabled && userKey && userKey.trim().length > 0);
      } else {
        this.aiEnabled = false;
      }
    } catch {
      this.aiEnabled = false;
    }
  }

  private persistSession(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;

    try {
      window.sessionStorage.setItem(SESSION_STORAGE_CONFIG, JSON.stringify({
        provider: this.activeProviderType,
        model: this.getActiveProvider().getModel(),
        enabled: this.aiEnabled
      }));

      // Store in-memory keys in sessionStorage so page reloads don't disrupt session
      for (const [type, key] of this.inMemoryKeys.entries()) {
        if (key) {
          window.sessionStorage.setItem(`${SESSION_STORAGE_KEY_PREFIX}${type}`, key);
        }
      }
    } catch {
      // ignore
    }
  }
}

export const llmRegistry = new LLMRegistry();
