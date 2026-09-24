/**
 * Deterministic Query Intent Classifier
 * Categorizes natural language queries into 15 specific repository intelligence intents
 * Samsung PRISM Gen AI Hackathon (Theme 1: Agentic Code Intelligence)
 * Phase 6.5 — General Deterministic Query Intelligence Hardening
 */

import type { ParsedQueryIntent, QueryIntentCategory, CallerCalleeDirection, ImportDirection } from './types.js';

/**
 * Deterministically classifies a user question into one of 15 structured intent categories.
 * Completely deterministic — zero LLM calls.
 */
export function classifyQueryIntent(query: string): ParsedQueryIntent {
  const clean = query.trim().replace(/[?!.]+$/, '').trim();
  const lower = clean.toLowerCase();

  // -------------------------------------------------------------------------
  // 1. COUNT / QUANTITY (Category F)
  // "How many classes are there?", "How many Python files?", "Total number of functions"
  // -------------------------------------------------------------------------
  const countMatch = lower.match(/^(?:how\s+many|count\s+(?:of\s+)?|number\s+of\s+|total\s+(?:number\s+of\s+)?)(.+)/i);
  if (countMatch) {
    const rawTarget = countMatch[1].trim();
    return {
      primaryIntent: 'count_quantity',
      secondaryIntents: ['structural_architectural'],
      confidence: 0.95,
      isCountQuery: true,
      countTarget: rawTarget
    };
  }

  // -------------------------------------------------------------------------
  // 2. RELATIONSHIP / DATA FLOW (Category I)
  // "How does A reach B?", "Show call chain from X to Y", "How does A connect to B?"
  // -------------------------------------------------------------------------
  if (
    lower.match(/(?:call\s+chain|how\s+does\s+(.+?)\s+(?:reach|connect\s+to|call)\s+(.+)|trace\s+(?:calls?|chain)|flow\s+from\s+(.+?)\s+to\s+(.+))/i) ||
    lower.includes('call chain') ||
    lower.match(/from\s+([a-zA-Z0-9_]+)\s+to\s+([a-zA-Z0-9_]+)/i) && (lower.includes('reach') || lower.includes('chain') || lower.includes('trace'))
  ) {
    return {
      primaryIntent: 'relationship_data_flow',
      secondaryIntents: ['caller_callee', 'behavior_workflow'],
      confidence: 0.95,
      isCountQuery: false
    };
  }

  // -------------------------------------------------------------------------
  // 3. ASSET / RESOURCE (Category K)
  // "What is the path of the ExynoX logo?", "Where is the logo?", "Where is the favicon?", "Where are static assets?"
  // -------------------------------------------------------------------------
  const assetKeywords = ['logo', 'favicon', 'icon', 'banner', 'avatar', 'asset', 'image', 'picture', 'graphic', 'static file', 'badge'];
  const hasAssetWord = assetKeywords.some(w => lower.includes(w));
  if (hasAssetWord && (
    lower.includes('where') ||
    lower.includes('path') ||
    lower.includes('find') ||
    lower.includes('location') ||
    lower.includes('stored') ||
    lower.includes('located')
  )) {
    return {
      primaryIntent: 'asset_resource',
      secondaryIntents: ['file_path_location'],
      confidence: 0.95,
      isCountQuery: false
    };
  }

  // -------------------------------------------------------------------------
  // 4. TESTING (Category M)
  // "Where are the tests for this function?", "How is X tested?", "Which test covers X?"
  // -------------------------------------------------------------------------
  if (
    lower.match(/(?:where\s+are\s+(?:the\s+)?tests?|how\s+is\s+(.+?)\s+tested|which\s+test\s+(?:covers?|tests?)|unit\s+tests?\s+for|tests?\s+for\s+(.+))/i) ||
    (lower.includes('test') && (lower.includes('where') || lower.includes('how is') || lower.includes('find')))
  ) {
    return {
      primaryIntent: 'testing',
      secondaryIntents: ['file_path_location', 'definition'],
      confidence: 0.92,
      isCountQuery: false
    };
  }

  // -------------------------------------------------------------------------
  // 5. DOCUMENTATION / SETUP (Category L)
  // "What does the README say about setup?", "Where are the setup instructions?", "How to install?"
  // -------------------------------------------------------------------------
  if (
    lower.includes('readme') ||
    lower.match(/(?:setup\s+instructions?|installation\s+instructions?|how\s+to\s+install|how\s+to\s+setup|how\s+to\s+run|getting\s+started|quickstart)/i) ||
    ((lower.includes('setup') || lower.includes('installation') || lower.includes('install')) && (lower.includes('where') || lower.includes('how') || lower.includes('instructions')))
  ) {
    return {
      primaryIntent: 'documentation',
      secondaryIntents: ['file_path_location'],
      confidence: 0.94,
      isCountQuery: false
    };
  }

  // -------------------------------------------------------------------------
  // 6. CONFIGURATION (Category J)
  // "Where is the database configured?", "Where is Redis configured?", "What port does the server use?", "Where are environment variables?"
  // -------------------------------------------------------------------------
  if (
    lower.match(/(?:where\s+is\s+(?:the\s+)?(.+?)\s+configured|what\s+port\s+does|how\s+is\s+(.+?)\s+configured|configuration\s+for|settings\s+for|environment\s+variables?|config\s+file)/i) ||
    lower.includes('configured') ||
    (lower.includes('port') && lower.includes('server')) ||
    (lower.includes('database') && (lower.includes('where') || lower.includes('config'))) ||
    (lower.includes('redis') && (lower.includes('where') || lower.includes('config')))
  ) {
    return {
      primaryIntent: 'configuration',
      secondaryIntents: ['file_path_location', 'definition'],
      confidence: 0.93,
      isCountQuery: false
    };
  }

  // -------------------------------------------------------------------------
  // 7. CALLER / CALLEE (Category D)
  // "Who calls X?", "What does X call?", "Which functions call X?", "Callees of X"
  // -------------------------------------------------------------------------
  if (
    lower.match(/(?:who\s+calls|which\s+functions\s+call|functions\s+calling|callers\s+of|where\s+is\s+(.+?)\s+called)/i)
  ) {
    return {
      primaryIntent: 'caller_callee',
      secondaryIntents: ['usage_reference'],
      confidence: 0.95,
      callerCalleeDirection: 'callers',
      isCountQuery: false
    };
  }

  if (
    lower.match(/(?:what\s+does\s+(.+?)\s+call|which\s+functions\s+does\s+(.+?)\s+call|functions\s+called\s+by|callees\s+of|what\s+functions\s+are\s+called\s+by)/i)
  ) {
    return {
      primaryIntent: 'caller_callee',
      secondaryIntents: ['structural_architectural'],
      confidence: 0.95,
      callerCalleeDirection: 'callees',
      isCountQuery: false
    };
  }

  // -------------------------------------------------------------------------
  // 8. IMPORT / DEPENDENCY (Category E)
  // "Where is this module imported?", "What files depend on this module?", "What does X import?"
  // -------------------------------------------------------------------------
  if (
    lower.match(/(?:where\s+is\s+(.+?)\s+imported|what\s+imports\s+|which\s+files\s+import|who\s+imports)/i)
  ) {
    return {
      primaryIntent: 'import_dependency',
      secondaryIntents: ['usage_reference'],
      confidence: 0.94,
      importDirection: 'importers',
      isCountQuery: false
    };
  }

  if (
    lower.match(/(?:what\s+files\s+depend\s+on|dependencies\s+of|what\s+does\s+(.+?)\s+(?:import|depend\s+on)|which\s+modules\s+does)/i)
  ) {
    return {
      primaryIntent: 'import_dependency',
      secondaryIntents: ['structural_architectural'],
      confidence: 0.94,
      importDirection: 'dependencies',
      isCountQuery: false
    };
  }

  // -------------------------------------------------------------------------
  // 9. ERROR / EXCEPTION HANDLING (Category N)
  // "What happens when this error occurs?", "Where is this error handled?", "Which code catches this exception?"
  // -------------------------------------------------------------------------
  if (
    lower.match(/(?:where\s+is\s+(?:this\s+)?error\s+handled|what\s+happens\s+when\s+(?:an?\s+)?error|catches\s+this\s+exception|error\s+handling|exception\s+handled)/i) ||
    ((lower.includes('error') || lower.includes('exception') || lower.includes('fails')) && (lower.includes('what happens') || lower.includes('where is') || lower.includes('catch') || lower.includes('handle')))
  ) {
    return {
      primaryIntent: 'error_handling',
      secondaryIntents: ['behavior_workflow'],
      confidence: 0.92,
      isCountQuery: false
    };
  }

  // -------------------------------------------------------------------------
  // 10. BEHAVIOR / WORKFLOW (Category H)
  // "How does authentication work?", "How does prediction work?", "How does data flow through the system?"
  // -------------------------------------------------------------------------
  if (
    lower.match(/^(?:how\s+does\s+(.+?)\s+(?:work|function|operate|happen)|how\s+is\s+(.+?)\s+(?:calculated|processed|executed|handled)|what\s+is\s+the\s+(.+?)\s+(?:flow|pipeline|process))/i) ||
    lower.includes('how does authentication work') ||
    lower.includes('how does prediction work') ||
    lower.includes('how does the prediction pipeline work') ||
    lower.includes('data flow through the system')
  ) {
    return {
      primaryIntent: 'behavior_workflow',
      secondaryIntents: ['structural_architectural', 'relationship_data_flow'],
      confidence: 0.92,
      isCountQuery: false
    };
  }

  // -------------------------------------------------------------------------
  // 11. USAGE / REFERENCE (Category C)
  // "Where is this function used?", "Where is X used?", "Where is X referenced?", "Who uses X?"
  // -------------------------------------------------------------------------
  if (
    lower.match(/(?:where\s+is\s+(?:the\s+)?(.+?)\s+(?:used|referenced)|who\s+uses\s+|which\s+files\s+use\s+|references?\s+to\s+|usages?\s+of\s+)/i)
  ) {
    return {
      primaryIntent: 'usage_reference',
      secondaryIntents: ['caller_callee'],
      confidence: 0.93,
      isCountQuery: false
    };
  }

  // -------------------------------------------------------------------------
  // 12. DEFINITION (Category B)
  // "Where is this function defined?", "Where is X defined?", "What is X?", "Definition of X"
  // -------------------------------------------------------------------------
  if (
    lower.match(/(?:where\s+is\s+(?:the\s+)?(?:function\s+|class\s+|method\s+)?(.+?)\s+defined|find\s+definition\s+of|show\s+definition\s+of|definition\s+of\s+)/i) ||
    lower.startsWith('what is ') && !lower.includes('path') && !lower.includes('port')
  ) {
    return {
      primaryIntent: 'definition',
      secondaryIntents: ['file_path_location'],
      confidence: 0.94,
      isCountQuery: false
    };
  }

  // -------------------------------------------------------------------------
  // 13. STRUCTURAL / ARCHITECTURAL (Category G)
  // "Where is the server defined?", "Where is the application entry point?", "What classes are in this module?", "Architecture of X"
  // -------------------------------------------------------------------------
  if (
    lower.includes('server defined') ||
    lower.includes('application entry point') ||
    lower.includes('entry point') ||
    lower.includes('architecture') ||
    lower.match(/(?:what\s+(?:functions|classes|methods)\s+are\s+in|structure\s+of|how\s+is\s+(.+?)\s+structured)/i)
  ) {
    return {
      primaryIntent: 'structural_architectural',
      secondaryIntents: ['definition', 'file_path_location'],
      confidence: 0.93,
      isCountQuery: false
    };
  }

  // -------------------------------------------------------------------------
  // 14. FILE / PATH / LOCATION (Category A)
  // "Where is X?", "What is the path of X?", "Where can I find X?", "Which file contains X?"
  // -------------------------------------------------------------------------
  if (
    lower.match(/(?:what\s+is\s+the\s+path\s+of|path\s+to\s+|which\s+file\s+contains|where\s+can\s+i\s+find|where\s+is\s+|location\s+of\s+)/i)
  ) {
    return {
      primaryIntent: 'file_path_location',
      secondaryIntents: ['definition'],
      confidence: 0.90,
      isCountQuery: false
    };
  }

  // -------------------------------------------------------------------------
  // 15. GENERAL EXPLANATION / EXPLORATION (Category O)
  // Default fallback for exploratory queries
  // -------------------------------------------------------------------------
  return {
    primaryIntent: 'general_explanation',
    secondaryIntents: ['structural_architectural'],
    confidence: 0.80,
    isCountQuery: false
  };
}
