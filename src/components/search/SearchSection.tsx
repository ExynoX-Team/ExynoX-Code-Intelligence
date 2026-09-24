import { useState, useRef, useEffect } from 'react';
import { Search, CornerDownLeft, Loader2, X } from 'lucide-react';
import { ExampleQuestions } from './ExampleQuestions.js';

interface SearchSectionProps {
  onAsk: (query: string) => void;
  isSearching: boolean;
}

export function SearchSection({ onAsk, isSearching }: SearchSectionProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isSearching) {
      onAsk(query.trim());
    }
  };

  const handleSelectExample = (example: string) => {
    setQuery(example);
    inputRef.current?.focus();
  };

  return (
    <div className="w-full bg-[#111622] rounded-xl border border-zinc-800/80 p-5 sm:p-6 mb-6">
      <div className="mb-3">
        <label 
          htmlFor="codebase-query-input"
          className="text-base font-semibold text-zinc-100 block tracking-tight"
        >
          Ask your codebase
        </label>
        <span className="text-xs text-zinc-400">
          Query functions, features, call hierarchies, and definitions across the Python repository.
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="codebase-query-input"
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isSearching}
            placeholder="Ask something about your codebase..."
            className="w-full pl-10 pr-24 py-3 bg-[#090d16] border border-zinc-700/80 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
            {query && !isSearching && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
                title="Clear input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 bg-zinc-800/80 border border-zinc-700/60 rounded">
              <CornerDownLeft className="w-3 h-3" />
            </kbd>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-zinc-500 hidden sm:block">
            Supports natural language, function names, and behavioral relationships
          </div>
          <button
            type="submit"
            id="btn-ask-codebase"
            disabled={!query.trim() || isSearching}
            className="w-full sm:w-auto px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching codebase...</span>
              </>
            ) : (
              <span>Ask Codebase</span>
            )}
          </button>
        </div>
      </form>

      <ExampleQuestions 
        onSelectQuestion={handleSelectExample} 
        disabled={isSearching} 
      />
    </div>
  );
}
