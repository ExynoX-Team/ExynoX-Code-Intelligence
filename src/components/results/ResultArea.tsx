import { GitFork, Search, Sparkles, Bot, CheckCircle2, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import type { SearchResult } from '../../types/index.js';
import type { InvestigationStatus, InvestigationState } from '../../types/agent.js';
import { llmRegistry } from '../../services/llm/index.js';
import { CodeSnippetCard } from './CodeSnippetCard.js';
import { EmptyResultState } from './EmptyResultState.js';
import { GroundedAnswerCard } from './GroundedAnswerCard.js';
import { ProviderErrorCard } from './ProviderErrorCard.js';
import { StructuralResultCard } from './StructuralResultCard.js';
import { InvestigationDetails } from '../investigation/InvestigationDetails.js';
import { InvestigationPanel } from '../investigation/InvestigationPanel.js';

interface ResultAreaProps {
  result: SearchResult | null;
  isSearching: boolean;
  hasSearched: boolean;
  isAiActive?: boolean;
  liveInvestigationStatus?: {
    status: InvestigationStatus;
    message: string;
    state?: InvestigationState;
  } | null;
  onRetry?: () => void;
  onChangeProvider?: () => void;
  onUseRetrievedEvidence?: () => void;
}

export function ResultArea({ 
  result, 
  isSearching, 
  hasSearched,
  isAiActive,
  liveInvestigationStatus,
  onRetry,
  onChangeProvider,
  onUseRetrievedEvidence
}: ResultAreaProps) {
  const isAi = isAiActive ?? llmRegistry.isAIActive();

  if (isSearching) {
    if (!isAi) {
      // AI OFF: Concise loading state
      return (
        <div id="deterministic-searching-state" className="w-full text-center py-10 px-6 rounded-xl bg-[#111622] border border-zinc-800/80 shadow-sm">
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin mx-auto mb-2.5" />
          <h3 className="text-sm font-medium text-zinc-200">
            Searching your repository...
          </h3>
          <p className="mt-1 text-xs text-zinc-500 font-mono">
            Fast deterministic retrieval (AST & lexical index)
          </p>
        </div>
      );
    }

    // AI ON: Full real-time investigation panel
    return (
      <div id="investigation-live-container" className="w-full space-y-4">
        <InvestigationPanel
          isLive={true}
          investigation={liveInvestigationStatus?.state}
          events={liveInvestigationStatus?.state?.events}
        />
      </div>
    );
  }

  if (!hasSearched) {
    return <EmptyResultState hasQuery={false} />;
  }

  // Handle recoverable AI provider errors (e.g. 503 Provider Unavailable, 429 Rate Limit, 401 Auth)
  const providerError = result?.providerError || result?.investigation?.providerError;
  if (providerError) {
    const hasEvidence = Boolean(result?.investigation?.evidence && result.investigation.evidence.length > 0);
    return (
      <div id="results-container" className="space-y-4">
        {result?.investigation && (
          <InvestigationPanel 
            investigation={result.investigation}
            events={result.investigation.events}
            providerError={providerError}
          />
        )}
        <ProviderErrorCard 
          errorInfo={providerError}
          onRetry={onRetry}
          onChangeProvider={onChangeProvider}
          hasEvidence={hasEvidence}
          onUseRetrievedEvidence={onUseRetrievedEvidence}
        />
        {/* If verified evidence exists, display preserved candidate findings for inspection */}
        {hasEvidence && result?.findings && result.findings.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono px-1">
              <span className="flex items-center gap-1.5 text-zinc-300 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Preserved Verified Code Evidence ({result.findings.length})
              </span>
              <span>Available for inspection</span>
            </div>
            <div className="space-y-3">
              {result.findings.map((finding) => (
                <CodeSnippetCard 
                  key={finding.id} 
                  finding={finding} 
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (result && (result.findings?.length > 0 || result.aiAnswer || result.investigation || result.structuralResult)) {
    const isAgentic = result.searchType === 'agentic_planned' || Boolean(result.investigation);
    const isStructural = result.searchType === 'structural_ast';
    const isHybrid = result.searchType === 'hybrid_semantic';

    return (
      <div id="results-container" className="space-y-4">
        {/* AI OFF: Deterministic Evidence Found / Structural Analysis Banner */}
        {!isAgentic && (
          <div 
            id="deterministic-evidence-banner"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#111622] border border-zinc-800/90 text-xs"
          >
            <div className="flex items-center gap-2">
              {result.findings.length > 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
              <span className="font-semibold text-zinc-200">
                {result.findings.length > 0 ? 'Evidence found' : 'Structural inspection complete'}
              </span>
              <span className="text-zinc-500 font-mono text-[11px]">
                &bull; {result.findings.length} matching code {result.findings.length === 1 ? 'location' : 'locations'} retrieved
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                {isStructural ? 'AST Structural Engine' : 'Retrieved Evidence'}
              </span>
              {result.executionTimeMs !== undefined && (
                <span>{result.executionTimeMs}ms</span>
              )}
            </div>
          </div>
        )}

        {/* Dedicated AST Structural Result Card (Call chain, references, callees, callers, etc.) */}
        {result.structuralResult && (
          <StructuralResultCard structuralResult={result.structuralResult} />
        )}

        {/* AI ON: ExynoX Investigation Panel — Displays completed real operations */}
        {isAgentic && result.investigation && (
          <InvestigationPanel 
            investigation={result.investigation}
            events={result.investigation.events}
          />
        )}

        {/* AI ON: Grounded AI Answer Card if AI generated an answer */}
        {isAgentic && result.aiAnswer && (
          <GroundedAnswerCard answer={result.aiAnswer} />
        )}

        {/* AI ON: Detailed AST & Tool Trace Accordion ("How ExynoX found this") */}
        {isAgentic && result.investigation && (
          <InvestigationDetails investigation={result.investigation} />
        )}

        {/* Findings Header */}
        {result.findings && result.findings.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-300">
                  {isAgentic ? `Verified Code Matches (${result.findings.length})` : `Retrieved Evidence (${result.findings.length})`}
                </span>
                {isAgentic ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/70">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      Verified Evidence
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/70">
                      <Bot className="w-3 h-3 text-cyan-400" />
                      Agentic Investigation
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      Retrieved Evidence
                    </span>
                    {isStructural && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-800/70">
                        <GitFork className="w-3 h-3 text-indigo-400" />
                        Structural AST Match
                      </span>
                    )}
                    {isHybrid && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/70">
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        Hybrid Semantic + Lexical Match
                      </span>
                    )}
                    {!isStructural && !isHybrid && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-cyan-400 border border-zinc-700">
                        <Search className="w-3 h-3 text-cyan-400" />
                        Lexical Match
                      </span>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                {result.executionTimeMs !== undefined && (
                  <span className="text-[11px] font-mono text-zinc-500">
                    {result.executionTimeMs}ms
                  </span>
                )}
              </div>
            </div>

            {/* Code Snippet Cards */}
            {result.findings.map((finding, idx) => (
              <CodeSnippetCard 
                key={finding.id || idx} 
                finding={finding} 
                index={idx + 1}
                isAiMode={isAgentic}
              />
            ))}
          </>
        )}
      </div>
    );
  }

  return <EmptyResultState hasQuery={true} queryText={result?.query.query} />;
}

