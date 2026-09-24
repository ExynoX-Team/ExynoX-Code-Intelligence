import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type { ApplicationError } from '../../types/index.js';

interface ErrorStateProps {
  error: ApplicationError;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div 
      id="application-error-banner"
      className="w-full max-w-xl mx-auto my-8 p-6 rounded-xl bg-[#141219] border border-rose-900/60 text-center"
    >
      <div className="w-10 h-10 rounded-full bg-rose-950/60 border border-rose-800/60 text-rose-400 flex items-center justify-center mx-auto mb-3">
        <AlertCircle className="w-5 h-5" />
      </div>

      <h3 className="text-sm font-semibold text-zinc-100">
        {error.message || 'Something went wrong while loading the repository.'}
      </h3>
      <p className="mt-1 text-xs text-zinc-400 max-w-md mx-auto">
        Please verify the archive format or repository URL and try again.
      </p>

      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          type="button"
          id="btn-error-retry"
          onClick={onRetry}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700/80 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Try again
        </button>

        {error.technicalDetails && (
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="px-3 py-2 text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Details</span>
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {showDetails && error.technicalDetails && (
        <div className="mt-4 p-3 bg-zinc-950/90 border border-zinc-800 rounded-lg text-left overflow-x-auto">
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
            Debug Information:
          </div>
          <pre className="text-[11px] font-mono text-rose-300/80 whitespace-pre-wrap leading-relaxed">
            {error.technicalDetails}
          </pre>
        </div>
      )}
    </div>
  );
}
