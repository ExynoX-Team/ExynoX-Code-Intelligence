/**
 * Unified Repository Index
 * Integrates metadata, line statistics, language breakdown, code chunks,
 * lexical index, vector store, and Python AST structural index.
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 */

import type { RepositoryFile, IndexingProgress } from '../../types/index.js';
import type { 
  FileMetadata, 
  RepositoryWideStats, 
  LanguageStats, 
  CodeChunk, 
  RetrievalFinding,
  HybridSearchOptions 
} from '../../types/retrieval.js';
import { createFileMetadata } from './languageDetector.js';
import { calculateRepositoryWideStats, calculateLanguageStatistics } from './lineCounter.js';
import { buildRepositoryChunks } from './chunker.js';
import { InvertedLexicalIndex } from '../retrieval/lexicalIndex.js';
import { LocalEmbeddingProvider } from '../retrieval/embeddings/localEmbeddingProvider.js';
import { InMemoryVectorStore } from '../retrieval/embeddings/vectorStore.js';
import { HybridRetriever } from '../retrieval/hybridRetriever.js';
import { StructuralIndex } from '../structural/structuralIndex.js';

export type IndexProgressCallback = (progress: IndexingProgress) => void;

export class RepositoryIndex {
  readonly repositoryName: string;
  readonly files = new Map<string, FileMetadata>();
  private sourceFiles = new Map<string, RepositoryFile>();
  
  lineStats: RepositoryWideStats;
  languageStats: Record<string, LanguageStats> = {};
  chunks: CodeChunk[] = [];
  
  readonly lexicalIndex = new InvertedLexicalIndex();
  readonly vectorStore = new InMemoryVectorStore();
  readonly embeddingProvider = new LocalEmbeddingProvider();
  readonly structuralIndex: StructuralIndex;
  
  private hybridRetriever!: HybridRetriever;
  public isIndexed = false;

  constructor(repositoryName: string, structuralIndex?: StructuralIndex) {
    this.repositoryName = repositoryName;
    this.structuralIndex = structuralIndex || new StructuralIndex();
    this.lineStats = {
      totalFiles: 0,
      totalReadableFiles: 0,
      totalPythonFiles: 0,
      totalLines: 0,
      totalCodeLines: 0,
      totalCommentLines: 0,
      totalBlankLines: 0,
      totalBytes: 0,
      totalDataLines: 0,
      ignoredFiles: 0,
      languageCounts: {},
      languageLineCounts: {},
      fileTypeCounts: {
        source: 0,
        data: 0,
        documentation: 0,
        configuration: 0,
        binary: 0,
        unknown: 0
      },
      categoryLineCounts: {
        sourceCode: 0,
        data: 0,
        documentation: 0,
        configuration: 0,
        blank: 0
      }
    };
  }

