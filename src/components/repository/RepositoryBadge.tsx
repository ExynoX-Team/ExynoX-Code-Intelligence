import { useState } from 'react';
import { 
  Check, 
  RefreshCw, 
  FileCode, 
  GitFork, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  SlidersHorizontal 
} from 'lucide-react';
import type { Repository } from '../../types/index.js';

interface RepositoryBadgeProps {
  repository: Repository;
  onChangeRepository: () => void;
}

export function RepositoryBadge({ repository, onChangeRepository }: RepositoryBadgeProps) {
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const stats = repository.structuralStats;
  const repoStats = repository.repositoryWideStats;
  const hasJs = (repository.jsFileCount ?? 0) > 0;
  const hasPython = repository.pythonFileCount > 0;
  const hasSupportedCode = hasJs || hasPython;

  const languageCount = repoStats?.byLanguage 
    ? Object.keys(repoStats.byLanguage).length 
    : (hasJs || hasPython ? 1 : 1);

  const formatBytes = (bytes: number): string => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const primaryLanguageLabel = hasJs ? 'JavaScript' : (hasPython ? 'Python' : 'Repository');

  return (
    <div 
      id="repository-status-badge"
      className="p-4 rounded-xl bg-[#111622] border border-zinc-800/80 mb-6 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 shrink-0 mt-0.5 sm:mt-0">
            <Check className="w-5 h-5" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold text-zinc-100 text-sm sm:text-base">
                {repository.name}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                {repository.type}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Ready
              </span>
            </div>

            {/* Ingestion & Line Statistics */}
            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-zinc-400 mt-1.5">
              <span className="flex items-center gap-1 text-cyan-300 font-mono">
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                {repository.fileCount} total files
                {hasJs ? ` (${repository.jsFileCount} JS/TS)` : ''}
                {hasPython ? ` (${repository.pythonFileCount} Python)` : ''}
              </span>
              <span className="text-zinc-600">&bull;</span>
              <span className="font-mono text-zinc-300">
                {languageCount} {languageCount === 1 ? 'language' : 'languages'}
              </span>
              <span className="text-zinc-600">&bull;</span>
              <span className="font-mono text-zinc-300">
                {(repoStats ? repoStats.totalLines : repository.totalLines).toLocaleString()} total lines
              </span>
              {repoStats && (
                <>
                  <span className="text-zinc-600">&bull;</span>
                  <span className="font-mono text-emerald-400">
                    {(repoStats.totalCodeLines ?? repoStats.codeLines ?? 0).toLocaleString()} code
                  </span>
                  <span className="text-zinc-600">&bull;</span>
                  <span className="font-mono text-cyan-400">
                    {(repoStats.totalCommentLines ?? repoStats.commentLines ?? 0).toLocaleString()} comments
                  </span>
                </>
              )}
              {repository.totalBytes !== undefined && (
                <>
                  <span className="text-zinc-600">&bull;</span>
                  <span className="font-mono text-zinc-400">
                    {formatBytes(repository.totalBytes)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {repoStats && (
            <button
              type="button"
              id="btn-toggle-stats"
              onClick={() => setShowDetailedStats(!showDetailedStats)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 border border-cyan-800/50 transition-colors cursor-pointer"
              title="Toggle Repository Composition & Line Statistics"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showDetailedStats ? 'Hide Metrics' : 'Metrics & Languages'}</span>
              {showDetailedStats ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          <button
            type="button"
            id="btn-change-repository"
            onClick={onChangeRepository}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
            title="Connect a different repository"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Change</span>
          </button>
        </div>
      </div>

      {/* Code Structure Analyzed Summary (AST Intelligence or Graceful Notice) */}
      <div className="mt-3 pt-3 border-t border-zinc-800/60 text-xs">
        {hasSupportedCode && stats && stats.filesAnalyzed > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-400">
              <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                <GitFork className="w-3.5 h-3.5 text-indigo-400" />
                Structural analysis ({primaryLanguageLabel}):
              </span>
              <span className="font-mono text-zinc-300">
                <span className="text-emerald-400">✓</span> {stats.successfullyParsed} files indexed
              </span>
              <span className="text-zinc-600">&bull;</span>
              <span className="font-mono text-zinc-300">
                <span className="text-emerald-400">✓</span> {stats.totalFunctions + stats.totalMethods} functions
              </span>
              <span className="text-zinc-600">&bull;</span>
              <span className="font-mono text-zinc-300">
                <span className="text-emerald-400">✓</span> {stats.totalClasses} classes
              </span>
              <span className="text-zinc-600">&bull;</span>
              <span className="font-mono text-zinc-300">
                <span className="text-emerald-400">✓</span> {stats.totalCalls} call relationships
              </span>
              {stats.totalImports > 0 && (
                <>
                  <span className="text-zinc-600">&bull;</span>
                  <span className="font-mono text-zinc-300">
                    <span className="text-emerald-400">✓</span> {stats.totalImports} imports
                  </span>
                </>
              )}
            </div>

            {stats.parseFailures > 0 && (
              <button
                type="button"
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>{stats.parseFailures} skipped due to syntax error</span>
                {showErrorDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-400">
            <span className="text-zinc-400 font-medium flex items-center gap-1.5">
              <GitFork className="w-3.5 h-3.5 text-zinc-500" />
              Structural analysis:
            </span>
            <span className="text-zinc-400 italic">
              Not available — no JavaScript or Python files found
            </span>
          </div>
        )}

        {/* Skipped files breakdown if any parsing errors were caught */}
        {showErrorDetails && stats && stats.failedFiles.length > 0 && (
          <div className="mt-2 p-2.5 rounded bg-amber-950/20 border border-amber-800/30 text-[11px] text-amber-200/90 font-mono">
            <div className="font-semibold text-amber-300 mb-1">Files skipped during AST parsing:</div>
            {stats.failedFiles.map((ff, i) => (
              <div key={i} className="truncate">
                &bull; <span className="text-zinc-200">{ff.filePath}</span>: <span className="text-amber-400/80">{ff.error}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Phase 3: Detailed Repository Composition & Line Statistics Panel */}
      {showDetailedStats && repoStats && (
        <div id="repo-composition-panel" className="mt-3 pt-3 border-t border-zinc-800/80 text-xs">
          {!hasSupportedCode && (
            <div className="mb-3 p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
                <div>
                  <span className="font-semibold text-zinc-300">AST Analysis: </span>
                  <span className="text-zinc-400">Unavailable &mdash; No JavaScript or Python files found in this repository.</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                Unavailable
              </span>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
              <div className="text-zinc-400 text-[11px]">Total Lines</div>
              <div className="font-mono text-base font-semibold text-zinc-100">{repoStats.totalLines.toLocaleString()}</div>
              <div className="text-[10px] text-zinc-500">{repoStats.totalFiles} files indexed</div>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
              <div className="text-zinc-400 text-[11px]">Code Lines</div>
              <div className="font-mono text-base font-semibold text-emerald-400">
                {(repoStats.totalCodeLines ?? repoStats.codeLines ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-500">
                {repoStats.totalLines > 0 ? `${(((repoStats.totalCodeLines ?? repoStats.codeLines ?? 0) / repoStats.totalLines) * 100).toFixed(1)}% of total` : '0%'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
              <div className="text-zinc-400 text-[11px]">Comment Lines</div>
              <div className="font-mono text-base font-semibold text-cyan-400">
                {(repoStats.totalCommentLines ?? repoStats.commentLines ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-500">
                {repoStats.totalLines > 0 ? `${(((repoStats.totalCommentLines ?? repoStats.commentLines ?? 0) / repoStats.totalLines) * 100).toFixed(1)}% of total` : '0%'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
              <div className="text-zinc-400 text-[11px]">Blank Lines</div>
              <div className="font-mono text-base font-semibold text-zinc-400">
                {(repoStats.totalBlankLines ?? repoStats.blankLines ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-500">
                {repoStats.totalLines > 0 ? `${(((repoStats.totalBlankLines ?? repoStats.blankLines ?? 0) / repoStats.totalLines) * 100).toFixed(1)}% of total` : '0%'}
              </div>
            </div>
          </div>

          {/* Composition & Category Breakdown */}
          <div className="mb-3 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col gap-2 text-[11px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-zinc-300 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Indexed Files ({repoStats.totalReadableFiles}):
                </span>
                <span className="text-zinc-400 font-mono">
                  <span className="text-emerald-400 font-semibold">{repoStats.sourceFiles ?? 0}</span> source
                </span>
                <span className="text-zinc-600">&bull;</span>
                <span className="text-zinc-400 font-mono">
                  <span className="text-amber-400 font-semibold">{repoStats.configFiles ?? 0}</span> configuration
                </span>
                <span className="text-zinc-600">&bull;</span>
                <span className="text-zinc-400 font-mono">
                  <span className="text-blue-400 font-semibold">{repoStats.documentationFiles ?? 0}</span> documentation
                </span>
                <span className="text-zinc-600">&bull;</span>
                <span className="text-zinc-400 font-mono">
                  <span className="text-purple-400 font-semibold">{repoStats.dataFiles ?? 0}</span> data
                </span>
              </div>

              {(repoStats.binaryOrSkippedFiles ?? 0) > 0 && (
                <div className="text-zinc-500 font-mono text-[10px]">
                  Skipped/Binary: <span className="text-zinc-400 font-semibold">{repoStats.binaryOrSkippedFiles}</span> files (Total discovered: {repoStats.totalFiles})
                </div>
              )}
            </div>
          </div>

          {/* Breakdown by Language Table */}
          {repoStats.byLanguage && Object.keys(repoStats.byLanguage).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-900/50">
                    <th className="py-1.5 px-2">Language</th>
                    <th className="py-1.5 px-2 text-right">Files</th>
                    <th className="py-1.5 px-2 text-right">Total Lines</th>
                    <th className="py-1.5 px-2 text-right">Code</th>
                    <th className="py-1.5 px-2 text-right">Comments</th>
                    <th className="py-1.5 px-2 text-right">Blank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {Object.values(repoStats.byLanguage).map((lang) => (
                    <tr key={lang.language} className="hover:bg-zinc-800/30">
                      <td className="py-1.5 px-2 font-medium text-zinc-200 capitalize">
                        {lang.language}
                      </td>
                      <td className="py-1.5 px-2 text-right text-zinc-300">{lang.fileCount}</td>
                      <td className="py-1.5 px-2 text-right text-zinc-300">{lang.totalLines.toLocaleString()}</td>
                      <td className="py-1.5 px-2 text-right text-emerald-400">{lang.codeLines.toLocaleString()}</td>
                      <td className="py-1.5 px-2 text-right text-cyan-400">{lang.commentLines.toLocaleString()}</td>
                      <td className="py-1.5 px-2 text-right text-zinc-500">{lang.blankLines.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
