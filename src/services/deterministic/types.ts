/**
 * Deterministic Query Intelligence Types
 * Samsung PRISM Gen AI Hackathon (Theme 1: Agentic Code Intelligence)
 * Phase 6.5 — General Deterministic Query Intelligence Hardening
 */

import type { AgentFinding, StructuralQueryResult } from '../../types/index.js';

export type QueryIntentCategory =
  | 'file_path_location'        // A: Where is X? Path of X?
  | 'definition'                // B: Where is X defined? What is X?
  | 'usage_reference'           // C: Where is X used / referenced?
  | 'caller_callee'             // D: Who calls X? What does X call?
  | 'import_dependency'         // E: Where is X imported? What does module depend on?
  | 'count_quantity'            // F: How many classes/functions/files/items?
  | 'structural_architectural'  // G: What is in this file/module? Architecture of component?
  | 'behavior_workflow'         // H: How does authentication/prediction/X work?
  | 'relationship_data_flow'    // I: How does A connect to B? Call chain from A to B?
  | 'configuration'             // J: Where is database/port/API configured?
  | 'asset_resource'            // K: Where is the logo/favicon/static asset?
  | 'documentation'             // L: Setup instructions, README, how to install?
  | 'testing'                   // M: Where are tests for X? How is X tested?
  | 'error_handling'            // N: Where is this error handled/caught?
  | 'general_explanation';      // O: General query or exploration

export type CallerCalleeDirection = 'callers' | 'callees' | 'both' | 'unknown';
export type ImportDirection = 'importers' | 'imported' | 'dependencies';

export interface ParsedQueryIntent {
  primaryIntent: QueryIntentCategory;
  secondaryIntents: QueryIntentCategory[];
  confidence: number;
  callerCalleeDirection?: CallerCalleeDirection;
  importDirection?: ImportDirection;
  isCountQuery: boolean;
  countTarget?: string;
  isNegationQuery?: boolean;
}

export interface ExtractedQueryEntities {
  rawQuery: string;
  normalizedQuery: string;
  primaryEntity: string;
  secondaryEntities: string[];
  symbols: string[];
  fileTypeConstraints: string[];
  pathConstraints: string[];
  isNegation: boolean;
  sourceEntity?: string;
  targetEntity?: string;
}

export type DeterministicEvidenceType =
  | 'exact_path'
  | 'filename_match'
  | 'definition'
  | 'reference'
  | 'caller'
  | 'callee'
  | 'import'
  | 'dependency'
  | 'structural'
  | 'configuration'
  | 'documentation'
  | 'test'
  | 'asset'
  | 'data'
  | 'semantic'
  | 'lexical'
  | 'behavioral'
  | 'data_flow';

export interface VerifiedEvidenceItem {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  language: string;
  evidenceType: DeterministicEvidenceType;
  confidenceScore: number;
  primaryReason: string;
  evidenceSignals: string[];
  symbolName?: string;
  symbolType?: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'asset' | 'config' | 'test' | 'file';
  scoreBreakdown?: {
    lexical: number;
    semantic: number;
    structural: number;
  };
}

export interface DeterministicExecutionPlan {
  intent: QueryIntentCategory;
  primaryEntity: string;
  strategies: Array<
    | 'ast_definition'
    | 'ast_call_graph'
    | 'ast_references'
    | 'ast_count'
    | 'path_match'
    | 'asset_resolver'
    | 'config_detector'
    | 'doc_extractor'
    | 'test_locator'
    | 'behavior_tracer'
    | 'import_analyzer'
    | 'error_finder'
    | 'universal_definition'
    | 'hybrid_retriever'
    | 'negative_verifier'
  >;
  expandedKeywords: string[];
}

export interface DeterministicQueryResult {
  status: 'completed' | 'no_findings' | 'error';
  searchType: 'structural_ast' | 'lexical_exact' | 'hybrid_semantic' | 'no_matches';
  explanation: string;
  findings: AgentFinding[];
  structuralResult?: any;
  intent: QueryIntentCategory;
  isNegative: boolean;
  isAmbiguous?: boolean;
  plan?: any;
  evidence?: any[];
  executionTimeMs?: number;
}
