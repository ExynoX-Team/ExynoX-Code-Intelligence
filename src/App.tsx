import { useState, useEffect } from 'react';
import { Header } from './components/layout/Header.js';
import { RepositoryConnect } from './components/repository/RepositoryConnect.js';
import { RepositoryBadge } from './components/repository/RepositoryBadge.js';
import { IndexingProgressView } from './components/repository/IndexingProgressView.js';
import { SearchSection } from './components/search/SearchSection.js';
import { ResultArea } from './components/results/ResultArea.js';
import { ErrorState } from './components/common/ErrorState.js';
import { AIConfigModal } from './components/ai/AIConfigModal.js';
import { EvaluationSection } from './components/evaluation/EvaluationSection.js';
import { repositoryService } from './services/repository/index.js';
import { agentService } from './services/agent/index.js';
import { llmRegistry } from './services/llm/index.js';
import type { 
  Repository, 
  SearchResult, 
  ApplicationState, 
  ApplicationError,
  IndexingProgress,
  InvestigationStatus,
  InvestigationState
} from './types/index.js';

export default function App() {
  const [appState, setAppState] = useState<ApplicationState>('no_repo');
  const [repository, setRepository] = useState<Repository | null>(null);
  const [indexingProgress, setIndexingProgress] = useState<IndexingProgress | null>(null);
  const [error, setError] = useState<ApplicationError | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [liveInvestigationStatus, setLiveInvestigationStatus] = useState<{
    status: InvestigationStatus;
    message: string;
    state?: InvestigationState;
  } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState<string>('');
  const [isAIModalOpen, setIsAIModalOpen] = useState<boolean>(false);
  const [isAIActive, setIsAIActive] = useState<boolean>(llmRegistry.isAIActive());
  const [activeTab, setActiveTab] = useState<'ask' | 'evaluation'>('ask');

  useEffect(() => {
    return llmRegistry.subscribe((cfg) => {
      setIsAIActive(cfg.enabled && !!(cfg.apiKey || cfg.hasServerKey));
    });
  }, []);

  // Connect via uploaded ZIP file
  const handleConnectZip = async (file: File) => {
    try {
      setAppState('repo_loading');
      setError(null);
      setIndexingProgress(null);
      
      const repo = await repositoryService.connectFromZip(file, (p) => {
        setIndexingProgress(p);
      });

      setRepository(repo);
      setAppState('repo_ready');
      setHasSearched(false);
      setSearchResult(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError({
        message: msg || 'Failed to ingest ZIP repository.',
        technicalDetails: err instanceof Error ? err.stack : undefined,
        recoverable: true
      });
      setAppState('error');
    }
  };

  // Connect via GitHub URL
  const handleConnectGitHub = async (url: string) => {
    try {
      setAppState('repo_loading');
      setError(null);
      setIndexingProgress(null);

      const repo = await repositoryService.connectFromGitHub(url, (p) => {
        setIndexingProgress(p);
      });

      setRepository(repo);
      setAppState('repo_ready');
      setHasSearched(false);
      setSearchResult(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError({
        message: msg || 'Failed to connect to GitHub repository.',
        technicalDetails: err instanceof Error ? err.stack : undefined,
        recoverable: true
      });
      setAppState('error');
    }
  };

  // Load sample Python repository
  const handleConnectSample = async () => {
    try {
      setAppState('repo_loading');
      setError(null);
      setIndexingProgress(null);

      const repo = await repositoryService.getSampleRepository((p) => {
        setIndexingProgress(p);
      });

      setRepository(repo);
      setAppState('repo_ready');
      setHasSearched(false);
      setSearchResult(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError({
        message: msg || 'Failed to load sample repository.',
        technicalDetails: err instanceof Error ? err.stack : undefined,
        recoverable: true
      });
      setAppState('error');
    }
  };

  // Switch or disconnect repository
  const handleReset = async () => {
    await repositoryService.disconnect();
    agentService.clearHistory();
    setAppState('no_repo');
    setRepository(null);
    setIndexingProgress(null);
    setError(null);
    setSearchResult(null);
    setHasSearched(false);
    setIsSearching(false);
    setLiveInvestigationStatus(null);
  };

  // Handle asking a codebase question (Phase 1-4 Search & Agentic Loop)
  const handleAsk = async (queryText: string) => {
    if (!repository) return;

    setIsSearching(true);
    setHasSearched(true);
    setSearchResult(null);
    setLastQuery(queryText);
    setAppState('searching');
    setLiveInvestigationStatus(null);

    try {
      const queryPayload = {
        id: `query_${Date.now()}`,
        query: queryText,
        timestamp: Date.now(),
        targetRepositoryId: repository.id
      };

      const result = await agentService.executePlan(queryPayload, {
        onStatusUpdate: (status, message, invState) => {
          setLiveInvestigationStatus({
            status,
            message,
            state: invState
          });
        }
      });
      setSearchResult(result);
      setAppState('results');
    } catch (err) {
      setError({
        message: 'Unable to execute search across repository.',
        technicalDetails: String(err),
        recoverable: true
      });
      setAppState('error');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-[#e2e8f0]">
      {/* Universal Top Header */}
      <Header onReset={handleReset} repository={repository} />

      {/* Main App Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* State: Error */}
        {appState === 'error' && error && (
          <ErrorState 
            error={error} 
            onRetry={handleReset} 
          />
        )}

        {/* State: Repository Loading */}
        {appState === 'repo_loading' && (
          <IndexingProgressView progress={indexingProgress} />
        )}

        {/* State: No Repository Connected (Landing) */}
        {appState === 'no_repo' && (
          <RepositoryConnect
            onConnectZip={handleConnectZip}
            onConnectGitHub={handleConnectGitHub}
            onConnectSample={handleConnectSample}
            isLoading={false}
          />
        )}

        {/* States: Repository Ready, Searching, or Results */}
        {(appState === 'repo_ready' || appState === 'searching' || appState === 'results') && repository && (
          <div className="w-full">
            {/* Repository Status Badge */}
            <RepositoryBadge 
              repository={repository} 
              onChangeRepository={handleReset} 
            />

            {/* View Mode Tabs: Ask Codebase (Phase 1-5) vs Evaluation & Benchmarks (Phase 6) */}
            <div className="flex items-center gap-2 mb-6 border-b border-zinc-800/80 pb-2">
              <button
                id="tab-ask-codebase"
                type="button"
                onClick={() => setActiveTab('ask')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'ask'
                    ? 'bg-zinc-800 text-cyan-300 border border-zinc-700 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Ask Codebase
              </button>
              <button
                id="tab-evaluation-benchmarks"
                type="button"
                onClick={() => setActiveTab('evaluation')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'evaluation'
                    ? 'bg-zinc-800 text-cyan-300 border border-zinc-700 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                Evaluation & Benchmarking
              </button>
            </div>

            {/* TAB 1: Normal Ask Codebase User Experience (Completely Unaffected) */}
            {activeTab === 'ask' && (
              <>
                {/* Ask Codebase Search Section */}
                <SearchSection 
                  onAsk={handleAsk} 
                  isSearching={isSearching} 
                />

                {/* Code Findings & Result Area */}
                <ResultArea 
                  result={searchResult}
                  isSearching={isSearching}
                  hasSearched={hasSearched}
                  isAiActive={isAIActive}
                  liveInvestigationStatus={liveInvestigationStatus}
                  onRetry={() => {
                    if (lastQuery) {
                      handleAsk(lastQuery);
                    }
                  }}
                  onChangeProvider={() => setIsAIModalOpen(true)}
                  onUseRetrievedEvidence={() => {
                    if (searchResult?.investigation && searchResult?.query) {
                      const fallbackResult = agentService.useRetrievedEvidence(
                        searchResult.query,
                        searchResult.investigation
                      );
                      setSearchResult(fallbackResult);
                    }
                  }}
                />
              </>
            )}

            {/* TAB 2: Phase 6 Evaluation & Benchmarking Engine */}
            {activeTab === 'evaluation' && (
              <EvaluationSection repository={repository} />
            )}
          </div>
        )}

        {/* Global AI Configuration Modal */}
        <AIConfigModal
          isOpen={isAIModalOpen}
          onClose={() => setIsAIModalOpen(false)}
        />
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-800/60 py-4 px-4 sm:px-6 bg-[#090d16]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-300">ExynoX Code Intelligence</span>
            <span>&bull;</span>
            <span>Samsung PRISM GenAI Hackathon 3rd Edition (2026–27)</span>
          </div>
          <div className="text-zinc-400 font-mono text-[11px]">
            Theme 1 — Agentic Code Intelligence
          </div>
        </div>
      </footer>
    </div>
  );
}
