import { useState } from 'react';
import { Copy, Check, FileCode2, Sparkles, Search, GitFork, Cpu, Tag, HelpCircle, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import type { AgentFinding } from '../../types/index.js';
import { formatLineRange } from '../../utils/index.js';

interface CodeSnippetCardProps {
  finding: AgentFinding;
  index?: number;
  isAiMode?: boolean;
}

export function CodeSnippetCard({ finding, index = 1, isAiMode }: CodeSnippetCardProps) {
  const [copied, setCopied] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const { location, codeSnippet, explanation, evidence, whyThisResult, hybridScore, matchType, confidenceScore } = finding;

  const isAi = isAiMode ?? (Boolean(finding.id?.startsWith('finding_agent_')) || Boolean(finding.evidence?.some(e => e.includes('Source Tool:'))));

  const snippetContent = codeSnippet?.content ?? finding.snippet ?? '';

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(snippetContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const lines = snippetContent ? snippetContent.split('\n') : [];

  const getMatchBadge = () => {
    if (matchType === 'hybrid') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/70 text-cyan-300 border border-cyan-800/70">
          <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
          Hybrid Match
        </span>
      );
    }
    if (matchType === 'semantic') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/70 text-purple-300 border border-purple-800/70">
          <Cpu className="w-2.5 h-2.5 text-purple-400" />
          Semantic Embedding
        </span>
      );
    }
    if (matchType === 'structural') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950/70 text-indigo-300 border border-indigo-800/70">
          <GitFork className="w-2.5 h-2.5 text-indigo-400" />
          Structural AST
        </span>
      );
    }
    if (matchType === 'symbol') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/70 text-amber-300 border border-amber-800/70">
          <Tag className="w-2.5 h-2.5 text-amber-400" />
          Symbol Match
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
        <Search className="w-2.5 h-2.5 text-zinc-400" />
        Lexical Match
      </span>
    );
  };

  return (
    <div 
      id={`result-finding-card-${index}`}
      className="bg-[#111622] rounded-xl border border-zinc-800/90 overflow-hidden mb-4 transition-all shadow-sm"
    >
      {/* Header: File path & line locations */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-zinc-900/70 border-b border-zinc-800/80">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-zinc-300">
          <FileCode2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-zinc-500">File:</span>
          <span className="font-semibold text-zinc-100">{location.filePath}</span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-500">Lines:</span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-cyan-300 font-medium">
            {formatLineRange(location.startLine, location.endLine)}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
            {codeSnippet?.language ?? 'code'}
          </span>
          {location.functionName && (
            <span className="text-zinc-400 text-[11px] hidden sm:inline">
              def <span className="text-yellow-300">{location.functionName}</span>()
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {getMatchBadge()}
          {isAi ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Verified Evidence
            </span>
          ) : (
            confidenceScore !== undefined && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                Retrieval relevance: {Math.round(confidenceScore * 100)}%
              </span>
            )
          )}
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Copy snippet to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Snippet Area with exact 1-based line numbers */}
      <div className="p-4 bg-[#090d16] overflow-x-auto">
        <pre className="font-mono text-xs leading-relaxed text-zinc-200">
          <code>
            {lines.map((line, idx) => {
              const lineNumber = location.startLine + idx;
              return (
                <div key={idx} className="flex group hover:bg-zinc-800/40 px-1 -mx-1 rounded">
                  <span className="w-10 select-none text-right pr-4 text-zinc-600 group-hover:text-zinc-500 font-mono text-[11px]">
                    {lineNumber}
                  </span>
                  <span className="flex-1 whitespace-pre">{line}</span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>

      {/* Why This Result / Explanation Section */}
      <div className="p-4 bg-zinc-900/40 border-t border-zinc-800/80">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            Why this result was chosen:
          </div>

          {hybridScore && (
            <button
              type="button"
              onClick={() => setShowScoreDetails(!showScoreDetails)}
              className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
            >
              <span>Score components</span>
              {showScoreDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        <p className="text-xs sm:text-sm text-zinc-200 leading-normal">
          {whyThisResult?.primaryReason || explanation}
        </p>

        {/* Breakdown of hybrid score signals if toggled or present */}
        {showScoreDetails && hybridScore && (
          <div className="mt-2.5 p-2.5 rounded bg-zinc-950/70 border border-zinc-800 text-[11px] font-mono text-zinc-400 flex flex-wrap gap-x-4 gap-y-1">
            <span>Semantic Embedding: <strong className="text-purple-300">{Math.round(hybridScore.semanticScore * 100)}%</strong></span>
            <span>BM25 Lexical: <strong className="text-cyan-300">{Math.round(hybridScore.lexicalScore * 100)}%</strong></span>
            <span>AST Boost: <strong className="text-indigo-300">+{Math.round(hybridScore.structuralBoost * 100)}%</strong></span>
            <span>Final Combined: <strong className="text-emerald-400">{Math.round(hybridScore.finalScore * 100)}%</strong></span>
          </div>
        )}

        {evidence && evidence.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-zinc-800/60">
            <span className="text-[11px] font-medium text-zinc-500 block mb-1">
              Supporting Evidence:
            </span>
            <ul className="text-xs text-zinc-400 space-y-1 pl-4 list-disc">
              {evidence.map((item, eIdx) => (
                <li key={eIdx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
