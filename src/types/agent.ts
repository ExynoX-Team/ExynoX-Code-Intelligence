/**
 * Agentic Investigation & Reasoning Types
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 * Controlled multi-step loop: PLAN -> SEARCH -> INSPECT -> FOLLOW -> VERIFY -> REFINE -> ANSWER
 */

export interface InvestigationPlan {
  strategy: string;
  focusHypothesis: string;
  plannedSteps: string[];
}

export type ToolStatus = 'success' | 'empty' | 'error';

export interface ToolExecutionRecord {
  id: string;
  stepNumber: number;
  phase: 'PLAN' | 'SEARCH' | 'INSPECT' | 'FOLLOW' | 'VERIFY' | 'REFINE' | 'ANSWER';
  toolName: string;
  parameters: Record<string, unknown>;
  status: ToolStatus;
  summary: string;
  durationMs: number;
  evidenceProducedCount: number;
}

export interface SearchRecord {
  query: string;
  type: 'lexical' | 'semantic' | 'hybrid' | 'structural' | 'symbol';
  resultsCount: number;
}

export type CodeRole = 
  | 'prediction_usage'     // ACTUAL_PREDICTION_USAGE
  | 'model_definition'    // MODEL_DEFINITION
  | 'model_training'      // MODEL_TRAINING
  | 'caller'              // CALLER / ENTRY POINT
  | 'test'                // TEST
  | 'documentation'       // DOCUMENTATION
  | 'reference_only'      // REFERENCE_ONLY
  | 'unrelated';          // UNRELATED

export interface EvidenceItem {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
  content?: string; // alias for codeSnippet
  relevanceReason: string;
  relevance?: string; // alias for relevanceReason
  confidence: number;
  sourceTool: string;
  symbolName?: string;
  symbolType?: string;
  relationshipType?: 'definition' | 'caller' | 'callee' | 'reference' | 'lexical_match' | 'semantic_match' | 'usage';
  relatedToEvidenceId?: string;
  evidenceType?: CodeRole | string;
  verified?: boolean;
  classificationWhy?: string;
  roleExplanation?: string;
}

export interface EvidenceGraphNode {
  id: string;
  label: string;
  type: 'question' | 'function' | 'class' | 'caller' | 'callee' | 'model' | 'usage' | 'data' | 'file';
  filePath?: string;
  line?: number;
}

export interface EvidenceGraphEdge {
  from: string;
  to: string;
  relation: string;
}

export interface EvidenceGraph {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
}

export interface GroundedEvidenceReference {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
  relevance?: string;
}

export interface GroundedAnswer {
  answer: string;
  evidenceFiles: string[];
  evidenceLines: GroundedEvidenceReference[];
  investigationSummary: string[];
  confidence: number;
  unresolvedQuestions?: string[];
  isVerified: boolean;
  isFallbackDeterministic?: boolean;
  fallbackNotice?: string;
}

export type InvestigationEventType = 
  | 'UNDERSTANDING'
  | 'PLANNING'
  | 'SEARCHING'
  | 'INSPECTING'
  | 'FOLLOWING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'ERROR';

export type InvestigationEventStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface InvestigationEvent {
  id: string;
  type: InvestigationEventType;
  status: InvestigationEventStatus;
  label: string;
  detail?: string;
  timestamp: number;
}

export type InvestigationStatus = 
  | 'idle'
  | 'planning'
  | 'searching'
  | 'inspecting'
  | 'following_relationships'
  | 'verifying'
  | 'refining'
  | 'synthesizing'
  | 'completed'
  | 'recoverable_error'
  | 'failed'
  | 'cancelled';

export interface InvestigationState {
  investigationId?: string;
  question: string;
  plan: InvestigationPlan;
  iteration: number;
  maxIterations: number;
  toolCalls: ToolExecutionRecord[];
  searches: SearchRecord[];
  evidence: EvidenceItem[];
  evidenceGraph: EvidenceGraph;
  unresolvedQuestions: string[];
  confidence: number;
  status: InvestigationStatus;
  statusMessage: string;
  events?: InvestigationEvent[];
  finalAnswer?: GroundedAnswer;
  isVerified?: boolean;
  isFallbackDeterministic?: boolean;
  fallbackNotice?: string;
  error?: string;
  providerError?: import('./llm.js').LLMProviderErrorInfo;
}

export interface ConversationTurn {
  id: string;
  question: string;
  answer: string;
  evidence: EvidenceItem[];
  timestamp: number;
  investigationState?: InvestigationState;
}
