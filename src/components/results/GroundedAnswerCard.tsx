import { Sparkles, ShieldCheck, FileText, CheckCircle } from 'lucide-react';
import type { GroundedAnswer } from '../../types/agent.js';
import { llmRegistry } from '../../services/llm/index.js';

interface GroundedAnswerCardProps {
  answer: GroundedAnswer;
}

export function GroundedAnswerCard({ answer }: GroundedAnswerCardProps) {
  const activeProvider = llmRegistry.getActiveProvider();
  const providerName = activeProvider.getProviderName();
  const modelName = activeProvider.getModel();

  // Simple Markdown-like renderer for the structured answer
  const formatContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Heading 3: ### ...
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-sm font-semibold text-zinc-100 mt-3 mb-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            {line.replace('### ', '')}
          </h3>
        );
      }
      // Heading 2: ## ...
      if (line.startsWith('## ')) {
        return (
          <h2 key={idx} className="text-base font-bold text-zinc-100 mt-4 mb-2">
            {line.replace('## ', '')}
          </h2>
        );
      }
      // Bullet point: - ... or * ...
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const bulletText = line.trim().substring(2);
        return (
          <li key={idx} className="text-xs text-zinc-300 ml-4 list-disc space-y-1">
            {renderInlineCode(bulletText)}
          </li>
        );
      }
      // Empty line
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }
      // Standard paragraph
      return (
        <p key={idx} className="text-xs text-zinc-300 leading-relaxed">
          {renderInlineCode(line)}
        </p>
      );
    });
  };

  // Helper to render `code` and **bold**
  const renderInlineCode = (text: string) => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded bg-black/40 border border-zinc-700/60 font-mono text-[11px] text-cyan-300">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-zinc-100">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div 
      id="grounded-ai-answer-card"
      className="w-full bg-gradient-to-b from-[#111827] to-[#0b101b] rounded-xl border border-cyan-800/40 p-5 sm:p-6 shadow-xl relative overflow-hidden animate-in fade-in duration-300"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${answer.isFallbackDeterministic ? 'bg-amber-950/60 border border-amber-700/50 text-amber-400' : 'bg-cyan-950/60 border border-cyan-700/50 text-cyan-400'}`}>
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
              {answer.isFallbackDeterministic ? 'Retrieved Repository Evidence' : 'Grounded AI Synthesis'}
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Verified Evidence
              </span>
            </h2>
            <span className="text-[11px] font-mono text-zinc-400">
              {answer.isFallbackDeterministic 
                ? 'AI synthesis unavailable — showing verified repository evidence.'
                : `Generated via ${providerName} (${modelName})`}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span 
            id="evidence-verification-badge"
            className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-emerald-950/70 text-emerald-300 border-emerald-800/60"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Verified Evidence
          </span>
          {answer.evidenceFiles.length > 0 && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900/80 text-zinc-300 border border-zinc-800">
              {answer.evidenceFiles.length} {answer.evidenceFiles.length === 1 ? 'source' : 'sources'} verified
            </span>
          )}
          {answer.evidenceLines.length > 0 && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900/80 text-zinc-300 border border-zinc-800">
              {answer.evidenceLines.length} {answer.evidenceLines.length === 1 ? 'evidence item' : 'evidence items'} inspected
            </span>
          )}
        </div>
      </div>

      {/* Answer content */}
      <div className="space-y-2 text-zinc-200">
        {formatContent(answer.answer)}
      </div>

      {/* Verified Evidence citations */}
      {answer.evidenceFiles.length > 0 && (
        <div className="mt-4 pt-3 border-t border-zinc-800/60 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1">
            <FileText className="w-3 h-3 text-cyan-400" />
            Cited Repository Files:
          </span>
          {answer.evidenceFiles.map((f, i) => (
            <span 
              key={i} 
              className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950/40 border border-cyan-800/40 text-cyan-300"
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
