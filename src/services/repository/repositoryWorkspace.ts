import type { 
  RepositoryFile, 
  FileTreeNode, 
  RepositoryStats, 
  Repository, 
  RepositoryType,
  TextMatch,
  IndexingProgress
} from '../../types/index.js';
import type { RepositoryWideStats, LanguageStats, FileMetadata } from '../../types/retrieval.js';
import { 
  StructuralIndex,
  type SourceFileStructure,
  type PythonFileStructure,
  type FunctionDefinition,
  type MethodDefinition,
  type ClassDefinition,
  type CallSite,
  type ImportReference,
  type SymbolReference,
  type StructuralIndexStats
} from '../structural/index.js';
import { RepositoryIndex } from '../indexing/repositoryIndex.js';
import { retrievalTools } from '../retrieval/retrievalTools.js';
import { REPOSITORY_LIMITS } from './security.js';

export class RepositoryWorkspace {
  readonly repositoryName: string;
  readonly sourceType: RepositoryType;
  readonly sourceUrl?: string;
  readonly files: Map<string, RepositoryFile>;
  readonly jsFiles: RepositoryFile[];
  readonly pythonFiles: RepositoryFile[];
  readonly ignoredCount: number;
  readonly structuralIndex: StructuralIndex;
  readonly repositoryIndex: RepositoryIndex;
  readonly analysisAvailable: boolean;
  readonly analysisMessage: string;
  readonly pythonAnalysisAvailable: boolean;
  readonly pythonAnalysisMessage: string;
  readonly jsAnalysisAvailable: boolean;
  readonly jsAnalysisMessage: string;
  private _fileTree?: FileTreeNode;

  constructor(params: {
    repositoryName: string;
    sourceType: RepositoryType;
    sourceUrl?: string;
    files: Map<string, RepositoryFile>;
    ignoredCount: number;
  }) {
    this.repositoryName = params.repositoryName;
    this.sourceType = params.sourceType;
    this.sourceUrl = params.sourceUrl;
    this.files = params.files;
    this.ignoredCount = params.ignoredCount;

    const allFiles = Array.from(this.files.values());
    this.jsFiles = allFiles.filter(f => StructuralIndex.isJsLike(f));
    this.pythonFiles = allFiles.filter(f => f.isPython || f.path.endsWith('.py'));

    this.jsAnalysisAvailable = this.jsFiles.length > 0;
    this.jsAnalysisMessage = this.jsFiles.length > 0
      ? "JavaScript structural analysis completed."
      : "No JavaScript files found.";

    this.pythonAnalysisAvailable = this.pythonFiles.length > 0;
    this.pythonAnalysisMessage = this.pythonFiles.length > 0
      ? "Python structural analysis completed."
      : "No Python files found.";

    this.analysisAvailable = this.jsFiles.length > 0 || this.pythonFiles.length > 0;
    this.analysisMessage = this.analysisAvailable
      ? (this.jsFiles.length > 0 ? "JavaScript AST structural analysis ready." : "Python structural analysis ready.")
      : "Structural analysis unavailable (no JS or Python source files).";

    // Initialize and build structural index with priority to JS, followed by Python
    this.structuralIndex = new StructuralIndex();
    this.structuralIndex.buildIndex(allFiles);

    // Initialize Phase 3 RepositoryIndex
    this.repositoryIndex = new RepositoryIndex(this.repositoryName, this.structuralIndex);
    retrievalTools.setIndex(this.repositoryIndex);
  }

  get totalFiles(): number {
    return this.files.size;
  }

  get totalJsFiles(): number {
    return this.jsFiles.length;
  }

  get totalPythonFiles(): number {
    return this.pythonFiles.length;
  }

  get totalLines(): number {
    return this.repositoryIndex?.lineStats?.totalLines ?? this.getRepositoryStats().totalLines;
  }

  get totalCodeLines(): number {
    return this.repositoryIndex?.lineStats?.codeLines ?? 0;
  }

  get languageStatistics(): Record<string, LanguageStats> {
    return this.repositoryIndex?.languageStats ?? {};
  }

  get indexingStatus(): 'ready' | 'indexing' | 'unindexed' {
    return this.repositoryIndex?.isIndexed ? 'ready' : 'unindexed';
  }

  /**
   * Builds the complete repository-wide semantic, lexical, and line metrics index.
   */
  async buildIndex(onProgress?: (p: IndexingProgress) => void): Promise<void> {
    await this.repositoryIndex.buildIndex(this.files, this.ignoredCount, onProgress);
    retrievalTools.setIndex(this.repositoryIndex);
  }

