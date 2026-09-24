/**
 * Unified Repository Knowledge Model Types
 * Samsung PRISM Gen AI Hackathon (Theme 1: Agentic Code Intelligence)
 * Phase 6.6 — General-Purpose Deterministic Repository Intelligence Engine
 */

export type RepositoryFileType =
  | 'source'
  | 'test'
  | 'config'
  | 'documentation'
  | 'asset'
  | 'data'
  | 'entry_point'
  | 'build';

export type SymbolKind =
  | 'function'
  | 'method'
  | 'class'
  | 'interface'
  | 'type'
  | 'variable'
  | 'constant'
  | 'collection'
  | 'route'
  | 'component'
  | 'test';

export interface FileKnowledgeNode {
  id: string;
  path: string;
  filename: string;
  basename: string;
  extension: string;
  directory: string;
  dirSegments: string[];
  language: string;
  fileType: RepositoryFileType;
  lineCount: number;
  lines: string[];
  size: number;
}

export interface SymbolKnowledgeNode {
  id: string;
  name: string;
  normalizedName: string;
  tokens: string[];
  kind: SymbolKind;
  filePath: string;
  startLine: number;
  endLine: number;
  parameters?: string[];
  docstring?: string;
  isExported: boolean;
  itemCount?: number; // for collections, lists, arrays
  snippet: string;
}

export interface RelationshipEdge {
  sourceId: string;
  targetId: string;
  type:
    | 'defines'
    | 'calls'
    | 'called_by'
    | 'imports'
    | 'imported_by'
    | 'references'
    | 'contains'
    | 'depends_on'
    | 'configured_by'
    | 'tested_by'
    | 'documents'
    | 'located_in'
    | 'data_flow_to';
  filePath: string;
  line: number;
  snippet?: string;
  weight: number;
}

export interface ConfigEntryNode {
  id: string;
  key: string;
  value: any;
  filePath: string;
  line: number;
  snippet?: string;
  isEnvVar: boolean;
}

export interface DocSectionNode {
  id: string;
  title: string;
  level: number;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  headings: string[];
}

export interface AssetKnowledgeNode {
  id: string;
  path: string;
  filename: string;
  extension: string;
  category: 'image' | 'icon' | 'font' | 'media' | 'template' | 'other';
  size?: number;
  referencedBy: Array<{ filePath: string; line: number; snippet: string }>;
}

export interface TestKnowledgeNode {
  id: string;
  filePath: string;
  testName: string;
  startLine: number;
  endLine: number;
  testedSymbols: string[];
}

export interface VocabularyTokenMatch {
  entityId: string;
  entityType: 'symbol' | 'file' | 'config' | 'doc' | 'asset' | 'test';
  weight: number;
  name: string;
  filePath: string;
  startLine?: number;
  endLine?: number;
}
