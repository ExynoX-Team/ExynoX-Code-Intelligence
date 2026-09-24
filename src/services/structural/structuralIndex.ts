import type { 
  SourceFileStructure, 
  PythonFileStructure,
  FunctionDefinition, 
  MethodDefinition, 
  ClassDefinition, 
  CallSite, 
  ImportReference, 
  ExportReference,
  SymbolReference, 
  AssignmentDefinition, 
  StructuralIndexStats, 
  ReferenceItem, 
  CallChainResult 
} from '../../types/structural.js';
import type { RepositoryFile } from '../../types/index.js';
import { parsePythonSource } from './astParser.js';
import { parseJavaScriptSource } from './jsAstParser.js';
import { RelationshipGraph } from './relationshipGraph.js';

export class StructuralIndex {
  private fileStructures: Map<string, SourceFileStructure> = new Map();
  private stats: StructuralIndexStats;
  private relationshipGraph: RelationshipGraph = new RelationshipGraph();

  // Lookup indexes for fast deterministic queries
  private functionsByName: Map<string, FunctionDefinition[]> = new Map();
  private classesByName: Map<string, ClassDefinition[]> = new Map();
  private methodsByName: Map<string, MethodDefinition[]> = new Map();
  private callsByCaller: Map<string, CallSite[]> = new Map();
  private callsByCallee: Map<string, CallSite[]> = new Map();
  private importsBySource: Map<string, ImportReference[]> = new Map();
  private importsBySymbol: Map<string, ImportReference[]> = new Map();
  private exportsBySymbol: Map<string, ExportReference[]> = new Map();
  private referencesBySymbol: Map<string, SymbolReference[]> = new Map();
  private assignmentsByVariable: Map<string, AssignmentDefinition[]> = new Map();
  private allAssignments: AssignmentDefinition[] = [];

  constructor() {
    this.stats = {
      analysisAvailable: false,
      analysisMessage: "No supported code files found for structural analysis.",
      primaryLanguage: 'unknown',
      pythonAnalysisAvailable: false,
      pythonAnalysisMessage: "No Python files found.",
      filesAnalyzed: 0,
      successfullyParsed: 0,
      parseFailures: 0,
      totalFunctions: 0,
      totalClasses: 0,
      totalMethods: 0,
      totalImports: 0,
      totalExports: 0,
      totalCalls: 0,
      totalAssignments: 0,
      indexingTimeMs: 0,
      failedFiles: []
    };
  }

  /**
   * Helper to check if a file is JavaScript / TypeScript
   */
  public static isJsLike(file: RepositoryFile | string): boolean {
    const p = typeof file === 'string' ? file.toLowerCase() : file.path.toLowerCase();
    return p.endsWith('.js') || p.endsWith('.jsx') || p.endsWith('.mjs') || p.endsWith('.cjs') ||
           p.endsWith('.ts') || p.endsWith('.tsx');
  }

