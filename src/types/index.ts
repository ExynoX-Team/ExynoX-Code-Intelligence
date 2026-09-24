/**
 * Core domain types for ExynoX Code Intelligence
 * Designed for Samsung PRISM GenAI Hackathon (Theme 1: Agentic Code Intelligence)
 */

import type { StructuralIndexStats, StructuralQueryResult } from './structural.js';
import type { RepositoryWideStats, WhyThisResult, HybridScore } from './retrieval.js';

export * from './structural.js';
export * from './retrieval.js';
export * from './agent.js';
export * from './llm.js';

export type RepositoryType = 'zip' | 'github' | 'sample';

export interface RepositoryFile {
  path: string;
  extension: string;
  size: number;
  language: string;
  isPython: boolean;
  lineCount: number;
  sourceText: string;
  lines: string[];
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  file?: RepositoryFile;
  size?: number;
  isPython?: boolean;
  lineCount?: number;
}

export interface RepositoryStats {
  totalFiles: number;
  totalPythonFiles: number;
  totalJsFiles?: number;
  totalLines: number;
  totalPythonLines: number;
  totalJsLines?: number;
  totalBytes?: number;
  ignoredFiles: number;
  fileCount?: number;
  pythonFileCount?: number;
  pythonLines?: number;
  jsFileCount?: number;
  jsLines?: number;
  ignoredCount?: number;
}

export interface IndexingProgress {
  stage: 'received' | 'discovered' | 'reading_python' | 'building_workspace' | 'ready' | 'failed';
  message: string;
  currentStepIndex: number;
  steps: {
    id: string;
    label: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  }[];
}

export interface Repository {
  id: string;
  name: string;
  type: RepositoryType;
  language: string;
  primaryLanguage?: string;
  fileCount: number;
  pythonFileCount: number;
  jsFileCount?: number;
  totalLines: number;
  pythonLines: number;
  jsLines?: number;
  totalBytes?: number;
  ignoredFiles?: number;
  connectedAt?: string;
  sourceUrl?: string;
  status?: 'ready' | 'indexing' | 'error';
  structuralStats?: StructuralIndexStats;
  repositoryWideStats?: RepositoryWideStats;
  analysisAvailable?: boolean;
  analysisMessage?: string;
  pythonAnalysisAvailable?: boolean;
  pythonAnalysisMessage?: string;
  jsAnalysisAvailable?: boolean;
  jsAnalysisMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TextMatch {
  filePath: string;
  line: number; // 1-based exact line number
  lineText: string;
  startLine: number;
  endLine: number;
  contextLines: string[];
  lineNumber?: number;
  columnNumber?: number;
  lineContent?: string;
  preview?: string;
}

export interface CodeLocation {
  filePath: string;
  startLine: number;
  endLine: number;
  functionName?: string;
  className?: string;
}

export interface CodeSnippet {
  id: string;
  location: CodeLocation;
  content: string;
  language: string;
}

export interface SearchQuery {
  id: string;
  query: string;
  timestamp: number;
  targetRepositoryId: string;
}

export interface AgentFinding {
  id: string;
  queryId?: string;
  location: CodeLocation;
  codeSnippet?: CodeSnippet;
  snippet?: string;
  title?: string;
  category?: string;
  confidence?: number;
  explanation?: string;
  evidence?: string[];
  confidenceScore?: number;
  retrievalReason?: string;
  whyThisResult?: WhyThisResult;
  hybridScore?: HybridScore;
  matchType?: 'semantic' | 'lexical' | 'structural' | 'hybrid' | 'symbol';
  matchedSymbol?: {
    name: string;
    type: string;
  };
}

export interface SearchResult {
  query: SearchQuery;
  findings: AgentFinding[];
  textMatches?: TextMatch[];
  executionTimeMs?: number;
  searchType: 'structural_ast' | 'lexical_exact' | 'hybrid_semantic' | 'agentic_planned' | 'no_matches';
  status: 'completed' | 'no_findings' | 'error' | 'recoverable_error' | 'cancelled';
  errorMessage?: string;
  structuralResult?: StructuralQueryResult;
  investigation?: import('./agent.js').InvestigationState;
  aiAnswer?: import('./agent.js').GroundedAnswer;
  providerError?: import('./llm.js').LLMProviderErrorInfo;
  isFallbackDeterministic?: boolean;
  fallbackNotice?: string;
}

export type ApplicationState = 
  | 'no_repo' 
  | 'repo_loading' 
  | 'repo_ready' 
  | 'searching' 
  | 'results' 
  | 'error';

export interface ApplicationError {
  message: string;
  technicalDetails?: string;
  recoverable: boolean;
}

