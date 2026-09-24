/**
 * Language-Neutral Structural Data Models
 * Supports JavaScript (primary), TypeScript, and Python (secondary).
 * Samsung PRISM GenAI Hackathon (Theme 1: Agentic Code Intelligence)
 */

export type SourceLanguage = 'javascript' | 'typescript' | 'python' | 'unknown';

export type CallConfidence = 'confirmed' | 'likely' | 'unknown';

export interface SourceLocation {
  filePath: string;
  startLine: number; // 1-based
  endLine: number;   // 1-based
  startColumn?: number; // 0-based or 1-based
  endColumn?: number;
}

export interface ParameterInfo {
  name: string;
  typeAnnotation?: string;
  hasDefault: boolean;
}

export interface FunctionDefinition extends SourceLocation {
  name: string;
  parameters: string[];
  parameterDetails: ParameterInfo[];
  decorators: string[];
  isAsync: boolean;
  isArrow?: boolean;
  isExported?: boolean;
  isDefaultExport?: boolean;
  className?: string;
  docstring?: string;
  returnType?: string;
}

export interface MethodDefinition extends FunctionDefinition {
  className: string;
  isStatic?: boolean;
  isClassMethod?: boolean;
  isConstructor?: boolean;
  kind?: 'method' | 'constructor' | 'get' | 'set';
}

export interface ClassDefinition extends SourceLocation {
  name: string;
  baseClasses: string[];
  methods: string[]; // method names
  docstring?: string;
  isExported?: boolean;
  isDefaultExport?: boolean;
}

export interface CallSite extends SourceLocation {
  caller: string;         // Name of containing function/method or '<module>' or '<top-level>'
  callee: string;         // Called symbol or expression (e.g. 'validateToken' or 'router.handleIncomingDeeplink')
  line: number;           // 1-based line of call
  confidence: CallConfidence;
  containingClass?: string;
  isConstructorCall?: boolean;
  argumentsCount?: number;
}

export interface ImportReference extends SourceLocation {
  sourceModule: string;   // e.g. './login.js' or 'auth/login' or 'express'
  importedName: string;   // e.g. 'validateToken' or '*' or 'default' or module name
  alias?: string;         // e.g. 'asName'
  line: number;           // 1-based line of import
  isFromImport: boolean;  // true if named/ES import, false if bare require or side-effect import
  importType?: 'es_named' | 'es_default' | 'es_namespace' | 'commonjs_require' | 'python_import' | 'python_from';
}

export interface ExportReference extends SourceLocation {
  exportedName: string;   // e.g. 'handleIncomingDeeplink' or 'default'
  localName?: string;     // e.g. 'handleDeeplink'
  line: number;           // 1-based line
  exportType: 'named' | 'default' | 'commonjs_exports' | 'commonjs_module_exports';
}

export interface SymbolReference extends SourceLocation {
  symbol: string;
  line: number;           // 1-based line
  containingScope?: string;
  contextKind: 'call' | 'import' | 'export' | 'base_class' | 'type_hint' | 'variable_usage' | 'attribute_reference';
  confidence?: CallConfidence;
}

export interface AssignmentDefinition extends SourceLocation {
  variableName: string;
  line: number;           // 1-based start line
  valueSummary?: string;
  isModuleLevel: boolean;
  valueType?: 'list' | 'dict' | 'set' | 'tuple' | 'call' | 'primitive' | 'object' | 'array' | 'function' | 'other';
  elementCount?: number;
  elements?: string[];
  typeAnnotation?: string;
}

/**
 * Unified language-neutral file structure representation
 */
export interface SourceFileStructure {
  filePath: string;
  moduleName: string;
  language: SourceLanguage;
  lineCount: number;
  imports: ImportReference[];
  exports: ExportReference[];
  classes: ClassDefinition[];
  functions: FunctionDefinition[];
  methods: MethodDefinition[];
  calls: CallSite[];
  references: SymbolReference[];
  assignments: AssignmentDefinition[];
  parseStatus: 'success' | 'warning' | 'error';
  parseError?: string;
}

// Backward-compatible alias for Python-specific typing
export type PythonFileStructure = SourceFileStructure;

export interface StructuralIndexStats {
  analysisAvailable?: boolean;
  analysisMessage?: string;
  primaryLanguage?: string;
  languageBreakdown?: Record<string, number>;
  // Backward compatibility fields
  pythonAnalysisAvailable?: boolean;
  pythonAnalysisMessage?: string;
  filesAnalyzed: number;
  totalFiles?: number;
  successfullyParsed: number;
  parseFailures: number;
  totalFunctions: number;
  totalClasses: number;
  totalMethods: number;
  totalImports: number;
  totalExports?: number;
  totalCalls: number;
  totalAssignments: number;
  indexingTimeMs: number;
  failedFiles: { filePath: string; error: string }[];
}

export type StructuralQueryType =
  | 'find_function_def'
  | 'find_class_def'
  | 'find_callers'
  | 'find_callees'
  | 'find_imports'
  | 'find_exports'
  | 'find_imported_by'
  | 'find_call_chain'
  | 'list_file_functions'
  | 'list_file_classes'
  | 'find_references'
  | 'structural_counts'
  | 'general_structural';

export interface ReferenceItem {
  symbol: string;
  filePath: string;
  line: number;
  endLine?: number;
  referenceType: 'function_call' | 'class_instantiation' | 'class_inheritance' | 'import' | 'export' | 'type_hint' | 'variable_usage' | 'attribute_reference' | 'doc_mention';
  containingScope?: string;
  snippet: string;
  confidence: 'confirmed' | 'likely' | 'uncertain';
}

export interface CallChainStep {
  stepIndex: number;
  fromSymbol: string;
  toSymbol: string;
  filePath: string;
  line: number;
  snippet?: string;
  confidence: 'confirmed' | 'likely';
}

export interface CallChainResult {
  fromSymbol: string;
  toSymbol: string;
  steps: CallChainStep[];
  pathFound: boolean;
  explanation: string;
}

export interface RelationshipNode {
  id: string;
  kind: 'file' | 'module' | 'class' | 'function' | 'method' | 'variable';
  name: string;
  filePath: string;
  language?: SourceLanguage;
  line?: number;
  endLine?: number;
}

export interface RelationshipEdge {
  id: string;
  sourceId: string;
  targetId: string;
  kind: 'CALLS' | 'IMPORTS' | 'EXPORTS' | 'REFERENCES' | 'INHERITS' | 'DEFINES' | 'CONTAINS';
  filePath: string;
  line: number;
  confidence: 'confirmed' | 'likely' | 'unknown';
  details?: string;
}

export interface EntityCountInfo {
  entityName: string;
  countType: 'class_count' | 'entity_roster' | 'collection' | 'function_count' | 'method_count' | 'unconfirmed';
  className?: string;
  collectionVariable?: string;
  elementCount?: number;
  evidenceFile?: string;
  startLine?: number;
  endLine?: number;
  reliable: boolean;
}

export interface StructuralQueryResult {
  queryType: StructuralQueryType;
  targetSymbol: string;
  matchedItemsCount: number;
  explanation: string;
  functionDefs?: FunctionDefinition[];
  classDefs?: ClassDefinition[];
  callSites?: CallSite[];
  imports?: ImportReference[];
  exports?: ExportReference[];
  references?: SymbolReference[];
  referenceItems?: ReferenceItem[];
  assignments?: AssignmentDefinition[];
  entityInfo?: EntityCountInfo;
  callChain?: CallChainResult;
}
