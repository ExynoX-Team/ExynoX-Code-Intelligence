import { Loader2, Search, FileCode2, GitFork, ShieldCheck, Sparkles, Compass } from 'lucide-react';
import type { InvestigationStatus } from '../../types/agent.js';

interface InvestigationProgressProps {
  status: InvestigationStatus;
  statusMessage?: string;
  iteration?: number;
  maxIterations?: number;
}

export function InvestigationProgress({
  status,
  statusMessage,
  iteration = 1,
  maxIterations = 6
}: InvestigationProgressProps) {
  const getIcon = () => {
    switch (status) {
      case 'planning':
        return <Compass className="w-4 h-4 text-cyan-400 animate-pulse" />;
      case 'searching':
        return <Search className="w-4 h-4 text-cyan-400 animate-pulse" />;
      case 'inspecting':
        return <FileCode2 className="w-4 h-4 text-blue-400 animate-pulse" />;
      case 'following_relationships':
        return <GitFork className="w-4 h-4 text-indigo-400 animate-pulse" />;
      case 'verifying':
        return <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />;
      case 'synthesizing':
        return <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />;
      default:
        return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
    }
  };

  const readableStatus = statusMessage || (
    status === 'planning' ? 'Creating investigation plan...' :
    status === 'searching' ? 'Searching the repository...' :
    status === 'inspecting' ? 'Inspecting relevant code...' :
    status === 'following_relationships' ? 'Following code relationships...' :
    status === 'verifying' ? 'Verifying evidence...' :
    status === 'synthesizing' ? 'Preparing answer...' :
    'Analyzing codebase...'
  );

  return (
    <div 
      id="investigation-live-progress"
      className="w-full py-12 px-6 rounded-xl bg-[#111622] border border-zinc-800/80 text-center animate-in fade-in duration-300"
    >
      <div className="inline-flex items-center justify-center p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 mb-3 shadow-inner">
        {getIcon()}
      </div>

      <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
        {readableStatus}
      </h3>

      <div className="flex items-center justify-center gap-2 mt-2">
        <span className="text-xs text-zinc-400">
          Controlled agentic loop (Iteration {iteration} of {maxIterations})
        </span>
      </div>

      {/* Progress Steps Indicators */}
      <div className="flex items-center justify-center gap-1.5 mt-5 max-w-xs mx-auto">
        {['Plan', 'Search', 'Inspect', 'Follow', 'Verify', 'Answer'].map((step, idx) => {
          const stepStatuses: InvestigationStatus[] = [
            'planning',
            'searching',
            'inspecting',
            'following_relationships',
            'verifying',
            'synthesizing'
          ];
          const currentIdx = stepStatuses.indexOf(status);
          const isCompleted = currentIdx > idx;
          const isCurrent = currentIdx === idx;

          return (
            <div key={step} className="flex-1 flex flex-col items-center gap-1">
              <div 
                className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-cyan-400' 
                    : isCurrent 
                    ? 'bg-cyan-500/80 animate-pulse' 
                    : 'bg-zinc-800'
                }`} 
              />
              <span className={`text-[10px] ${isCurrent ? 'text-cyan-300 font-semibold' : 'text-zinc-500'}`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
