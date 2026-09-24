import type { SearchQuery, SearchResult, AgentFinding } from '../../types/index.js';
import type { ConversationTurn, InvestigationState, InvestigationStatus, EvidenceItem } from '../../types/agent.js';
import { repositoryService } from '../repository/index.js';
import { routeStructuralQuery } from '../structural/index.js';
import { deterministicEngine } from '../deterministic/index.js';
import { llmRegistry } from '../llm/index.js';
import { LLMProviderError } from '../llm/llmErrors.js';
import { InvestigationEngine } from './investigationEngine.js';

export * from '../../types/agent.js';
export * from './investigationEngine.js';

export type AgentStepType = 
  | 'PLAN' 
  | 'SEARCH' 
  | 'READ' 
  | 'ANALYZE' 
  | 'REFINE' 
  | 'ANSWER';

export interface AgentStep {
  step: AgentStepType;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp: number;
}

export interface IAgentService {
  executePlan(
    query: SearchQuery, 
    options?: { onStatusUpdate?: (status: InvestigationStatus, message: string, state: InvestigationState) => void }
  ): Promise<SearchResult>;
  getConversationHistory(): ConversationTurn[];
  clearHistory(): void;
}

/**
 * AgentService - Controlled Agentic Investigation & Reasoning Service
 * Integrates Phase 4 Agentic Loop with Multi-Provider LLMs while preserving
 * full deterministic Phase 1–3 fallback behavior when AI is disabled.
 */
export class AgentService implements IAgentService {
  private conversationHistory: ConversationTurn[] = [];

  public getConversationHistory(): ConversationTurn[] {
    return [...this.conversationHistory];
  }

  public clearHistory(): void {
    this.conversationHistory = [];
  }

