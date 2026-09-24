import { ExynoxLogo } from './ExynoxLogo.js';
import type { Repository } from '../../types/index.js';
import { AIStatusBadge } from '../ai/AIStatusBadge.js';

interface HeaderProps {
  onReset?: () => void;
  showSubtitle?: boolean;
  repository?: Repository | null;
}

export function Header({ onReset, showSubtitle = true, repository }: HeaderProps) {
  // Target badge label:
  // If current repository contains JS/TS files: "JavaScript AST + Multi-language"
  // If current repository contains Python files: "Python AST + Multi-language"
  // If no code files: "Multi-language"
  // Default: "JavaScript AST + Multi-language"
  const hasJs = (repository?.jsFileCount ?? 0) > 0;
  const hasPython = (repository?.pythonFileCount ?? 0) > 0;
  const badgeLabel = repository
    ? (hasJs ? 'JavaScript AST + Multi-language' : (hasPython ? 'Python AST + Multi-language' : 'Multi-language'))
    : 'JavaScript AST + Multi-language';

  return (
    <header className="w-full border-b border-zinc-800/80 bg-[#090d16]/90 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div 
          id="app-header-brand"
          onClick={onReset}
          className={`flex items-center gap-3.5 ${onReset ? 'cursor-pointer group' : ''}`}
          role={onReset ? 'button' : undefined}
          tabIndex={onReset ? 0 : undefined}
          onKeyDown={(e) => {
            if (onReset && (e.key === 'Enter' || e.key === ' ')) {
              onReset();
            }
          }}
        >
          <ExynoxLogo size="md" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-100 tracking-tight text-base sm:text-lg group-hover:text-cyan-400 transition-colors">
                ExynoX Code Intelligence
              </span>
            </div>
            {showSubtitle && (
              <span className="text-xs text-zinc-400 font-normal">
                Ask your codebase anything.
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <AIStatusBadge />
          <div 
            id="badge-hackathon-theme"
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800/60 border border-zinc-700/50 text-zinc-400"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            Samsung PRISM &bull; Theme 1
          </div>
          <div 
            id="badge-python-target"
            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-cyan-950/40 text-cyan-300 border border-cyan-800/40"
          >
            {badgeLabel}
          </div>
        </div>
      </div>
    </header>
  );
}
