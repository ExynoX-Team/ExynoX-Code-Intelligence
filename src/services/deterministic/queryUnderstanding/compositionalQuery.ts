/**
 * Compositional Query Understanding Layer
 * Samsung PRISM Gen AI Hackathon (Theme 1: Agentic Code Intelligence)
 * Phase 6.6 — General-Purpose Deterministic Repository Intelligence Engine
 *
 * Decomposes natural language queries into compositional structured intents, targets,
 * requested output types, constraints, and relationships. Zero hardcoding. Zero LLM.
 */

import type { QueryIntentCategory } from '../types.js';

export type RequestedOutput =
  | 'definition'
  | 'usage'
  | 'callers'
  | 'callees'
  | 'count'
  | 'path'
  | 'workflow'
  | 'config'
  | 'asset'
  | 'doc'
  | 'test'
  | 'error'
  | 'relationship'
  | 'importers'
  | 'architecture';

export interface CompositionalQuery {
  rawQuery: string;
  normalizedQuery: string;
  primaryIntent: QueryIntentCategory;
  secondaryIntents: QueryIntentCategory[];
  requestedOutputs: Set<RequestedOutput>;

  // Entity references
  primaryTarget: string;
  secondaryTargets: string[];
  rawEntityTokens: string[];
  sourceEntity?: string;
  targetEntity?: string;

  // Modifiers and qualifiers
  qualifiers: string[];
  isCount: boolean;
  countTarget?: string;
  isNegation: boolean;
  isMultiIntent: boolean;
  isAmbiguous: boolean;

  // Constraints
  languageConstraint?: string;
  pathConstraint?: string;
  kindConstraint?: 'class' | 'function' | 'file' | 'asset' | 'config' | 'route' | 'test';
}