  async executePlan(
    query: SearchQuery, 
    options?: { 
      onStatusUpdate?: (status: InvestigationStatus, message: string, state: InvestigationState) => void;
      forceDeterministic?: boolean;
    }
  ): Promise<SearchResult> {
    const startTime = performance.now();
    const cleanQuery = query.query.trim();

    if (!cleanQuery) {
      return {
        query,
        findings: [],
        searchType: 'no_matches',
        status: 'no_findings',
        executionTimeMs: Math.round(performance.now() - startTime)
      };
    }

    const workspace = repositoryService.getActiveWorkspace();
    const isAIActive = !options?.forceDeterministic && llmRegistry.isAIActive();

    // ========================================================================
    // MODE 1: AI-ENABLED AGENTIC INVESTIGATION LOOP (Phase 4)
    // ========================================================================
    if (isAIActive && workspace) {
      try {
        const provider = llmRegistry.getActiveProvider();
        const apiKey = llmRegistry.getApiKey();
        const engine = new InvestigationEngine(workspace, provider);

        const investigation = await engine.investigate(cleanQuery, {
          maxIterations: 6,
          conversationHistory: this.conversationHistory,
          apiKey,
          onStatusUpdate: options?.onStatusUpdate
        });

        const elapsed = Math.round(performance.now() - startTime);

        // Check for Partial Investigation Recovery (Phase 6.7)
        if (investigation.status === 'recoverable_error' || (investigation.providerError && investigation.evidence && investigation.evidence.length > 0)) {
          const findings = this.convertEvidenceToFindings(investigation.evidence, query.id);
          return {
            query,
            findings,
            searchType: 'agentic_planned',
            status: 'recoverable_error',
            errorMessage: investigation.providerError?.message || investigation.statusMessage,
            providerError: investigation.providerError,
            executionTimeMs: elapsed,
            investigation
          };
        }

        // If the investigation failed completely with no evidence
        if (investigation.providerError) {
          return {
            query,
            findings: [],
            searchType: 'agentic_planned',
            status: 'error',
            errorMessage: investigation.providerError.message,
            providerError: investigation.providerError,
            executionTimeMs: elapsed,
            investigation
          };
        }

        // Convert verified evidence items to AgentFinding structures for UI compatibility
        const findings: AgentFinding[] = this.convertEvidenceToFindings(investigation.evidence, query.id);

        // Record conversation turn for contextual follow-up questions
        if (investigation.finalAnswer) {
          this.conversationHistory.push({
            id: `turn_${Date.now()}`,
            question: cleanQuery,
            answer: investigation.finalAnswer.answer,
            evidence: investigation.evidence,
            timestamp: Date.now(),
            investigationState: investigation
          });
        }

        return {
          query,
          findings,
          searchType: 'agentic_planned',
          status: findings.length > 0 ? 'completed' : 'no_findings',
          executionTimeMs: elapsed,
          investigation,
          aiAnswer: investigation.finalAnswer
        };
      } catch (agentErr) {
        if (agentErr instanceof LLMProviderError || (agentErr && typeof agentErr === 'object' && 'info' in agentErr)) {
          const providerError = (agentErr as LLMProviderError).info;
          const elapsed = Math.round(performance.now() - startTime);
          return {
            query,
            findings: [],
            searchType: 'agentic_planned',
            status: 'error',
            errorMessage: providerError.message,
            providerError,
            executionTimeMs: elapsed,
            investigation: {
              question: cleanQuery,
              plan: {
                strategy: providerError.title || 'AI provider temporarily unavailable',
                focusHypothesis: '',
                plannedSteps: []
              },
              iteration: 0,
              maxIterations: 6,
              toolCalls: [],
              searches: [],
              evidence: [],
              evidenceGraph: { nodes: [], edges: [] },
              unresolvedQuestions: [],
              confidence: 0,
              status: 'failed',
              statusMessage: providerError.title || 'AI provider temporarily unavailable',
              error: providerError.message,
              providerError
            }
          };
        }
        console.warn('AI agent investigation failed, falling back to deterministic search:', agentErr);
        // Fall through to deterministic execution if other agent error occurs
      }
    }

    // ========================================================================
    // MODE 2: DETERMINISTIC SEARCH (Phases 1–3, AI Disabled or Fallback)
    // ========================================================================

    // 1. Attempt deterministic AST structural routing first if workspace exists and Python analysis is available
    if (workspace && workspace.structuralIndex && workspace.pythonAnalysisAvailable) {
      const structuralOutcome = routeStructuralQuery(cleanQuery, workspace.structuralIndex, workspace);
      if (structuralOutcome.handled) {
        const elapsed = Math.round(performance.now() - startTime);
        if (structuralOutcome.findings.length > 0) {
          return {
            query,
            findings: structuralOutcome.findings,
            searchType: 'structural_ast',
            status: 'completed',
            executionTimeMs: elapsed,
            structuralResult: structuralOutcome.queryResult
          };
        } else {
          return {
            query,
            findings: [],
            searchType: 'structural_ast',
            status: 'no_findings',
            executionTimeMs: elapsed,
            structuralResult: structuralOutcome.queryResult
          };
        }
      }
    }

    // 2. Phase 6.5 Deterministic Query Intelligence (Zero-LLM Intent Classification & Cross-Modal Retrieval)
    if (workspace) {
      try {
        const detResult = await deterministicEngine.execute(cleanQuery, workspace);
        const elapsed = Math.round(performance.now() - startTime);

        if (detResult.findings.length > 0) {
          return {
            query,
            findings: detResult.findings.map(f => ({
              ...f,
              confidenceScore: (f as any).confidenceScore ?? f.confidence ?? 1.0
            })),
            searchType: detResult.searchType,
            status: 'completed',
            executionTimeMs: elapsed,
            structuralResult: detResult.structuralResult
          };
        } else if (detResult.isNegative) {
          return {
            query,
            findings: [],
            searchType: 'no_matches',
            status: 'no_findings',
            executionTimeMs: elapsed,
            structuralResult: detResult.structuralResult,
            errorMessage: detResult.explanation
          };
        }
      } catch (detErr) {
        console.warn('Deterministic query engine fallback warning:', detErr);
      }
    }

    // 3. Hybrid semantic + lexical + structural retrieval (Phase 3)
    const hybridResults = await repositoryService.search(cleanQuery, { topK: 8 });
    if (hybridResults.length > 0) {
      const elapsed = Math.round(performance.now() - startTime);
      const findings: AgentFinding[] = hybridResults.map((hr, idx) => ({
        id: hr.id || `finding_${idx + 1}`,
        queryId: query.id,
        location: {
          filePath: hr.filePath,
          startLine: hr.startLine,
          endLine: hr.endLine,
          functionName: hr.symbolName
        },
        codeSnippet: {
          id: `snip_${idx + 1}`,
          location: {
            filePath: hr.filePath,
            startLine: hr.startLine,
            endLine: hr.endLine,
            functionName: hr.symbolName
          },
          content: hr.relevantSource,
          language: hr.language
        },
        explanation: hr.retrievalReason || `Retrieved via ${hr.matchType} matching with confidence ${(hr.confidenceScore * 100).toFixed(0)}%`,
        evidence: hr.evidence,
        confidenceScore: hr.confidenceScore,
        retrievalReason: hr.retrievalReason,
        whyThisResult: hr.whyThisResult,
        hybridScore: hr.hybridScore,
        matchType: hr.matchType,
        matchedSymbol: hr.symbolName ? { name: hr.symbolName, type: hr.symbolType || 'code' } : undefined
      }));

      return {
        query,
        findings,
        searchType: 'hybrid_semantic',
        status: 'completed',
        executionTimeMs: elapsed
      };
    }

    // 3. Fallback to deterministic lexical search across repository files
    let matches = repositoryService.searchText(cleanQuery, { maxResults: 10 });

    // If no exact matches for multi-word question, search for key identifiers/keywords
    if (matches.length === 0) {
      const stopWords = new Set(['where', 'which', 'what', 'when', 'call', 'calls', 'function', 'before', 'after', 'used', 'handled', 'implemented', 'file', 'files', 'does', 'this', 'that', 'with', 'from', 'the', 'are', 'in']);
      const tokens = cleanQuery
        .replace(/[^a-zA-Z0-9_]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 4 && !stopWords.has(t.toLowerCase()));

      for (const token of tokens) {
        const tokenMatches = repositoryService.searchText(token, { maxResults: 5 });
        for (const tm of tokenMatches) {
          if (!matches.some(m => m.filePath === tm.filePath && m.line === tm.line)) {
            matches.push(tm);
          }
        }
        if (matches.length >= 10) break;
      }
    }

    const elapsed = Math.round(performance.now() - startTime);

    if (matches.length === 0) {
      return {
        query,
        findings: [],
        textMatches: [],
        searchType: 'no_matches',
        status: 'no_findings',
        executionTimeMs: elapsed
      };
    }

    // Convert deterministic text matches to structured findings
    const findings: AgentFinding[] = matches.map((match, idx) => {
      return {
        id: `finding_${idx + 1}_${match.line}`,
        queryId: query.id,
        location: {
          filePath: match.filePath,
          startLine: match.startLine,
          endLine: match.endLine,
        },
        codeSnippet: {
          id: `snip_${idx + 1}`,
          location: {
            filePath: match.filePath,
            startLine: match.startLine,
            endLine: match.endLine
          },
          content: match.contextLines.join('\n'),
          language: match.filePath.endsWith('.py') ? 'python' : 'text'
        },
        explanation: `Deterministic lexical match found on line ${match.line}: "${match.lineText.trim()}"`,
        evidence: [
          `File: ${match.filePath}`,
          `Line ${match.line} in repository workspace`,
          `Context lines ${match.startLine} to ${match.endLine}`
        ],
        confidenceScore: 1.0
      };
    });

    return {
      query,
      findings,
      textMatches: matches,
      searchType: 'lexical_exact',
      status: 'completed',
      executionTimeMs: elapsed
    };
  }