  /**
   * Builds the complete structural index from repository files.
   * Priority: JavaScript / TypeScript first, then Python.
   */
  public buildIndex(files: RepositoryFile[]): void {
    const startTime = performance.now();
    this.clear();

    const jsFiles = files.filter(f => StructuralIndex.isJsLike(f));
    const pythonFiles = files.filter(f => f.isPython || f.path.endsWith('.py'));

    const targetFiles = [...jsFiles, ...pythonFiles];
    this.stats.filesAnalyzed = targetFiles.length;
    this.stats.totalFiles = targetFiles.length;

    const languageBreakdown: Record<string, number> = {
      javascript: jsFiles.length,
      python: pythonFiles.length
    };
    this.stats.languageBreakdown = languageBreakdown;

    if (jsFiles.length > 0) {
      this.stats.primaryLanguage = 'javascript';
    } else if (pythonFiles.length > 0) {
      this.stats.primaryLanguage = 'python';
    } else {
      this.stats.primaryLanguage = 'unknown';
    }

    if (targetFiles.length === 0) {
      this.stats.analysisAvailable = false;
      this.stats.analysisMessage = "No JavaScript, TypeScript, or Python files found. Structural analysis is unavailable.";
      this.stats.pythonAnalysisAvailable = false;
      this.stats.pythonAnalysisMessage = "No Python files found.";
      this.stats.indexingTimeMs = Math.round(performance.now() - startTime);
      return;
    }

    this.stats.analysisAvailable = true;
    this.stats.analysisMessage = undefined;
    this.stats.pythonAnalysisAvailable = pythonFiles.length > 0;
    this.stats.pythonAnalysisMessage = pythonFiles.length > 0 
      ? undefined 
      : "No Python files found in this repository.";

    // Parse JavaScript/TypeScript files (PRIMARY)
    for (const file of jsFiles) {
      try {
        const structure = parseJavaScriptSource(file.path, file.sourceText);
        this.fileStructures.set(file.path, structure);

        if (structure.parseStatus === 'error') {
          this.stats.parseFailures++;
          this.stats.failedFiles.push({
            filePath: file.path,
            error: structure.parseError || 'Unknown Babel parsing error'
          });
          continue;
        }

        this.stats.successfullyParsed++;
        this.indexFileStructure(structure);
      } catch (err: any) {
        this.stats.parseFailures++;
        this.stats.failedFiles.push({
          filePath: file.path,
          error: err?.message || 'Babel AST fatal error'
        });
      }
    }

    // Parse Python files (SECONDARY)
    for (const file of pythonFiles) {
      try {
        const structure = parsePythonSource(file.path, file.sourceText);
        this.fileStructures.set(file.path, structure);

        if (structure.parseStatus === 'error') {
          this.stats.parseFailures++;
          this.stats.failedFiles.push({
            filePath: file.path,
            error: structure.parseError || 'Unknown Python AST parsing error'
          });
          continue;
        }

        this.stats.successfullyParsed++;
        this.indexFileStructure(structure);
      } catch (err: any) {
        this.stats.parseFailures++;
        this.stats.failedFiles.push({
          filePath: file.path,
          error: err?.message || 'Python AST fatal error'
        });
      }
    }

    // Build unified relationship graph across all parsed structures
    this.relationshipGraph.buildGraph(Array.from(this.fileStructures.values()));

    this.stats.indexingTimeMs = Math.round(performance.now() - startTime);
  }

  private clear(): void {
    this.fileStructures.clear();
    this.relationshipGraph.clear();
    this.functionsByName.clear();
    this.classesByName.clear();
    this.methodsByName.clear();
    this.callsByCaller.clear();
    this.callsByCallee.clear();
    this.importsBySource.clear();
    this.importsBySymbol.clear();
    this.exportsBySymbol.clear();
    this.referencesBySymbol.clear();
    this.assignmentsByVariable.clear();
    this.allAssignments = [];
    this.stats = {
      analysisAvailable: false,
      filesAnalyzed: 0,
      successfullyParsed: 0,
      parseFailures: 0,
      totalFunctions: 0,
      totalClasses: 0,
      totalMethods: 0,
      totalImports: 0,
      totalExports: 0,
      totalCalls: 0,
      totalAssignments: 0,
      indexingTimeMs: 0,
      failedFiles: []
    };
  }