  /**
   * Returns complete repository-wide line and categorization metrics (Phase 3).
   */
  getRepositoryWideStats(): RepositoryWideStats {
    return this.repositoryIndex.lineStats;
  }

  /**
   * Returns per-language breakdown statistics.
   */
  getLanguageStatistics(): Record<string, LanguageStats> {
    return this.repositoryIndex.languageStats;
  }

  /**
   * Returns metadata for all ingested files.
   */
  getFileMetadataList(): FileMetadata[] {
    return this.repositoryIndex.allFileMetadata;
  }

  /**
   * Fast BM25 keyword search across files.
   */
  searchKeywords(query: string, topK: number = 5) {
    return this.repositoryIndex.searchKeywords(query, topK);
  }

  /**
   * Builds the hierarchical file tree for repository browsing.
   */
  getFileTree(): FileTreeNode {
    if (this._fileTree) {
      return this._fileTree;
    }

    const root: FileTreeNode = {
      name: this.repositoryName,
      path: '',
      type: 'directory',
      children: []
    };

    for (const [filePath, file] of this.files.entries()) {
      const parts = filePath.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        if (isFile) {
          current.children = current.children || [];
          current.children.push({
            name: part,
            path: currentPath,
            type: 'file',
            size: file.size,
            isPython: file.isPython,
            lineCount: file.lineCount
          });
        } else {
          current.children = current.children || [];
          let dirNode = current.children.find(c => c.name === part && c.type === 'directory');
          if (!dirNode) {
            dirNode = {
              name: part,
              path: currentPath,
              type: 'directory',
              children: []
            };
            current.children.push(dirNode);
          }
          current = dirNode;
        }
      }
    }