export class CompositionalQueryParser {
  /**
   * Parses a natural language query into a rich compositional query structure.
   */
  static parse(query: string): CompositionalQuery {
    const raw = query.trim();
    const clean = raw.replace(/[?!.]+$/, '').trim();
    const lower = clean.toLowerCase();

    const requestedOutputs = new Set<RequestedOutput>();
    const secondaryIntents: QueryIntentCategory[] = [];
    const qualifiers: string[] = [];
    let primaryIntent: QueryIntentCategory = 'general_explanation';
    let primaryTarget = '';
    const secondaryTargets: string[] = [];
    let sourceEntity: string | undefined = undefined;
    let targetEntity: string | undefined = undefined;
    let isCount = false;
    let countTarget: string | undefined = undefined;
    let isNegation = false;
    let kindConstraint: CompositionalQuery['kindConstraint'] = undefined;

    // 1. Negation detection
    if (/\b(no|not|without|never|unconfigured|non-existent|missing)\b/i.test(lower)) {
      isNegation = true;
    }

    // 2. Count detection
    const countMatch = lower.match(/^(?:how\s+many|count\s+(?:of\s+)?|number\s+of\s+|total\s+(?:number\s+of\s+)?)(.+)/i);
    if (countMatch) {
      isCount = true;
      requestedOutputs.add('count');
      primaryIntent = 'count_quantity';
      let rawCount = countMatch[1].trim();
      rawCount = rawCount.replace(/(?:\s+(?:items?|exist|present|are\s+there|there\s+are|in\s+total)\??)+$/i, '').trim();
      rawCount = rawCount.replace(/^(?:the|a|an|all)\s+/i, '').trim();
      countTarget = rawCount;
      primaryTarget = countTarget;
    }

    // 3. Multi-hop / Relationship / Call chain
    const chainMatch = lower.match(/(?:call\s+chain|flow\s+from|how\s+does\s+(.+?)\s+(?:reach|connect\s+to|call|lead\s+to)\s+(.+)|trace\s+(?:the\s+)?(?:call\s+path|calls?|chain)\s+from\s+(.+?)\s+to\s+(.+)|(?:does|is|can)\s+([A-Za-z0-9_]+)\s+call\s+([A-Za-z0-9_]+))/i) ||
                       lower.match(/from\s+([A-Za-z0-9_]+)\s+to\s+([A-Za-z0-9_]+)/i);
    if (chainMatch) {
      requestedOutputs.add('relationship');
      primaryIntent = 'relationship_data_flow';
      if (chainMatch[1] && chainMatch[2]) {
        sourceEntity = chainMatch[1].trim();
        targetEntity = chainMatch[2].trim();
      } else if (chainMatch[3] && chainMatch[4]) {
        sourceEntity = chainMatch[3].trim();
        targetEntity = chainMatch[4].trim();
      } else if (chainMatch[5] && chainMatch[6]) {
        sourceEntity = chainMatch[5].trim();
        targetEntity = chainMatch[6].trim();
      }
    }

    // 4. Definition requests ("where is X defined?", "what file defines X?", "what is X?", "find function X")
    if (/\b(defined?|definition|declares?|declaration|what\s+is\s+|create|implements?|find\s+(?:function|method|class|symbol|definition))\b/i.test(lower)) {
      requestedOutputs.add('definition');
      if (primaryIntent === 'general_explanation') {
        primaryIntent = 'definition';
      } else {
        secondaryIntents.push('definition');
      }
    }

    // 5. Usage / Reference requests ("where is X used?", "where is X referenced?", "where is X called?", "where is X instantiated?")
    if (/\b(used|uses|usage|referenced?|references|invocations?|called|instantiated|invoked)\b/i.test(lower)) {
      requestedOutputs.add('usage');
      if (primaryIntent === 'general_explanation') {
        primaryIntent = 'usage_reference';
      } else {
        secondaryIntents.push('usage_reference');
      }
    }

    // 6. Caller / Callee requests ("who calls X?", "what does X call?", "where is X invoked/called?", "what calls X?")
    if (/\b(who\s+calls?|callers?|invoked\s+by|called\s+by|what\s+calls?|what\s+functions?\s+calls?)\b/i.test(lower) || /where\s+is\s+.+?\s+(?:invoked|called)\??$/i.test(lower)) {
      requestedOutputs.add('callers');
      primaryIntent = 'caller_callee';
    } else if (/\b(what\s+does\s+.+?\s+call|callees?|what\s+functions\s+are\s+called\s+by)\b/i.test(lower)) {
      requestedOutputs.add('callees');
      primaryIntent = 'caller_callee';
    }

    // 7. Workflow / Behavioral requests ("how does X work?", "how is X executed?", "what happens during X?", "how are X filtered")
    if (/^(?:how\s+does\s+|how\s+is\s+|how\s+do\s+|how\s+are\s+|workflow\s+of\s+|process\s+of\s+|lifecycle\s+of\s+)/i.test(lower) && !isCount && !chainMatch) {
      requestedOutputs.add('workflow');
      primaryIntent = 'behavior_workflow';
    }

    // 8. Configuration requests ("where is X configured?", "what port does server use?", "database url", "settings for X")
    if (/\b(configured?|configuration|config|settings?|environment|env\b|port|database\s+url|host|api\s+key)\b/i.test(lower)) {
      requestedOutputs.add('config');
      if (primaryIntent === 'general_explanation') {
        primaryIntent = 'configuration';
      } else {
        secondaryIntents.push('configuration');
      }
    }

    // 9. Documentation requests ("readme", "setup instructions", "how to install", "how to run", "dependencies", "quickstart", "documentation")
    if (/\b(readme|setup\s+instructions?|setup\s+guide|installation|install|how\s+to\s+install|how\s+to\s+run|getting\s+started|quickstart|quick\s+start|dependencies|docs?|documentation)\b/i.test(lower)) {
      requestedOutputs.add('doc');
      primaryIntent = 'documentation';
    }

    // 10. Asset / Resource requests ("path of logo", "where is logo", "favicon", "icon", "banner", "static file", "csv", "dataset")
    if (/\b(logo|favicon|icon|banner|avatar|asset|assets|image|images|picture|graphic|static\s+file|badge|csv|dataset)\b/i.test(lower)) {
      requestedOutputs.add('asset');
      if (primaryIntent === 'general_explanation') {
        primaryIntent = 'asset_resource';
      } else {
        secondaryIntents.push('asset_resource');
      }
    }

    // 11. Testing requests ("tests for X", "how is X tested", "unit test", "spec")
    if (/\b(tests?|testing|tested|spec|test\s+cases?|coverage)\b/i.test(lower)) {
      requestedOutputs.add('test');
      if (primaryIntent === 'general_explanation') {
        primaryIntent = 'testing';
      } else {
        secondaryIntents.push('testing');
      }
    }

    // 12. Error handling requests ("how are errors handled", "exception", "try catch", "error handling")
    if (/\b(error|exception|failure|crash|handled|try\s+catch)\b/i.test(lower)) {
      requestedOutputs.add('error');
      if (primaryIntent === 'general_explanation') {
        primaryIntent = 'error_handling';
      } else {
        secondaryIntents.push('error_handling');
      }
    }

    // 13. Location / Path requests ("where is X?", "where are X?", "path of X", "file location")
    if (/\b(where\s+(?:is|are)|path\s+of|location\s+of|which\s+file\s+contains)\b/i.test(lower) && (requestedOutputs.size === 0 || primaryIntent === 'general_explanation')) {
      requestedOutputs.add('path');
      primaryIntent = 'file_path_location';
    }

    // 14. Architecture / Entry point requests
    if (/\b(entry\s+point|architecture|main\s+file|bootstrap|overview\s+of\s+architecture)\b/i.test(lower)) {
      requestedOutputs.add('architecture');
      primaryIntent = 'structural_architectural';
    }

    // Kind constraint extraction
    if (/\bclass(es)?\b/i.test(lower)) kindConstraint = 'class';
    else if (/\bfunctions?|methods?\b/i.test(lower)) kindConstraint = 'function';
    else if (/\bfile(s)?\b/i.test(lower)) kindConstraint = 'file';
    else if (/\broutes?|endpoints?\b/i.test(lower)) kindConstraint = 'route';

    // Qualifiers
    if (/\bmain\b/i.test(lower)) qualifiers.push('main');
    if (/\bdefault\b/i.test(lower)) qualifiers.push('default');
    if (/\ball\b/i.test(lower)) qualifiers.push('all');
    if (/\bexported\b/i.test(lower)) qualifiers.push('exported');

    // Extract target entity if not yet determined
    if (!primaryTarget) {
      primaryTarget = CompositionalQueryParser.extractTarget(clean, requestedOutputs);
    }

    // Entity tokens
    const rawEntityTokens = primaryTarget
      .replace(/[_\-./\\]/g, ' ')
      .split(/\s+/)
      .map(t => t.toLowerCase().trim())
      .filter(t => t.length > 1 && !['the', 'a', 'an', 'is', 'where', 'how', 'what', 'who'].includes(t));

    const isMultiIntent = requestedOutputs.size > 1;

    return {
      rawQuery: raw,
      normalizedQuery: clean,
      primaryIntent,
      secondaryIntents,
      requestedOutputs,
      primaryTarget,
      secondaryTargets,
      rawEntityTokens,
      sourceEntity,
      targetEntity,
      qualifiers,
      isCount,
      countTarget,
      isNegation,
      isMultiIntent,
      isAmbiguous: false,
      kindConstraint
    };
  }

