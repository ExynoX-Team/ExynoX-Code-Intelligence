import { Terminal, Search, Info } from 'lucide-react';

interface EmptyResultStateProps {
  hasQuery?: boolean;
  queryText?: string;
}

export function EmptyResultState({ hasQuery = false, queryText }: EmptyResultStateProps) {
  if (hasQuery) {
    return (
      <div 
        id="phase1-no-matches-container"
        className="w-full text-center py-12 px-6 rounded-xl bg-[#111622] border border-zinc-800/80"
      >
        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-3">
          <Search className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
          No exact text matches found
        </h3>
        {queryText && (
          <p className="mt-1 text-xs font-mono text-cyan-400">
            "{queryText}"
          </p>
        )}
        <p className="mt-2 text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
          Phase 1 executes deterministic lexical matching across ingested Python source files.
          No exact keyword occurrences were found. Semantic understanding and agentic code search will be connected in subsequent phases.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono bg-zinc-900 border border-zinc-700/60 text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
          Deterministic Phase 1 Search
        </div>
      </div>
    );
  }

  return (
    <div 
      id="empty-result-state"
      className="w-full text-center py-16 px-6 rounded-xl bg-[#111622] border border-zinc-800/80"
    >
      <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 flex items-center justify-center mx-auto mb-3">
        <Search className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-medium text-zinc-200">
        Ask a question to explore your codebase.
      </h3>
      <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
        Exact file paths, line locations, and verified code snippets will appear here.
      </p>
    </div>
  );
}