    this.sortTree(root);
    this._fileTree = root;
    return root;
  }

  private sortTree(node: FileTreeNode): void {
    if (!node.children) return;
    node.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) {
      if (child.type === 'directory') {
        this.sortTree(child);
      }
    }
  }

  readFile(filePath: string): string | null {
    const file = this.files.get(filePath);
    return file ? file.sourceText : null;
  }

  getFile(filePath: string): RepositoryFile | null {
    return this.files.get(filePath) || null;
  }

  listFiles(pythonOnly = false): string[] {
    if (pythonOnly) {
      return this.pythonFiles.map(f => f.path);
    }
    return Array.from(this.files.keys());
  }

  getFileMetadata(path: string): FileMetadata | null {
    return this.repositoryIndex.getFileMetadata(path);
  }

  getFileStructure(path: string): SourceFileStructure | null {
    return this.structuralIndex.getFileStructure(path);
  }

  findFunctionDefinition(name: string): FunctionDefinition | null {
    return this.structuralIndex.findFunctionDefinition(name);
  }

  findClassDefinition(name: string): ClassDefinition | null {
    return this.structuralIndex.findClassDefinition(name);
  }

  findMethods(name: string): MethodDefinition[] {
    return this.structuralIndex.findMethods(name);
  }

  getFunctionsInFile(path: string): FunctionDefinition[] {
    return this.structuralIndex.getFunctionsInFile(path);
  }

  getClassesInFile(path: string): ClassDefinition[] {
    return this.structuralIndex.getClassesInFile(path);
  }

  getCallsInFunction(functionIdentifier: string): CallSite[] {
    return this.structuralIndex.getCallsInFunction(functionIdentifier);
  }

  getFileLines(filePath: string, startLine: number, endLine: number): string | null {
    const content = this.readFile(filePath);
    if (!content) return null;

    const lines = content.split('\n');
    const start = Math.max(1, startLine);
    const end = Math.min(lines.length, endLine);

    if (start > end || start > lines.length) return '';
    return lines.slice(start - 1, end).join('\n');
  }

  searchText(query: string, options: { maxResults?: number; caseSensitive?: boolean } = {}): TextMatch[] {
    const maxResults = options.maxResults ?? 20;
    const caseSensitive = options.caseSensitive ?? false;
    const matches: TextMatch[] = [];

    const searchQuery = caseSensitive ? query : query.toLowerCase();

    for (const [filePath, file] of this.files.entries()) {
      const lines = file.sourceText.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const searchLine = caseSensitive ? line : line.toLowerCase();
        const col = searchLine.indexOf(searchQuery);

        if (col !== -1) {
          matches.push({
  filePath,
  line: i + 1,
  lineText: line,
  startLine: i + 1,
  endLine: i + 1,
  contextLines: [],
  lineNumber: i + 1,
  columnNumber: col + 1
});

          if (matches.length >= maxResults) {
            return matches;
          }
        }
      }
    }

    return matches;
  }

  getRepositoryStats(): RepositoryStats {
    let totalLines = 0;
    let pythonLines = 0;
    let jsLines = 0;

    for (const file of this.files.values()) {
      totalLines += file.lineCount;
      if (file.isPython) {
        pythonLines += file.lineCount;
      }
      if (StructuralIndex.isJsLike(file)) {
        jsLines += file.lineCount;
      }
    }

    return {
      totalFiles: this.files.size,
      totalPythonFiles: this.pythonFiles.length,
      totalJsFiles: this.jsFiles.length,
      totalLines,
      totalPythonLines: pythonLines,
      totalJsLines: jsLines,
      ignoredFiles: this.ignoredCount,
      fileCount: this.files.size,
      pythonFileCount: this.pythonFiles.length,
      pythonLines,
      jsFileCount: this.jsFiles.length,
      jsLines,
      ignoredCount: this.ignoredCount
    };
  }

  toRepositoryRecord(): Repository {
    const stats = this.getRepositoryStats();
    const hasJavaScript = this.jsFiles.some(f =>
  /\.(js|jsx|mjs|cjs)$/i.test(f.path)
);

const hasTypeScript = this.jsFiles.some(f =>
  /\.(ts|tsx)$/i.test(f.path)
);

const hasPython = (stats.pythonFileCount ?? 0) > 0;

const primaryLang =
  hasPython && (hasJavaScript || hasTypeScript)
    ? 'Multi-language'
    : hasPython
      ? 'Python'
      : hasTypeScript && !hasJavaScript
        ? 'TypeScript'
        : hasJavaScript
          ? 'JavaScript'
          : 'Multi-language';
    return {
      id: `repo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: this.repositoryName,
      type: this.sourceType,
      language: primaryLang,
      primaryLanguage: primaryLang,
      sourceUrl: this.sourceUrl,
      fileCount: stats.fileCount ?? stats.totalFiles,
      pythonFileCount: stats.pythonFileCount ?? stats.totalPythonFiles,
      jsFileCount: stats.jsFileCount ?? stats.totalJsFiles ?? 0,
      totalLines: stats.totalLines,
      pythonLines: stats.pythonLines ?? stats.totalPythonLines,
      jsLines: stats.jsLines ?? stats.totalJsLines ?? 0,
      analysisAvailable: this.analysisAvailable,
      analysisMessage: this.analysisMessage,
      pythonAnalysisAvailable: this.pythonAnalysisAvailable,
      pythonAnalysisMessage: this.pythonAnalysisMessage,
      jsAnalysisAvailable: this.jsAnalysisAvailable,
      jsAnalysisMessage: this.jsAnalysisMessage,
      structuralStats: this.getStructuralStats(),
      repositoryWideStats: this.getRepositoryWideStats(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  toRepositorySummary(): Repository {
  const record = this.toRepositoryRecord();

  const normalizedPrimaryLanguage =
  record.primaryLanguage === 'JavaScript'
    ? 'javascript'
    : record.primaryLanguage === 'TypeScript'
      ? 'typescript'
      : record.primaryLanguage === 'Python'
        ? 'python'
        : record.primaryLanguage === 'Multi-language'
          ? 'multi'
          : record.primaryLanguage;
  return {
    ...record,
    primaryLanguage: normalizedPrimaryLanguage,
  };
}

  // Structural Inspection Convenience API
  findFunctions(name: string): FunctionDefinition[] {
    return this.structuralIndex.findFunctions(name);
  }

  findClasses(name: string): ClassDefinition[] {
    return this.structuralIndex.findClasses(name);
  }

  findCallers(symbol: string): CallSite[] {
    return this.structuralIndex.findCallers(symbol);
  }

  findCallees(callerName: string): CallSite[] {
    return this.structuralIndex.findCallees(callerName);
  }

  findImports(moduleOrName: string): ImportReference[] {
    return this.structuralIndex.findImports(moduleOrName);
  }

  findReferences(symbol: string): SymbolReference[] {
    return this.structuralIndex.findReferences(symbol);
  }

  findCallChain(fromSymbol: string, toSymbol: string) {
    return this.structuralIndex.findCallChain(
      fromSymbol, 
      toSymbol, 
      (file, start, end) => this.getFileLines(file, start, end) || ''
    );
  }

  getStructuralStats(): StructuralIndexStats {
    return this.structuralIndex.getStats();
  }
}
