import { Loader2, CheckCircle2, Circle } from 'lucide-react';
import type { IndexingProgress } from '../../types/index.js';

interface IndexingProgressViewProps {
  progress: IndexingProgress | null;
}

export function IndexingProgressView({ progress }: IndexingProgressViewProps) {
  const steps = progress?.steps || [
    { id: '1', label: 'Repository archive received', status: 'completed' as const },
    { id: '2', label: 'Scanning archive structure', status: 'in_progress' as const },
    { id: '3', label: 'Reading repository source files', status: 'pending' as const },
    { id: '4', label: 'Building repository workspace', status: 'pending' as const },
  ];

  return (
    <div 
      id="repo-indexing-progress-card"
      className="w-full max-w-lg mx-auto my-16 p-6 sm:p-8 rounded-xl bg-[#111622] border border-zinc-800/90 shadow-xl"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/60 text-cyan-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-zinc-100">
            Ingesting Repository
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {progress?.message || 'Processing repository structure and files...'}
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="space-y-3 pt-2 border-t border-zinc-800/80">
        {steps.map((step, idx) => {
          const isDone = step.status === 'completed';
          const isCurrent = step.status === 'in_progress';

          return (
            <div 
              key={step.id || idx}
              className={`flex items-center gap-3 p-2.5 rounded-lg text-xs transition-colors ${
                isCurrent 
                  ? 'bg-zinc-900/90 border border-cyan-800/40 text-cyan-200' 
                  : isDone
                    ? 'text-zinc-300'
                    : 'text-zinc-600'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : isCurrent ? (
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-zinc-700 shrink-0" />
              )}
              <span className={`font-mono ${isCurrent ? 'font-medium text-zinc-100' : ''}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <span>Deterministic ingestion</span>
        <span className="text-cyan-400">ExynoX Workspace</span>
      </div>
    </div>
  );
}