  private indexFileStructure(file: SourceFileStructure): void {
    // 1. Functions
    for (const fn of file.functions) {
      this.stats.totalFunctions++;
      const lower = fn.name.toLowerCase();
      if (!this.functionsByName.has(lower)) {
        this.functionsByName.set(lower, []);
      }
      this.functionsByName.get(lower)!.push(fn);
    }

    // 2. Classes
    for (const cls of file.classes) {
      this.stats.totalClasses++;
      const lower = cls.name.toLowerCase();
      if (!this.classesByName.has(lower)) {
        this.classesByName.set(lower, []);
      }
      this.classesByName.get(lower)!.push(cls);
    }

    // 3. Methods
    for (const method of file.methods) {
      this.stats.totalMethods++;
      const lower = method.name.toLowerCase();
      if (!this.methodsByName.has(lower)) {
        this.methodsByName.set(lower, []);
      }
      this.methodsByName.get(lower)!.push(method);
    }

    // 4. Calls
    for (const call of file.calls) {
      this.stats.totalCalls++;

      // Index by caller
      const callerKey = call.caller.toLowerCase();
      if (!this.callsByCaller.has(callerKey)) {
        this.callsByCaller.set(callerKey, []);
      }
      this.callsByCaller.get(callerKey)!.push(call);

      // Index by callee (e.g. 'validateToken' or 'router.handleIncomingDeeplink')
      const calleeSymbol = call.callee;
      const calleeParts = calleeSymbol.split('.');
      const terminalSymbol = calleeParts[calleeParts.length - 1].toLowerCase();
      const fullSymbol = calleeSymbol.toLowerCase();

      // Store both full callee and terminal symbol for fast lookup
      if (!this.callsByCallee.has(fullSymbol)) {
        this.callsByCallee.set(fullSymbol, []);
      }
      this.callsByCallee.get(fullSymbol)!.push(call);

      if (terminalSymbol !== fullSymbol) {
        if (!this.callsByCallee.has(terminalSymbol)) {
          this.callsByCallee.set(terminalSymbol, []);
        }
        this.callsByCallee.get(terminalSymbol)!.push(call);
      }
    }

    // 5. Imports
    for (const imp of file.imports) {
      this.stats.totalImports++;

      const srcKey = imp.sourceModule.toLowerCase();
      if (!this.importsBySource.has(srcKey)) {
        this.importsBySource.set(srcKey, []);
      }
      this.importsBySource.get(srcKey)!.push(imp);

      const symKey = imp.importedName.toLowerCase();
      if (!this.importsBySymbol.has(symKey)) {
        this.importsBySymbol.set(symKey, []);
      }
      this.importsBySymbol.get(symKey)!.push(imp);

      if (imp.alias) {
        const aliasKey = imp.alias.toLowerCase();
        if (!this.importsBySymbol.has(aliasKey)) {
          this.importsBySymbol.set(aliasKey, []);
        }
        this.importsBySymbol.get(aliasKey)!.push(imp);
      }
    }

    // 6. Exports
    for (const exp of file.exports || []) {
      if (this.stats.totalExports !== undefined) {
        this.stats.totalExports++;
      }
      const expKey = exp.exportedName.toLowerCase();
      if (!this.exportsBySymbol.has(expKey)) {
        this.exportsBySymbol.set(expKey, []);
      }
      this.exportsBySymbol.get(expKey)!.push(exp);
    }

    // 7. References
    for (const ref of file.references) {
      const symKey = ref.symbol.toLowerCase();
      if (!this.referencesBySymbol.has(symKey)) {
        this.referencesBySymbol.set(symKey, []);
      }
      this.referencesBySymbol.get(symKey)!.push(ref);
    }

    // 8. Assignments
    for (const assign of file.assignments) {
      this.stats.totalAssignments++;
      this.allAssignments.push(assign);
      const varKey = assign.variableName.toLowerCase();
      if (!this.assignmentsByVariable.has(varKey)) {
        this.assignmentsByVariable.set(varKey, []);
      }
      this.assignmentsByVariable.get(varKey)!.push(assign);
    }
  }

  // --------------------------------------------------------------------------
  // Deterministic Structural Query Tools
  // --------------------------------------------------------------------------

  /**
   * Returns structural AST details for a given file path.
   */
  public getFileStructure(path: string): SourceFileStructure | null {
    return this.fileStructures.get(path) || null;
  }

  /**
   * Finds all functions with the given name across the repository.
   */
  public findFunctions(name: string): FunctionDefinition[] {
    const key = name.trim().toLowerCase();
    return this.functionsByName.get(key) || [];
  }

  /**
   * Finds all classes with the given name across the repository.
   */
  public findClasses(name: string): ClassDefinition[] {
    const key = name.trim().toLowerCase();
    return this.classesByName.get(key) || [];
  }

  /**
   * Finds all class methods with the given name across the repository.
   */
  public findMethods(name: string): MethodDefinition[] {
    const key = name.trim().toLowerCase();
    return this.methodsByName.get(key) || [];
  }

  /**
   * Finds the primary function definition for a name.
   */
  public findFunctionDefinition(name: string): FunctionDefinition | null {
    const matches = this.findFunctions(name);
    if (matches.length > 0) return matches[0];
    const methodMatches = this.findMethods(name);
    return methodMatches.length > 0 ? methodMatches[0] : null;
  }

