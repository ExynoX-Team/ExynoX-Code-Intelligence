/**
 * Deterministic Retrieval API and Tool Functions
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 */

import type { 
  RetrievalFinding, 
  CodeChunk, 
  RepositoryWideStats, 
  LanguageStats, 
  FileMetadata, 
  FileCategory, 
  HybridSearchOptions 
} from '../../types/retrieval.js';
import type { RepositoryIndex } from '../indexing/repositoryIndex.js';

export class RetrievalTools {
  private index: RepositoryIndex | null = null;

  setIndex(index: RepositoryIndex): void {
    this.index = index;
  }

  getIndex(): RepositoryIndex | null {
    return this.index;
  }

  /**
   * Universal repository search (Hybrid by default).
   */
  async searchRepository(query: string, options?: HybridSearchOptions): Promise<RetrievalFinding[]> {
    if (!this.index) return [];
    return this.index.search(query, options);
  }

  /**
   * Pure semantic vector retrieval.
   */
  async semanticSearch(query: string, options?: { topK?: number }): Promise<RetrievalFinding[]> {
    if (!this.index) return [];
    return this.index.searchSemantic(query, options?.topK || 5);
  }

  /**
   * Hybrid retrieval combining lexical, semantic, and structural signals.
   */
  async hybridSearch(query: string, options?: HybridSearchOptions): Promise<RetrievalFinding[]> {
    if (!this.index) return [];
    return this.index.search(query, options);
  }

  /**
   * Filters retrieval results by programming language.
   */
  async searchByLanguage(query: string, language: string, topK = 5): Promise<RetrievalFinding[]> {
    if (!this.index) return [];
    return this.index.searchByLanguage(query, language, topK);
  }

  /**
   * Filters retrieval results by file category ('source' | 'data' | 'documentation' | 'configuration').
   */
  async searchByFileType(query: string, fileType: FileCategory, topK = 5): Promise<RetrievalFinding[]> {
    if (!this.index) return [];
    const results = await this.index.search(query, { topK: topK * 2 });
    return results
      .filter(r => {
        const meta = this.index?.getFileMetadata(r.filePath);
        return meta && meta.fileType === fileType;
      })
      .slice(0, topK);
  }

  /**
   * Looks up code chunks by symbol name.
   */
  async searchBySymbol(symbolName: string, topK = 5): Promise<RetrievalFinding[]> {
    if (!this.index) return [];
    return this.index.searchBySymbol(symbolName, topK);
  }

  /**
   * Retrieves raw CodeChunks directly for LLM or agent context window.
   */
  async retrieveRelevantChunks(query: string, topK = 5): Promise<CodeChunk[]> {
    if (!this.index) return [];
    const findings = await this.index.search(query, { topK });
    const chunks: CodeChunk[] = [];
    for (const f of findings) {
      const chunk = this.index.chunks.find(c => c.filePath === f.filePath && c.startLine === f.startLine);
      if (chunk) {
        chunks.push(chunk);
      }
    }
    return chunks;
  }

  /**
   * Returns list of all detected languages in the repository.
   */
  getRepositoryLanguages(): string[] {
    if (!this.index) return [];
    return Object.keys(this.index.languageStats);
  }

  /**
   * Returns complete repository-wide line and category statistics.
   */
  getRepositoryLineStatistics(): RepositoryWideStats | null {
    if (!this.index) return null;
    return this.index.lineStats;
  }

  /**
   * Returns line and file statistics for a specific language.
   */
  getLanguageStatistics(language: string): LanguageStats | null {
    if (!this.index) return null;
    return this.index.languageStats[language] || null;
  }

  /**
   * Returns full classification metadata for a file path.
   */
  getFileMetadata(path: string): FileMetadata | null {
    if (!this.index) return null;
    return this.index.getFileMetadata(path);
  }

  /**
   * Formats a retrieval result into surrounding context for display or downstream reasoning.
   */
  getRelevantContext(result: RetrievalFinding): string {
    const lines = [
      `--- ${result.filePath} (Lines ${result.startLine}–${result.endLine}) ---`,
      `Language: ${result.language} | Reason: ${result.retrievalReason}`,
      result.symbolName ? `Symbol: ${result.symbolType || 'code'} ${result.symbolName}` : '',
      result.evidence.length > 0 ? `Evidence: ${result.evidence.join('; ')}` : '',
      'Source Code:',
      result.relevantSource
    ].filter(Boolean);

    return lines.join('\n');
  }
}

export const retrievalTools = new RetrievalTools();