  /**
   * Converts verified EvidenceItems into AgentFinding UI structures.
   */
  public convertEvidenceToFindings(evidence: EvidenceItem[], queryId: string): AgentFinding[] {
    return (evidence || []).map((ev, idx) => ({
      id: ev.id || `finding_agent_${idx + 1}`,
      queryId,
      location: {
        filePath: ev.filePath,
        startLine: ev.startLine,
        endLine: ev.endLine,
        functionName: ev.symbolName
      },
      codeSnippet: {
        id: `snip_${idx + 1}`,
        location: {
          filePath: ev.filePath,
          startLine: ev.startLine,
          endLine: ev.endLine,
          functionName: ev.symbolName
        },
        content: ev.codeSnippet,
        language: ev.filePath.endsWith('.py') ? 'python' : (ev.filePath.split('.').pop() || 'text')
      },
      explanation: ev.relevanceReason,
      evidence: [
        `File: ${ev.filePath}`,
        `Lines: ${ev.startLine}–${ev.endLine}`,
        `Source Tool: ${ev.sourceTool}`
      ],
      confidenceScore: ev.confidence,
      retrievalReason: ev.relevanceReason,
      matchType: ev.relationshipType === 'caller' ? 'structural' : (ev.relationshipType === 'definition' ? 'structural' : 'hybrid'),
      matchedSymbol: ev.symbolName ? { name: ev.symbolName, type: ev.symbolType || 'symbol' } : undefined
    }));
  }

  /**
   * Deterministic Fallback Trigger (Phase 6.7)
   * Explicitly triggered when user clicks [Use Retrieved Evidence].
   * Invokes the deterministic answer engine and clearly labels the result.
   */
  public useRetrievedEvidence(
    query: SearchQuery, 
    investigation: InvestigationState
  ): SearchResult {
    const workspace = repositoryService.getActiveWorkspace();
    const engine = new InvestigationEngine(workspace || ({} as any));

    // Synthesize deterministic answer using the verified evidence
    const deterministicAnswer = engine.synthesizeDeterministicAnswer(investigation);
    deterministicAnswer.isFallbackDeterministic = true;
    deterministicAnswer.fallbackNotice = 'AI synthesis unavailable — showing verified repository evidence.';

    investigation.status = 'completed';
    investigation.statusMessage = 'Completed using verified repository evidence';
    investigation.finalAnswer = deterministicAnswer;
    investigation.isFallbackDeterministic = true;
    investigation.fallbackNotice = deterministicAnswer.fallbackNotice;

    const findings = this.convertEvidenceToFindings(investigation.evidence, query.id);

    return {
      query,
      findings,
      searchType: 'agentic_planned',
      status: 'completed',
      aiAnswer: deterministicAnswer,
      isFallbackDeterministic: true,
      fallbackNotice: deterministicAnswer.fallbackNotice,
      investigation
    };
  }
}

export const agentService = new AgentService();
