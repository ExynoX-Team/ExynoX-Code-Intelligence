import { useState, useEffect } from 'react';
import { Sparkles, Sliders, ChevronDown } from 'lucide-react';
import { llmRegistry, type AIConfig } from '../../services/llm/index.js';
import { AIConfigModal } from './AIConfigModal.js';

interface AIStatusBadgeProps {
  compact?: boolean;
}

export function AIStatusBadge({ compact = false }: AIStatusBadgeProps) {
  const [config, setConfig] = useState<AIConfig>(llmRegistry.getConfig());
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    return llmRegistry.subscribe((newConfig) => {
      setConfig(newConfig);
    });
  }, []);

  const providerName = 
    config.provider === 'gemini' ? 'Gemini' :
    config.provider === 'openai' ? 'OpenAI' :
    config.provider === 'claude' ? 'Claude' : 'AI';

  return (
    <>
      <button
        type="button"
        id="btn-ai-config-badge"
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all ${
          config.enabled
            ? 'bg-cyan-950/50 text-cyan-300 border border-cyan-800/60 hover:border-cyan-600 shadow-sm'
            : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600 hover:text-zinc-200'
        }`}
        title="Configure AI Providers (Gemini, OpenAI, Claude)"
      >
        <span 
          className={`w-1.5 h-1.5 rounded-full ${config.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} 
        />
        {config.enabled ? (
          <>
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>AI Active &bull; {providerName}</span>
          </>
        ) : (
          <>
            <Sliders className="w-3 h-3 text-zinc-500" />
            <span>{compact ? 'AI Offline' : 'AI Disabled (Deterministic)'}</span>
          </>
        )}
        <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      <AIConfigModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}
