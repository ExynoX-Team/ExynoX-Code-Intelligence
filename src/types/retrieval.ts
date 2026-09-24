/**
 * Phase 3 Types: Repository-wide Statistics, Language Detection, Chunking, and Semantic/Hybrid Retrieval
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 */

import type { CodeLocation, CodeSnippet } from './index.js';

export type FileCategory = 'source' | 'data' | 'documentation' | 'configuration' | 'binary' | 'unknown';

export interface FileMetadata {
  path: string;
  detectedLanguage: string;
  fileType: FileCategory;
  lineCount: number;
  byteSize: number;
  isSourceCode: boolean;
  isData: boolean;
  isDocumentation: boolean;
  isConfiguration: boolean;
  isBinary: boolean;
  isIgnored: boolean;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  dataLines: number;
  configLines?: number;
  documentationLines?: number;
}

export interface CategoryLineCounts {
  sourceCode: number;
  data: number;
  documentation: number;
  configuration: number;
  blank: number;
}

export interface RepositoryWideStats {
  totalFiles: number;
  totalReadableFiles: number;
  totalPythonFiles: number;
  totalLines: number;
  totalCodeLines: number;
  totalCommentLines: number;
  totalBlankLines: number;
  totalBytes: number;
  totalDataLines: number;
  totalConfigLines?: number;
  totalDocumentationLines?: number;
  ignoredFiles: number;
  languageCounts: Record<string, number>;
  languageLineCounts: Record<string, number>;
  fileTypeCounts: Record<FileCategory, number>;
  categoryLineCounts: CategoryLineCounts;
  // Field aliases & convenience properties
  codeLines?: number;
  commentLines?: number;
  blankLines?: number;
  sourceFiles?: number;
  configFiles?: number;
  documentationFiles?: number;
  dataFiles?: number;
  binaryOrSkippedFiles?: number;
  byLanguage?: Record<string, LanguageStats>;
}

export interface LanguageStats {
  language: string;
  fileCount: number;
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  dataLines: number;
  configLines?: number;
  documentationLines?: number;
  byteSize: number;
  isSourceCode: boolean;
}

export type ChunkSymbolType = 
  | 'function' 
  | 'method' 
  | 'class' 
  | 'module' 
  | 'section' 
  | 'block' 
  | 'rule' 
  | 'data_sample' 
  | 'config_block';

export interface CodeChunk {
  id: string;
  filePath: string;
  language: string;
  symbolType: ChunkSymbolType;
  symbolName: string;
  startLine: number; // 1-based inclusive
  endLine: number;   // 1-based inclusive
  parentClass?: string;
  sourceText: string;
  surroundingContext?: string;
  relatedImports?: string[];
  docstring?: string;
  parameters?: string[];
}

export interface HybridScore {
  semanticScore: number;
  lexicalScore: number;
  structuralBoost: number;
  finalScore: number;
}

export interface WhyThisResult {
  primaryReason?: string;
  breakdown: string;
  signals: string[];
  semanticConfidence?: number;
  matchedKeywords?: string[];
  symbolContext?: string;
  astRelations?: string[];
  scoreBreakdown?: {
    semantic?: number;
    lexical?: number;
    structural?: number;
  };
}

export interface RetrievalFinding {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  symbolName?: string;
  symbolType?: string;
  relevantSource: string;
  retrievalReason: string;
  relevanceScore: number;
  confidenceScore: number;
  matchType: 'semantic' | 'lexical' | 'structural' | 'hybrid' | 'symbol';
  hybridScore?: HybridScore;
  evidence: string[];
  whyThisResult?: WhyThisResult;
  location: CodeLocation;
  codeSnippet: CodeSnippet;
}

export interface HybridSearchOptions {
  topK?: number;
  language?: string;
  fileType?: FileCategory;
  semanticWeight?: number;
  lexicalWeight?: number;
  structuralWeight?: number;
}

export interface EmbeddingProvider {
  readonly providerName: string;
  readonly dimension: number;
  embedText(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface EmbeddedChunk {
  chunk: CodeChunk;
  vector: number[];
}

export interface VectorSearchResult {
  chunk: CodeChunk;
  score: number; // 0 to 1 cosine similarity
}

export interface VectorStore {
  add(items: EmbeddedChunk[]): Promise<void>;
  search(queryVector: number[], topK?: number, filter?: (chunk: CodeChunk) => boolean): Promise<VectorSearchResult[]>;
  delete(ids: string[]): Promise<void>;
  clear(): Promise<void>;
  size(): number;
}
