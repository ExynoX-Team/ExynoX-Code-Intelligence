import { AlertTriangle, RotateCw, Settings2, ShieldAlert, FileCheck } from 'lucide-react';
import type { LLMProviderErrorInfo } from '../../types/llm.js';

interface ProviderErrorCardProps {
  errorInfo: LLMProviderErrorInfo;
  onRetry?: () => void;
  onChangeProvider?: () => void;
  hasEvidence?: boolean;
  onUseRetrievedEvidence?: () => void;
}

export function ProviderErrorCard({
  errorInfo,
  onRetry,
  onChangeProvider,
  hasEvidence,
  onUseRetrievedEvidence
}: ProviderErrorCardProps) {
  const is503 = errorInfo.category === 'unavailable' || errorInfo.statusCode === 503;
  const isAuth = errorInfo.category === 'auth';

  const providerLabel = 
    errorInfo.provider === 'gemini' ? 'Google Gemini' :
    errorInfo.provider === 'openai' ? 'OpenAI GPT' :
    errorInfo.provider === 'claude' ? 'Anthropic Claude' :
    errorInfo.provider;

  return (
    <div 
      id="provider-error-card"
      className="w-full rounded-xl bg-[#111622] border border-amber-500/30 p-6 shadow-lg shadow-black/40"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
          {isAuth ? <ShieldAlert className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {hasEvidence ? 'AI Synthesis Unavailable' : (is503 ? 'Provider Unavailable' : 'Provider Error')}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              {providerLabel} ({errorInfo.model})
            </span>
          </div>

          <h3 className="text-base font-medium text-zinc-100">
            {hasEvidence ? 'AI synthesis unavailable' : (errorInfo.title || 'AI provider temporarily unavailable')}
          </h3>

          <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
            {hasEvidence
              ? 'The AI model could not complete final answer synthesis, but verified repository code and call relationships were successfully gathered. You can retry with AI, change provider, or directly view the verified repository evidence.'
              : (errorInfo.message || 'The selected model is experiencing high demand. Please try again in a moment or choose another provider/model.')}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {onRetry && errorInfo.retryable !== false && (
              <button
                id="btn-retry-investigation"
                onClick={onRetry}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors cursor-pointer shadow-sm shadow-cyan-900/40"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Retry AI
              </button>
            )}

            {onChangeProvider && (
              <button
                id="btn-change-provider"
                onClick={onChangeProvider}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5 text-zinc-400" />
                Change Provider
              </button>
            )}

            {hasEvidence && onUseRetrievedEvidence && (
              <button
                id="btn-use-retrieved-evidence"
                onClick={onUseRetrievedEvidence}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors cursor-pointer shadow-sm shadow-emerald-900/40"
              >
                <FileCheck className="w-3.5 h-3.5" />
                Use Retrieved Evidence
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
