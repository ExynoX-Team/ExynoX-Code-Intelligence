import type { 
  Repository, 
  RepositoryStats, 
  TextMatch, 
  IndexingProgress,
  PythonFileStructure,
  FunctionDefinition,
  MethodDefinition,
  ClassDefinition,
  CallSite,
  ImportReference,
  SymbolReference,
  StructuralIndexStats
} from '../../types/index.js';
import type {
  RepositoryWideStats,
  LanguageStats,
  FileMetadata,
  RetrievalFinding,
  CodeChunk,
  HybridSearchOptions
} from '../../types/retrieval.js';
import { RepositoryWorkspace } from './repositoryWorkspace.js';
import { ingestZipRepository, type ProgressCallback } from './zipIngestion.js';
import { ingestGitHubRepository } from './githubIngestion.js';
import { loadSampleRepository } from './sampleRepository.js';
import { loadSampleJavaScriptRepository } from './sampleJsRepository.js';
import { loadF1SampleRepository } from './f1SampleRepository.js';
import { retrievalTools } from '../retrieval/retrievalTools.js';

export * from './security.js';
export * from './repositoryWorkspace.js';
export * from './zipIngestion.js';
export * from './githubIngestion.js';
export * from './sampleRepository.js';
export * from './sampleJsRepository.js';
export * from './f1SampleRepository.js';

export interface IRepositoryService {
  connectFromZip(file: File, onProgress?: ProgressCallback): Promise<Repository>;
  connectFromGitHub(repoUrl: string, onProgress?: ProgressCallback): Promise<Repository>;
  getSampleRepository(onProgress?: ProgressCallback): Promise<Repository>;
  getSampleJsRepository(onProgress?: ProgressCallback): Promise<Repository>;
  getF1SampleRepository(onProgress?: ProgressCallback): Promise<Repository>;
  getActiveWorkspace(): RepositoryWorkspace | null;
  disconnect(): Promise<void>;
  
  // Deterministic text & file tools (Phase 1)
  listFiles(pythonOnly?: boolean): string[];
  readFile(path: string): string | null;
  getFileLines(path: string, startLine: number, endLine: number): string | null;
  searchText(query: string, options?: { maxResults?: number; caseSensitive?: boolean }): TextMatch[];
  getRepositoryStats(): RepositoryStats | null;

  // Deterministic structural AST tools (Phase 2)
  getFileStructure(path: string): PythonFileStructure | null;
  findFunctions(name: string): FunctionDefinition[];
  findClasses(name: string): ClassDefinition[];
  findMethods(name: string): MethodDefinition[];
  findFunctionDefinition(name: string): FunctionDefinition | null;
  findClassDefinition(name: string): ClassDefinition | null;
  findReferences(symbol: string): SymbolReference[];
  findCallers(symbol: string): CallSite[];
  findCallees(symbol: string): CallSite[];
  findImports(moduleOrName: string): ImportReference[];
  getFunctionsInFile(path: string): FunctionDefinition[];
  getClassesInFile(path: string): ClassDefinition[];
  getCallsInFunction(functionIdentifier: string): CallSite[];
  getStructuralStats(): StructuralIndexStats | null;

  // Phase 3: Repository-wide stats & Hybrid retrieval
  getRepositoryWideStats(): RepositoryWideStats | null;
  getLanguageStatistics(): Record<string, LanguageStats>;
  getFileMetadata(path: string): FileMetadata | null;
  search(query: string, options?: HybridSearchOptions): Promise<RetrievalFinding[]>;
  semanticSearch(query: string, topK?: number): Promise<RetrievalFinding[]>;
  searchByLanguage(query: string, language: string, topK?: number): Promise<RetrievalFinding[]>;
  searchBySymbol(symbolName: string, topK?: number): Promise<RetrievalFinding[]>;
  retrieveRelevantChunks(query: string, topK?: number): Promise<CodeChunk[]>;
}

/**
 * RepositoryService - Phase 2 Structural Repository Service
 * Coordinates safe ZIP extraction, GitHub ingestion, and deterministic workspace AST tooling.
 */
export class RepositoryService implements IRepositoryService {
  private activeWorkspace: RepositoryWorkspace | null = null;

  async connectFromZip(file: File, onProgress?: ProgressCallback): Promise<Repository> {
    const workspace = await ingestZipRepository(file, onProgress);
    this.activeWorkspace = workspace;
    return workspace.toRepositorySummary();
  }

  async connectFromGitHub(repoUrl: string, onProgress?: ProgressCallback): Promise<Repository> {
    const workspace = await ingestGitHubRepository(repoUrl, onProgress);
    this.activeWorkspace = workspace;
    return workspace.toRepositorySummary();
  }

  async getSampleRepository(onProgress?: ProgressCallback): Promise<Repository> {
    const workspace = await loadSampleJavaScriptRepository(onProgress);
    this.activeWorkspace = workspace;
    return workspace.toRepositorySummary();
  }

  async getSampleJsRepository(onProgress?: ProgressCallback): Promise<Repository> {
    const workspace = await loadSampleJavaScriptRepository(onProgress);
    this.activeWorkspace = workspace;
    return workspace.toRepositorySummary();
  }

  async getSamplePythonRepository(onProgress?: ProgressCallback): Promise<Repository> {
    const workspace = await loadSampleRepository(onProgress);
    this.activeWorkspace = workspace;
    return workspace.toRepositorySummary();
  }