  /**
   * Builds the complete repository index with true step-by-step progress notifications.
   */
  async buildIndex(
    files: Map<string, RepositoryFile>,
    ignoredCount = 0,
    onProgress?: IndexProgressCallback
  ): Promise<void> {
    const steps = [
      { id: 'scan', label: 'Scanning repository files', status: 'pending' as const },
      { id: 'lang', label: 'Detecting languages & file categories', status: 'pending' as const },
      { id: 'lines', label: 'Computing line & category metrics', status: 'pending' as const },
      { id: 'chunks', label: 'Building code-aware chunks', status: 'pending' as const },
      { id: 'lex', label: 'Constructing lexical inverted index', status: 'pending' as const },
      { id: 'sem', label: 'Generating semantic vector embeddings', status: 'pending' as const },
      { id: 'ast', label: 'Analyzing JavaScript and Python ASTs', status: 'pending' as const },
      { id: 'final', label: 'Finalizing repository index', status: 'pending' as const }
    ];

    const reportProgress = (stage: IndexingProgress['stage'], stepIdx: number, message: string) => {
      if (!onProgress) return;
      const updated = steps.map((s, idx) => ({
        ...s,
        status: idx < stepIdx ? 'completed' as const : (idx === stepIdx ? 'in_progress' as const : 'pending' as const)
      }));
      onProgress({
        stage,
        message,
        currentStepIndex: stepIdx,
        steps: updated
      });
    };

    this.sourceFiles = new Map(files);

    // Step 1: Scanning repository
    reportProgress('received', 0, `Scanning ${files.size} files in repository...`);
    await this.yieldControl();

    // Step 2: Detecting languages
    reportProgress('discovered', 1, 'Detecting file types, languages, and comments...');
    const metadataList: FileMetadata[] = [];
    this.files.clear();

    for (const [path, file] of files.entries()) {
      const meta = createFileMetadata({
        path,
        size: file.size,
        lines: file.lines
      });
      this.files.set(path, meta);
      metadataList.push(meta);
    }
    await this.yieldControl();

    // Step 3: Computing line metrics
    reportProgress('reading_python', 2, 'Calculating code, data, documentation, and blank line statistics...');
    this.lineStats = calculateRepositoryWideStats(metadataList, ignoredCount);
    this.languageStats = calculateLanguageStatistics(metadataList);
    await this.yieldControl();

    // Step 4: Structural AST Indexing (JavaScript & Python)
    reportProgress('building_workspace', 3, 'Parsing AST for classes, functions, and cross-file call hierarchies...');
    this.structuralIndex.buildIndex(Array.from(files.values()));
    await this.yieldControl();

    // Step 5: Building code chunks
    reportProgress('building_workspace', 4, 'Building code-aware semantic chunks...');
    const fileList = Array.from(files.values());
    this.chunks = buildRepositoryChunks(fileList, this.structuralIndex);
    await this.yieldControl();

    // Step 6: Constructing lexical index
    reportProgress('building_workspace', 5, 'Constructing BM25 inverted lexical index...');
    this.lexicalIndex.indexChunks(this.chunks);
    await this.yieldControl();

    // Step 7: Generating semantic vector embeddings
    reportProgress('building_workspace', 6, `Embedding ${this.chunks.length} code chunks with semantic vectors...`);
    await this.vectorStore.clear();
    
    // Batch embed chunks in chunks of 50 to maintain responsiveness
    const batchSize = 50;
    for (let i = 0; i < this.chunks.length; i += batchSize) {
      const slice = this.chunks.slice(i, i + batchSize);
      const texts = slice.map(c => `${c.symbolName} ${c.docstring || ''} ${c.surroundingContext || ''} ${c.sourceText.slice(0, 300)}`);
      const vectors = await this.embeddingProvider.embedBatch(texts);
      
      const embedded = slice.map((chunk, idx) => ({
        chunk,
        vector: vectors[idx]
      }));
      await this.vectorStore.add(embedded);
      await this.yieldControl();
    }

    // Step 8: Finalizing repository index
    reportProgress('building_workspace', 7, 'Finalizing hybrid retrieval engine...');
    this.hybridRetriever = new HybridRetriever({
      vectorStore: this.vectorStore,
      embeddingProvider: this.embeddingProvider,
      lexicalIndex: this.lexicalIndex,
      structuralIndex: this.structuralIndex,
      allChunks: this.chunks
    });

    this.isIndexed = true;

    if (onProgress) {
      onProgress({
        stage: 'ready',
        message: 'Repository index ready for semantic and structural queries',
        currentStepIndex: 8,
        steps: steps.map(s => ({ ...s, status: 'completed' as const }))
      });
    }
  }

  /**
   * Executes hybrid search over the repository.
   */
  async search(query: string, options?: HybridSearchOptions): Promise<RetrievalFinding[]> {
    if (!this.isIndexed || !this.hybridRetriever) {
      return [];
    }
    return this.hybridRetriever.retrieve(query, options);
  }

  /**
   * Executes semantic-only search.
   */
  async searchSemantic(query: string, topK = 5): Promise<RetrievalFinding[]> {
    return this.search(query, {
      topK,
      semanticWeight: 0.85,
      lexicalWeight: 0.10,
      structuralWeight: 0.05
    });
  }

  /**
   * Searches specifically by language.
   */
  async searchByLanguage(query: string, language: string, topK = 5): Promise<RetrievalFinding[]> {
    return this.search(query, { topK, language });
  }

  /**
   * Searches specifically by symbol name.
   */
  async searchBySymbol(symbolName: string, topK = 5): Promise<RetrievalFinding[]> {
    return this.search(symbolName, {
      topK,
      lexicalWeight: 0.60,
      structuralWeight: 0.30,
      semanticWeight: 0.10
    });
  }

  /**
   * Invalidate or update a single file without rebuilding the entire index.
   */
  updateFile(file: RepositoryFile): void {
    this.sourceFiles.set(file.path, file);
    const meta = createFileMetadata({
      path: file.path,
      size: file.size,
      lines: file.lines
    });
    this.files.set(file.path, meta);
    // Recalculate line statistics
    this.lineStats = calculateRepositoryWideStats(Array.from(this.files.values()), this.lineStats.ignoredFiles);
    this.languageStats = calculateLanguageStatistics(Array.from(this.files.values()));
  }

  getFileMetadata(path: string): FileMetadata | null {
    return this.files.get(path) || null;
  }

  get allFileMetadata(): FileMetadata[] {
    return Array.from(this.files.values());
  }

  searchKeywords(query: string, topK: number = 5) {
    return this.lexicalIndex.search(query, topK);
  }

  getSourceFile(path: string): RepositoryFile | null {
    return this.sourceFiles.get(path) || null;
  }

  getAllChunks(): CodeChunk[] {
    return this.chunks;
  }

  private yieldControl(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 10));
  }
}