  /**
   * Finds the primary class definition for a name.
   */
  public findClassDefinition(name: string): ClassDefinition | null {
    const matches = this.findClasses(name);
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Finds all locations referencing a symbol (calls, imports, base classes, variables).
   */
  public findReferences(symbol: string): SymbolReference[] {
    const key = symbol.trim().toLowerCase();
    return this.referencesBySymbol.get(key) || [];
  }

  /**
   * Finds all call sites where `symbol` is called (i.e. who calls `symbol`).
   */
  public findCallers(symbol: string): CallSite[] {
    const key = symbol.trim().toLowerCase();
    const calls = this.callsByCallee.get(key) || [];

    // Deduplicate identical call sites
    const seen = new Set<string>();
    return calls.filter(c => {
      const sig = `${c.filePath}:${c.line}:${c.caller}->${c.callee}`;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
  }

  /**
   * Alias for findCallers - returns all call sites targeting `symbol`.
   */
  public findFunctionCalls(symbol: string): CallSite[] {
    return this.findCallers(symbol);
  }

  /**
   * Finds all calls made *from inside* a function or method.
   */
  public findCallees(callerName: string): CallSite[] {
    const key = callerName.trim().toLowerCase();
    const directMatches = this.callsByCaller.get(key) || [];
    if (directMatches.length > 0) return directMatches;

    // Search for callers ending in .callerName
    const results: CallSite[] = [];
    for (const [callerKey, calls] of this.callsByCaller.entries()) {
      if (callerKey === key || callerKey.endsWith(`.${key}`)) {
        results.push(...calls);
      }
    }
    return results;
  }

  /**
   * Finds all imports of a module or symbol name.
   */
  public findImports(moduleOrName: string): ImportReference[] {
    const key = moduleOrName.trim().toLowerCase();
    const bySource = this.importsBySource.get(key) || [];
    const bySymbol = this.importsBySymbol.get(key) || [];

    // Combine and deduplicate
    const combined = [...bySource, ...bySymbol];
    const seen = new Set<string>();
    return combined.filter(imp => {
      const sig = `${imp.filePath}:${imp.line}:${imp.sourceModule}:${imp.importedName}`;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
  }

  /**
   * Finds all exports matching a symbol name.
   */
  public findExports(symbolName: string): ExportReference[] {
    const key = symbolName.trim().toLowerCase();
    return this.exportsBySymbol.get(key) || [];
  }

  /**
   * Returns all functions defined in a specific file.
   */
  public getFunctionsInFile(path: string): FunctionDefinition[] {
    const structure = this.getFileStructure(path);
    return structure ? structure.functions : [];
  }

  /**
   * Returns all classes defined in a specific file.
   */
  public getClassesInFile(path: string): ClassDefinition[] {
    const structure = this.getFileStructure(path);
    return structure ? structure.classes : [];
  }

  /**
   * Returns all function calls originating inside a given function or method.
   */
  public getCallsInFunction(functionIdentifier: string): CallSite[] {
    return this.findCallees(functionIdentifier);
  }

  /**
   * Returns structural index statistics.
   */
  public getStats(): StructuralIndexStats {
    return { ...this.stats };
  }

  /**
   * Returns a summary list of all known function names in the repository.
   */
  public getAllFunctionNames(): string[] {
    return Array.from(this.functionsByName.keys());
  }

  /**
   * Returns a summary list of all known class names in the repository.
   */
  public getAllClassNames(): string[] {
    return Array.from(this.classesByName.keys());
  }

  /**
   * Finds all assignments matching a variable name.
   */
  public findAssignments(variableName: string): AssignmentDefinition[] {
    const key = variableName.trim().toLowerCase();
    return this.assignmentsByVariable.get(key) || [];
  }

  /**
   * Returns all indexed assignments across the repository.
   */
  public getAllAssignments(): AssignmentDefinition[] {
    return [...this.allAssignments];
  }

  /**
   * Finds collection variables (lists, dicts, arrays, sets) associated with an entity.
   */
  public findCollectionsForEntity(entityName: string): AssignmentDefinition[] {
    const raw = entityName.trim().toLowerCase();
    const singular = raw.endsWith('s') ? raw.slice(0, -1) : raw;

    return this.allAssignments.filter(a => {
      if (!a.valueType || !['list', 'dict', 'set', 'tuple', 'array', 'object'].includes(a.valueType)) return false;
      const lowerVar = a.variableName.toLowerCase();
      if (lowerVar.includes(singular) || lowerVar.includes(raw)) return true;
      if (a.typeAnnotation && a.typeAnnotation.toLowerCase().includes(singular)) return true;
      if (a.elements && a.elements.some(e => e.toLowerCase().includes(singular))) return true;
      return false;
    });
  }

  public getRelationshipGraph(): RelationshipGraph {
    return this.relationshipGraph;
  }

  public findCallChain(
    fromSymbol: string, 
    toSymbol: string, 
    snippetResolver?: (filePath: string, startLine: number, endLine: number) => string
  ): CallChainResult {
    return this.relationshipGraph.findCallChain(fromSymbol, toSymbol, snippetResolver);
  }

  public findImportedBy(moduleOrSymbol: string): ImportReference[] {
    const raw = moduleOrSymbol.trim().toLowerCase();
    const results: ImportReference[] = [];
    const seen = new Set<string>();

    for (const file of this.fileStructures.values()) {
      for (const imp of file.imports) {
        const matchesSource = imp.sourceModule.toLowerCase() === raw || imp.sourceModule.toLowerCase().endsWith(`/${raw}`) || imp.sourceModule.toLowerCase().endsWith(`.${raw}`);
        const matchesSymbol = imp.importedName.toLowerCase() === raw;
        const matchesAlias = imp.alias ? imp.alias.toLowerCase() === raw : false;

        if (matchesSource || matchesSymbol || matchesAlias) {
          const sig = `${imp.filePath}:${imp.line}:${imp.sourceModule}.${imp.importedName}`;
          if (!seen.has(sig)) {
            seen.add(sig);
            results.push(imp);
          }
        }
      }
    }
    return results;
  }

  public findImportsInFile(pathOrModule: string): ImportReference[] {
    const clean = pathOrModule.trim().toLowerCase();
    const exactFile = this.fileStructures.get(pathOrModule) || 
      Array.from(this.fileStructures.values()).find(f => 
        f.filePath.toLowerCase() === clean || 
        f.filePath.toLowerCase().endsWith(clean) ||
        f.filePath.toLowerCase().replace(/\.(js|jsx|ts|tsx|py)$/, '').endsWith(clean.replace(/\./g, '/'))
      );

    if (exactFile) {
      return exactFile.imports;
    }

    return this.findImports(clean);
  }

  /**
   * Finds all references to a symbol distinguishing:
   * - class_instantiation
   * - class_inheritance
   * - import
   * - export
   * - type_hint
   * - function_call
   * - variable_usage
   * - doc_mention
   */
  public findDetailedReferences(
    symbol: string, 
    snippetResolver?: (filePath: string, line: number) => string,
    docMentions?: { filePath: string; line: number; snippet: string }[]
  ): ReferenceItem[] {
    const cleanSym = symbol.trim();
    const symKey = cleanSym.toLowerCase();
    const isClass = this.findClassDefinition(cleanSym) !== null || /^[A-Z][a-zA-Z0-9_]*$/.test(cleanSym);
    const items: ReferenceItem[] = [];
    const seen = new Set<string>();

    const addRef = (item: ReferenceItem) => {
      const sig = `${item.filePath}:${item.line}:${item.referenceType}`;
      if (!seen.has(sig)) {
        seen.add(sig);
        items.push(item);
      }
    };

    // 1. Call sites (Class instantiation or function call)
    const calls = this.callsByCallee.get(symKey) || [];
    for (const call of calls) {
      const snippet = snippetResolver 
        ? snippetResolver(call.filePath, call.line) 
        : `${call.caller || 'module'} calls ${call.callee}()`;

      addRef({
        symbol: cleanSym,
        filePath: call.filePath,
        line: call.line,
        referenceType: (isClass || call.isConstructorCall) ? 'class_instantiation' : 'function_call',
        containingScope: call.caller,
        snippet,
        confidence: call.confidence === 'unknown' ? 'likely' : call.confidence
      });
    }

    // 2. Class inheritance
    for (const file of this.fileStructures.values()) {
      for (const cls of file.classes) {
        if (cls.baseClasses.some(b => b.toLowerCase() === symKey || b.toLowerCase().endsWith('.' + symKey))) {
          const snippet = snippetResolver 
            ? snippetResolver(cls.filePath, cls.startLine) 
            : `class ${cls.name} extends ${cls.baseClasses.join(', ')}`;

          addRef({
            symbol: cleanSym,
            filePath: cls.filePath,
            line: cls.startLine,
            referenceType: 'class_inheritance',
            containingScope: cls.name,
            snippet,
            confidence: 'confirmed'
          });
        }
      }
    }

    // 3. Imports
    const imports = this.findImportedBy(cleanSym);
    for (const imp of imports) {
      const snippet = snippetResolver 
        ? snippetResolver(imp.filePath, imp.line) 
        : (imp.isFromImport ? `import { ${imp.importedName} } from '${imp.sourceModule}'` : `import '${imp.sourceModule}'`);

      addRef({
        symbol: cleanSym,
        filePath: imp.filePath,
        line: imp.line,
        referenceType: 'import',
        snippet,
        confidence: 'confirmed'
      });
    }

    // 4. Exports
    const exports = this.findExports(cleanSym);
    for (const exp of exports) {
      const snippet = snippetResolver
        ? snippetResolver(exp.filePath, exp.line)
        : `export { ${exp.exportedName} }`;

      addRef({
        symbol: cleanSym,
        filePath: exp.filePath,
        line: exp.line,
        referenceType: 'export',
        snippet,
        confidence: 'confirmed'
      });
    }

    // 5. Type hints in parameters, returns, and variables
    for (const file of this.fileStructures.values()) {
      const allFns = [...file.functions, ...file.methods];
      for (const fn of allFns) {
        const paramMatches = fn.parameterDetails.filter(p => p.typeAnnotation && p.typeAnnotation.toLowerCase().includes(symKey));
        const returnMatches = fn.returnType && fn.returnType.toLowerCase().includes(symKey);

        if (paramMatches.length > 0 || returnMatches) {
          const snippet = snippetResolver 
            ? snippetResolver(file.filePath, fn.startLine) 
            : `function ${fn.name}(...)`;

          addRef({
            symbol: cleanSym,
            filePath: file.filePath,
            line: fn.startLine,
            referenceType: 'type_hint',
            containingScope: fn.name,
            snippet,
            confidence: 'confirmed'
          });
        }
      }

      for (const a of file.assignments) {
        if (a.typeAnnotation && a.typeAnnotation.toLowerCase().includes(symKey)) {
          const snippet = snippetResolver 
            ? snippetResolver(file.filePath, a.line) 
            : `${a.variableName}: ${a.typeAnnotation}`;

          addRef({
            symbol: cleanSym,
            filePath: file.filePath,
            line: a.line,
            referenceType: 'type_hint',
            snippet,
            confidence: 'confirmed'
          });
        }
      }
    }

    // 6. AST symbol references (variables, attributes)
    const astRefs = this.referencesBySymbol.get(symKey) || [];
    for (const ref of astRefs) {
      if (ref.contextKind === 'call' || ref.contextKind === 'import' || ref.contextKind === 'export' || ref.contextKind === 'base_class') {
        continue;
      }
      const snippet = snippetResolver 
        ? snippetResolver(ref.filePath, ref.line) 
        : `${ref.symbol} in ${ref.filePath}:${ref.line}`;

      addRef({
        symbol: cleanSym,
        filePath: ref.filePath,
        line: ref.line,
        referenceType: ref.contextKind === 'attribute_reference' ? 'attribute_reference' : 'variable_usage',
        snippet,
        confidence: (ref.confidence && ref.confidence !== 'unknown') ? ref.confidence : 'likely'
      });
    }

    // 7. Doc mentions (if provided)
    if (docMentions) {
      for (const doc of docMentions) {
        addRef({
          symbol: cleanSym,
          filePath: doc.filePath,
          line: doc.line,
          referenceType: 'doc_mention',
          snippet: doc.snippet,
          confidence: 'likely'
        });
      }
    }

    const typePriority: Record<string, number> = {
      class_instantiation: 1,
      class_inheritance: 2,
      function_call: 3,
      import: 4,
      export: 5,
      type_hint: 6,
      variable_usage: 7,
      attribute_reference: 8,
      doc_mention: 9
    };

    return items.sort((a, b) => {
      const pA = typePriority[a.referenceType] || 10;
      const pB = typePriority[b.referenceType] || 10;
      if (pA !== pB) return pA - pB;
      return a.filePath.localeCompare(b.filePath) || a.line - b.line;
    });
  }
}