  async getF1SampleRepository(onProgress?: ProgressCallback): Promise<Repository> {
    const workspace = await loadF1SampleRepository(onProgress);
    this.activeWorkspace = workspace;
    return workspace.toRepositorySummary();
  }

  getActiveWorkspace(): RepositoryWorkspace | null {
    return this.activeWorkspace;
  }

  async disconnect(): Promise<void> {
    this.activeWorkspace = null;
  }

  listFiles(pythonOnly = false): string[] {
    if (!this.activeWorkspace) return [];
    return this.activeWorkspace.listFiles(pythonOnly);
  }

  readFile(path: string): string | null {
    if (!this.activeWorkspace) return null;
    return this.activeWorkspace.readFile(path);
  }

  getFileLines(path: string, startLine: number, endLine: number): string | null {
    if (!this.activeWorkspace) return null;
    return this.activeWorkspace.getFileLines(path, startLine, endLine);
  }

  searchText(query: string, options?: { maxResults?: number; caseSensitive?: boolean }): TextMatch[] {
    if (!this.activeWorkspace) return [];
    return this.activeWorkspace.searchText(query, options);
  }

  getRepositoryStats(): RepositoryStats | null {
    if (!this.activeWorkspace) return null;
    return this.activeWorkspace.getRepositoryStats();
  }

  // Phase 2 Structural Tools
  getFileStructure(path: string): PythonFileStructure | null {
    if (!this.activeWorkspace) return null;
    return this.activeWorkspace.getFileStructure(path);
  }

  findFunctions(name: string): FunctionDefinition[] {
    if (!this.activeWorkspace) return [];
    return this.activeWorkspace.findFunctions(name);
  }

  findClasses(name: string): ClassDefinition[] {
    if (!this.activeWorkspace) return [];
    return this.activeWorkspace.findClasses(name);
  }

  findMethods(name: string): MethodDefinition[] {
    if (!this.activeWorkspace) return [];
    return this.activeWorkspace.findMethods(name);
  }

  findFunctionDefinition(name: string): FunctionDefinition | null {
    if (!this.activeWorkspace) return null;
    return this.activeWorkspace.findFunctionDefinition(name);
  }

  findClassDefinition(name: string): ClassDefinition | null {
    if (!this.activeWorkspace) return null;
    return this.activeWorkspace.findClassDefinition(name);
  }

  findReferences(symbol: string): SymbolReference[] {
    if (!this.activeWorkspace) return [];
    return this.activeWorkspace.findReferences(symbol);
  }

  findCallers(symbol: string): CallSite[] {
    if (!this.activeWorkspace) return [];
    return this.activeWorkspace.findCallers(symbol);
  }

  findCallees(symbol: string): CallSite[] {
    if (!this.activeWorkspace) return [];
    return this.activeWorkspace.findCallees(symbol);
  }

  findImports(moduleOrName: string): ImportReference[] {
    if (!this.activeWorkspace) return [];
    return this.activeWorkspace.findImports(moduleOrName);
  }

  getFunctionsInFile(path: string): FunctionDefinition[] {
    if (!this.activeWorkspace) return [];
    return this.activeWorkspace.getFunctionsInFile(path);
  }

  getClassesInFile(path: string): ClassDefinition[] {
    if (!this.activeWorkspace) return [];
    return this.activeWorkspace.getClassesInFile(path);
  }

  getCallsInFunction(functionIdentifier: string): CallSite[] {
    if (!this.activeWorkspace) return [];
    return this.activeWorkspace.getCallsInFunction(functionIdentifier);
  }

  getStructuralStats(): StructuralIndexStats | null {
    if (!this.activeWorkspace) return null;
    return this.activeWorkspace.getStructuralStats();
  }

  // --------------------------------------------------------------------------
  // Phase 3: Repository-wide stats & Hybrid retrieval
  // --------------------------------------------------------------------------

  getRepositoryWideStats(): RepositoryWideStats | null {
    if (!this.activeWorkspace) return null;
    return this.activeWorkspace.getRepositoryWideStats();
  }

  getLanguageStatistics(): Record<string, LanguageStats> {
    if (!this.activeWorkspace) return {};
    return this.activeWorkspace.getLanguageStatistics();
  }

  getFileMetadata(path: string): FileMetadata | null {
    if (!this.activeWorkspace) return null;
    return this.activeWorkspace.getFileMetadata(path);
  }

  async search(query: string, options?: HybridSearchOptions): Promise<RetrievalFinding[]> {
    return retrievalTools.searchRepository(query, options);
  }

  async semanticSearch(query: string, topK?: number): Promise<RetrievalFinding[]> {
    return retrievalTools.semanticSearch(query, { topK });
  }

  async searchByLanguage(query: string, language: string, topK?: number): Promise<RetrievalFinding[]> {
    return retrievalTools.searchByLanguage(query, language, topK);
  }

  async searchBySymbol(symbolName: string, topK?: number): Promise<RetrievalFinding[]> {
    return retrievalTools.searchBySymbol(symbolName, topK);
  }

  async retrieveRelevantChunks(query: string, topK?: number): Promise<CodeChunk[]> {
    return retrievalTools.retrieveRelevantChunks(query, topK);
  }
}

export const repositoryService = new RepositoryService();