  private static extractTarget(query: string, requestedOutputs: Set<RequestedOutput>): string {
    let clean = query
      .replace(/^(?:where\s+(?:is|are)\s+(?:the\s+)?|find\s+(?:the\s+)?(?:function|method|class|definition\s+of\s+)?|what\s+(?:is|are)\s+(?:the\s+)?|what\s+does\s+(?:the\s+)?(?:project\s+)?(?:docs?|documentation|readme)\s+say\s+(?:about\s+)?|who\s+calls\s+|what\s+calls\s+|what\s+functions?\s+calls?\s+|what\s+does\s+|how\s+does\s+|how\s+is\s+|how\s+are\s+|which\s+file\s+(?:defines|contains)\s+|show\s+(?:me\s+)?(?:the\s+)?)/i, '')
      .replace(/(?:\s+(?:defined|used|called|imported|implemented|located|stored|configured|handled|tested|invoked|exist|are\s+there|there\s+are|in\s+total|present)\??)+$/i, '')
      .replace(/\b(?:in\s+the\s+repository|in\s+this\s+project|in\s+the\s+codebase|in\s+the\s+code)\b/gi, '')
      .trim();

    // If query has "X on Y" (e.g. "predict on LapTimePredictor"), target is X
    if (/\b\w+\s+on\s+[A-Za-z0-9_]+/i.test(clean)) {
      const match = clean.match(/^([A-Za-z0-9_]+)\s+on\s+[A-Za-z0-9_]+/i);
      if (match) {
        clean = match[1];
      }
    }

    // Strip trailing structural words like "items"
    clean = clean.replace(/\s+items?$/i, '').trim();

    // Clean leading/trailing noise
    clean = clean.replace(/^(the|a|an|all)\s+/i, '').trim();
    return clean || query;
  }
}
