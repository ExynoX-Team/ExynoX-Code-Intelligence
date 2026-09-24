import { describe, it, expect, beforeEach } from 'vitest';
import { llmRegistry } from '../index.js';
import { MockProvider } from '../mockProvider.js';

describe('LLM Registry and Configuration Suite', () => {
  beforeEach(() => {
    llmRegistry.disableAI();
    llmRegistry.removeApiKey('gemini');
    llmRegistry.removeApiKey('openai');
    llmRegistry.removeApiKey('claude');
    llmRegistry.setServerGeminiKeyAvailable(false);
  });

  it('provides the correct available models for each provider', () => {
    const geminiModels = llmRegistry.getAvailableModels('gemini');
    expect(geminiModels.length).toBeGreaterThanOrEqual(3);
    expect(geminiModels.some(m => m.id === 'gemini-3.8-flash')).toBe(true);
    expect(geminiModels.some(m => m.recommended)).toBe(true);

    const openaiModels = llmRegistry.getAvailableModels('openai');
    expect(openaiModels.length).toBeGreaterThanOrEqual(3);
    expect(openaiModels.some(m => m.id === 'gpt-4o')).toBe(true);
    expect(openaiModels.some(m => m.recommended)).toBe(true);

    const claudeModels = llmRegistry.getAvailableModels('claude');
    expect(claudeModels.length).toBeGreaterThanOrEqual(2);
    expect(claudeModels.some(m => m.id.includes('claude-3-5-sonnet'))).toBe(true);
    expect(claudeModels.some(m => m.recommended)).toBe(true);
  });

  it('manages provider switching and model selection', () => {
    llmRegistry.setProvider('claude', 'claude-3-5-haiku-20241022');
    const config = llmRegistry.getConfig();
    expect(config.provider).toBe('claude');
    expect(config.model).toBe('claude-3-5-haiku-20241022');
  });

  // TEST 1, 2, 3, 4: Initial state and no-key states for all providers
  it('TEST 1, 2, 3, 4: requires user API key for each provider and keeps AI inactive without a key', async () => {
    // TEST 2: Gemini with no user key
    llmRegistry.setProvider('gemini');
    expect(llmRegistry.getApiKey('gemini')).toBeUndefined();
    expect(llmRegistry.isAIActive()).toBe(false);
    expect(llmRegistry.getConfig().enabled).toBe(false);
    const geminiEmptyResult = await llmRegistry.activateAI('gemini', '');
    expect(geminiEmptyResult.valid).toBe(false);
    expect(geminiEmptyResult.error).toBe('Enter an API key to activate AI.');
    expect(llmRegistry.isAIActive()).toBe(false);

    // TEST 3: OpenAI with no user key
    llmRegistry.setProvider('openai');
    expect(llmRegistry.getApiKey('openai')).toBeUndefined();
    expect(llmRegistry.isAIActive()).toBe(false);
    expect(llmRegistry.getConfig().enabled).toBe(false);
    const openaiEmptyResult = await llmRegistry.activateAI('openai', '   ');
    expect(openaiEmptyResult.valid).toBe(false);
    expect(openaiEmptyResult.error).toBe('Enter an API key to activate AI.');
    expect(llmRegistry.isAIActive()).toBe(false);

    // TEST 4: Claude with no user key
    llmRegistry.setProvider('claude');
    expect(llmRegistry.getApiKey('claude')).toBeUndefined();
    expect(llmRegistry.isAIActive()).toBe(false);
    expect(llmRegistry.getConfig().enabled).toBe(false);
    const claudeEmptyResult = await llmRegistry.activateAI('claude', undefined);
    expect(claudeEmptyResult.valid).toBe(false);
    expect(claudeEmptyResult.error).toBe('Enter an API key to activate AI.');
    expect(llmRegistry.isAIActive()).toBe(false);
  });

  // TEST 5, 6, 7: Activate with valid credentials and remove key
  it('TEST 5, 6, 7: handles user key activation, active status, and key removal', async () => {
    const mock = new MockProvider();
    mock.setModel('mock-gemini-pro');
    llmRegistry.registerProvider('gemini', mock);

    // TEST 7: Activate with valid key
    const result = await llmRegistry.activateAI('gemini', 'valid_test_key_12345', 'mock-gemini-pro');
    expect(result.valid).toBe(true);
    expect(llmRegistry.getApiKey('gemini')).toBe('valid_test_key_12345');
    expect(llmRegistry.isAIActive()).toBe(true);
    expect(llmRegistry.getConfig().enabled).toBe(true);

    // TEST 6: Remove Gemini key -> AI immediately inactive
    llmRegistry.removeApiKey('gemini');
    expect(llmRegistry.getApiKey('gemini')).toBeUndefined();
    expect(llmRegistry.isAIActive()).toBe(false);
    expect(llmRegistry.getConfig().enabled).toBe(false);
  });

  // TEST 8: Activation failure
  it('TEST 8: keeps AI inactive when activation fails', async () => {
    const mock = new MockProvider();
    llmRegistry.registerProvider('openai', mock);

    const result = await llmRegistry.activateAI('openai', 'invalid_key');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid API key');
    expect(llmRegistry.isAIActive()).toBe(false);
    expect(llmRegistry.getConfig().enabled).toBe(false);
    expect(llmRegistry.getApiKey('openai')).toBeUndefined();
  });

  // TEST 9: Server Gemini key exists but user has not entered a key (CRITICAL TEST)
  it('TEST 9: Server Gemini key presence alone does NOT activate AI or bypass user key requirement', async () => {
    // Backend environment has a server Gemini key
    llmRegistry.setServerGeminiKeyAvailable(true);
    expect(llmRegistry.hasServerGeminiKeyAvailable()).toBe(true);
    
    // Config acknowledges server capability
    const config = llmRegistry.getConfig();
    expect(config.hasServerKey).toBe(true);

    // BUT user has not entered a key:
    expect(llmRegistry.getApiKey('gemini')).toBeUndefined();
    // CRITICAL: isAIActive MUST BE FALSE
    expect(llmRegistry.isAIActive()).toBe(false);
    expect(config.enabled).toBe(false);

    // Calling activateAI with empty key MUST fail
    const activateResult = await llmRegistry.activateAI('gemini', '');
    expect(activateResult.valid).toBe(false);
    expect(activateResult.error).toBe('Enter an API key to activate AI.');
    expect(llmRegistry.isAIActive()).toBe(false);

    // User must explicitly provide their key to activate
    const mock = new MockProvider();
    llmRegistry.registerProvider('gemini', mock);
    const userResult = await llmRegistry.activateAI('gemini', 'user_provided_gemini_key_8899');
    expect(userResult.valid).toBe(true);
    expect(llmRegistry.isAIActive()).toBe(true);
    expect(llmRegistry.getConfig().enabled).toBe(true);

    // If user removes their key, AI goes inactive even though server key remains
    llmRegistry.removeApiKey('gemini');
    expect(llmRegistry.isAIActive()).toBe(false);
    expect(llmRegistry.getConfig().enabled).toBe(false);
    expect(llmRegistry.hasServerGeminiKeyAvailable()).toBe(true);
  });

  // Independent provider keys (Requirement 6)
  it('keeps keys isolated per provider and does not carry keys over', async () => {
    const mockGemini = new MockProvider();
    const mockOpenAI = new MockProvider();
    llmRegistry.registerProvider('gemini', mockGemini);
    llmRegistry.registerProvider('openai', mockOpenAI);

    await llmRegistry.activateAI('gemini', 'gemini-secret-key-1');
    expect(llmRegistry.getApiKey('gemini')).toBe('gemini-secret-key-1');
    expect(llmRegistry.getApiKey('openai')).toBeUndefined();

    // Switching active provider to OpenAI
    llmRegistry.setProvider('openai');
    expect(llmRegistry.getApiKey('openai')).toBeUndefined();
    // OpenAI has no user key, so isAIActive is false for OpenAI
    expect(llmRegistry.isAIActive()).toBe(false);
  });

  it('handles disabling AI and reverting to deterministic mode', () => {
    llmRegistry.disableAI();
    const config = llmRegistry.getConfig();
    expect(config.enabled).toBe(false);
  });
});
