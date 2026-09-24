import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Sparkles, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Cpu,
  ChevronDown
} from 'lucide-react';
import { llmRegistry, type LLMProviderType } from '../../services/llm/index.js';

interface AIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange?: () => void;
}

export function AIConfigModal({ isOpen, onClose, onConfigChange }: AIConfigModalProps) {
  const [provider, setProvider] = useState<LLMProviderType>('gemini');
  const [model, setModel] = useState<string>('gemini-3.8-flash');
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [activationFailed, setActivationFailed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const apiKeyInputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const activeConfig = llmRegistry.getConfig();
  const availableModels = llmRegistry.getAvailableModels(provider);

  // Sync state and preserve focus element when modal opens
  useEffect(() => {
    if (isOpen) {
      triggerElementRef.current = document.activeElement as HTMLElement | null;
      const cfg = llmRegistry.getConfig();
      setProvider(cfg.provider);
      setModel(cfg.model);
      const currentKey = llmRegistry.getApiKey(cfg.provider) || '';
      setApiKey(currentKey);
      setError(null);
      setSuccessMessage(null);
      setActivationFailed(false);

      // Lock background scrolling
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Focus management: focus input if no key, else focus close button
      const timer = setTimeout(() => {
        if (!currentKey && apiKeyInputRef.current) {
          apiKeyInputRef.current.focus();
        } else if (closeButtonRef.current) {
          closeButtonRef.current.focus();
        }
      }, 50);

      return () => {
        document.body.style.overflow = originalOverflow;
        clearTimeout(timer);
      };
    } else {
      // Restore focus to trigger button after closing
      if (triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
        triggerElementRef.current.focus();
      } else {
        const badgeBtn = document.getElementById('btn-ai-config-badge');
        badgeBtn?.focus();
      }
    }
  }, [isOpen]);

  // Keyboard accessibility: Escape to close, focus trap Tab navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Update model default and load provider-specific key when provider changes
  const handleProviderChange = (newProvider: LLMProviderType) => {
    setProvider(newProvider);
    const models = llmRegistry.getAvailableModels(newProvider);
    const defaultMod = models.find(m => m.recommended)?.id || models[0]?.id || '';
    setModel(defaultMod);
    // Retrieve saved user key for THAT specific provider (do not carry over previous provider's key)
    const savedKey = llmRegistry.getApiKey(newProvider) || '';
    setApiKey(savedKey);
    setActivationFailed(false);
    setError(null);
    setSuccessMessage(null);
  };

  const handleActivate = useCallback(async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setError('Enter an API key to activate AI.');
      return;
    }

    setIsValidating(true);
    setError(null);
    setSuccessMessage(null);
    setActivationFailed(false);

    try {
      const result = await llmRegistry.activateAI(provider, trimmedKey, model);
      if (result.valid) {
        setActivationFailed(false);
        setSuccessMessage(`AI activated successfully using ${result.providerName || provider}!`);
        onConfigChange?.();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setActivationFailed(true);
        setError(result.error || 'Unable to activate AI. Please check your API key.');
      }
    } catch (err: unknown) {
      setActivationFailed(true);
      setError(err instanceof Error ? err.message : 'Unable to activate AI. Please check your API key.');
    } finally {
      setIsValidating(false);
    }
  }, [provider, apiKey, model, onConfigChange, onClose]);

  const handleRemoveKey = () => {
    llmRegistry.removeApiKey(provider);
    setApiKey('');
    setActivationFailed(false);
    setError(null);
    setSuccessMessage('API key removed. AI is now not active.');
    onConfigChange?.();
  };

  const handleDisableAI = () => {
    llmRegistry.disableAI();
    setActivationFailed(false);
    setError(null);
    setSuccessMessage('AI disabled. ExynoX is now operating in deterministic mode.');
    onConfigChange?.();
  };

  if (!isOpen) return null;

  const trimmedKey = apiKey.trim();
  const canActivate = !isValidating && trimmedKey.length > 0;

  // Clear states calculation:
  // 1. Active: only if session is enabled AND active provider matches AND key matches
  const savedKeyForProvider = llmRegistry.getApiKey(provider) || '';
  const isCurrentProviderActive = 
    activeConfig.enabled && 
    activeConfig.provider === provider && 
    savedKeyForProvider.length > 0 && 
    savedKeyForProvider === trimmedKey;

  let statusLabel = 'AI Not Active';
  let statusDotClass = 'bg-zinc-500';
  let statusTextClass = 'text-zinc-400 truncate';

  if (isCurrentProviderActive) {
    const providerDisplayName = llmRegistry.getProvider(provider).getProviderName();
    statusLabel = `Active (${providerDisplayName})`;
    statusDotClass = 'bg-emerald-400 animate-pulse';
    statusTextClass = 'text-emerald-400 font-semibold truncate';
  } else if (activationFailed) {
    statusLabel = 'Activation Failed';
    statusDotClass = 'bg-rose-400';
    statusTextClass = 'text-rose-400 font-semibold truncate';
  } else if (trimmedKey.length > 0) {
    statusLabel = 'Ready to Activate';
    statusDotClass = 'bg-cyan-400';
    statusTextClass = 'text-cyan-300 font-semibold truncate';
  } else {
    statusLabel = 'AI Not Active';
    statusDotClass = 'bg-zinc-500';
    statusTextClass = 'text-zinc-400 truncate';
  }

  return createPortal(
    <div 
      id="ai-config-modal-overlay"
      className="ai-modal-overlay fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overscroll-none"
      onClick={(e) => {
        // Clicking backdrop closes modal
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-config-modal-title"
    >
      <div 
        ref={modalRef}
        id="ai-config-modal-dialog"
        className="w-full flex flex-col bg-[#0f1422] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 relative"
        style={{
          width: 'min(560px, calc(100vw - 32px))',
          maxHeight: 'min(calc(100vh - 32px), calc(100dvh - 32px))'
        }}
      >
        {/* Modal Header - Fixed at top of modal */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-800/80 bg-[#121929]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/50 text-cyan-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="ai-config-modal-title" className="text-sm sm:text-base font-semibold text-zinc-100 truncate">
                AI Intelligence
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate">
                Configure LLM providers for agentic code intelligence
              </p>
            </div>
          </div>
          <button 
            ref={closeButtonRef}
            type="button"
            id="btn-close-ai-config"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer transition-colors shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Status banner */}
          <div className="flex items-center gap-2 p-2.5 sm:p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass}`} />
            <span className="font-medium text-zinc-200">
              Status:
            </span>
            <span id="ai-modal-status-text" className={statusTextClass}>
              {statusLabel}
            </span>
          </div>

          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 block">
              Provider
            </label>

            {/* Three Visual Provider Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="btn-provider-gemini"
                onClick={() => handleProviderChange('gemini')}
                title="Google Gemini"
                className={`py-2.5 px-2 sm:px-3 rounded-lg border text-xs font-medium flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  provider === 'gemini'
                    ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500/50'
                    : 'bg-[#121929] border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate text-center">
                  Google Gemini
                </span>
              </button>

              <button
                type="button"
                id="btn-provider-openai"
                onClick={() => handleProviderChange('openai')}
                title="OpenAI GPT"
                className={`py-2.5 px-2 sm:px-3 rounded-lg border text-xs font-medium flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  provider === 'openai'
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/50'
                    : 'bg-[#121929] border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate text-center">
                  OpenAI GPT
                </span>
              </button>

              <button
                type="button"
                id="btn-provider-claude"
                onClick={() => handleProviderChange('claude')}
                title="Anthropic Claude"
                className={`py-2.5 px-2 sm:px-3 rounded-lg border text-xs font-medium flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  provider === 'claude'
                    ? 'bg-amber-950/40 border-amber-500 text-amber-300 ring-1 ring-amber-500/50'
                    : 'bg-[#121929] border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <Cpu className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate text-center">
                  Anthropic Claude
                </span>
              </button>
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="ai-model-select" className="text-xs font-semibold text-zinc-300 block">
                Model
              </label>
              <span className="text-[11px] text-zinc-500 font-mono">
                {availableModels.length} models available
              </span>
            </div>
            <div className="relative">
              <select
                id="ai-model-select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 bg-[#121929] border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 cursor-pointer appearance-none pr-8 font-medium"
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.recommended ? '— Recommended' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <p className="text-[11px] text-zinc-500 leading-tight">
              {availableModels.find(m => m.id === model)?.description}
            </p>
          </div>

          {/* API Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <label htmlFor="ai-api-key-input" className="text-xs font-semibold text-zinc-300">
                {provider === 'gemini' ? 'Gemini API Key' : provider === 'openai' ? 'OpenAI API Key' : 'Claude API Key'}
              </label>
              <span className="text-[11px] text-zinc-500 font-medium">
                Required
              </span>
            </div>

            <div className="relative flex items-center">
              <input
                ref={apiKeyInputRef}
                id="ai-api-key-input"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setActivationFailed(false);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canActivate) {
                    e.preventDefault();
                    handleActivate();
                  }
                }}
                placeholder={
                  provider === 'gemini' 
                    ? 'Enter your Gemini API key (AIzaSy...)' 
                    : provider === 'openai' 
                    ? 'Enter your OpenAI API key (sk-proj-...)' 
                    : 'Enter your Claude API key (sk-ant-...)'
                }
                className="w-full pl-3 pr-10 py-2 sm:py-2.5 bg-[#121929] border border-zinc-700 rounded-lg text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
              <button
                type="button"
                id="btn-toggle-show-key"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
                className="absolute right-2.5 p-1 text-zinc-400 hover:text-zinc-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 rounded cursor-pointer transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-start gap-1.5 pt-0.5 text-[11px] text-zinc-400">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                Keys are stored only in volatile browser session memory and proxied via backend. Never saved to disk or database.
              </span>
            </div>
          </div>

          {/* Feedback messages */}
          {error && (
            <div 
              id="ai-config-error-message"
              className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div 
              id="ai-config-success-message"
              className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer / Actions - Fixed at bottom of modal, never pushed off-screen */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-t border-zinc-800/80 bg-[#121929]">
          <div className="flex items-center gap-2">
            {activeConfig.enabled && (
              <button
                type="button"
                id="btn-disable-ai"
                onClick={handleDisableAI}
                className="text-xs text-zinc-400 hover:text-zinc-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 rounded py-1.5 px-2.5 cursor-pointer transition-colors border border-zinc-800 hover:border-zinc-700"
              >
                Disable AI
              </button>
            )}
            {(savedKeyForProvider || apiKey) && (
              <button
                type="button"
                id="btn-remove-api-key"
                onClick={handleRemoveKey}
                className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-400 rounded py-1.5 px-2 cursor-pointer transition-colors"
                title="Remove saved API key"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Remove Key</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-cancel-ai-config"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              id="btn-activate-ai"
              onClick={handleActivate}
              disabled={!canActivate}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-lg shadow-cyan-950/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer transition-all"
            >
              {isValidating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isValidating ? 'Validating...' : 'Activate AI'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
