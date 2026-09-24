/**
 * Deterministic Query Entity and Constraint Extractor
 * Extracts symbols, nouns, source/target pairs, and file constraints
 * Samsung PRISM Gen AI Hackathon (Theme 1: Agentic Code Intelligence)
 * Phase 6.5 — General Deterministic Query Intelligence Hardening
 */

import type { ExtractedQueryEntities, ParsedQueryIntent } from './types.js';

// Common English stopwords to strip when isolating query entities
const QUERY_STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'against', 'between',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'from',
  'up', 'down', 'of', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any',
  'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can',
  'will', 'just', 'should', 'now', 'what', 'which', 'who', 'whom', 'this',
  'that', 'these', 'those', 'am', 'do', 'does', 'did', 'doing', 'have',
  'has', 'had', 'having', 'would', 'could', 'find', 'show', 'tell', 'me',
  'get', 'give', 'list', 'please', 'located', 'defined', 'used', 'called',
  'stored', 'contains', 'path', 'location'
]);

/**
 * Normalizes noun plural forms to canonical singular form.
 */
export function normalizeSingular(word: string): string {
  const w = word.toLowerCase();
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('classes')) return 'class';
  if (w.endsWith('es') && (w.endsWith('shes') || w.endsWith('ches') || w.endsWith('sses') || w.endsWith('xes'))) {
    return w.slice(0, -2);
  }
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('is') && !w.endsWith('us') && w.length > 2) {
    return w.slice(0, -1);
  }
  return w;
}

/**
 * Cleans code symbol string (removes parens, quotes, noise words).
 */
export function cleanSymbol(raw: string): string {
  return raw
    .trim()
    .replace(/^['"`]|['"`]$/g, '')
    .replace(/\(\s*\)$/, '')
    .replace(/^the\s+/i, '')
    .replace(/\s+(?:function|class|method|module|file|variable|component)$/i, '')
    .trim();
}

/**
 * Extracts entities, constraints, and source/target pairs from query.
 */
export function extractQueryEntities(
  query: string,
  intent: ParsedQueryIntent
): ExtractedQueryEntities {
  const rawQuery = query.trim();
  const normalizedQuery = rawQuery.replace(/[?!.,;:]+$/, '').trim();
  const lower = normalizedQuery.toLowerCase();

  let sourceEntity: string | undefined;
  let targetEntity: string | undefined;
  let primaryEntity = '';
  const secondaryEntities: string[] = [];
  const symbols: string[] = [];
  const fileTypeConstraints: string[] = [];
  const pathConstraints: string[] = [];

  // 1. Check for Call Chain / Relationship "from A to B"
  const chainMatch = lower.match(/(?:from\s+)?([a-zA-Z0-9_().]+)\s+(?:to|reach|connects?\s+to)\s+([a-zA-Z0-9_().]+)/i);
  if (chainMatch) {
    sourceEntity = cleanSymbol(chainMatch[1]);
    targetEntity = cleanSymbol(chainMatch[2]);
    primaryEntity = `${sourceEntity} -> ${targetEntity}`;
    symbols.push(sourceEntity, targetEntity);
  }

  // 2. Check for File Type constraints ("Python files", "YAML", "Markdown", "TSX", etc.)
  if (lower.includes('python')) fileTypeConstraints.push('py', 'python');
  if (lower.includes('typescript') || lower.includes('ts')) fileTypeConstraints.push('ts', 'tsx');
  if (lower.includes('javascript') || lower.includes('js')) fileTypeConstraints.push('js', 'jsx');
  if (lower.includes('yaml') || lower.includes('yml')) fileTypeConstraints.push('yaml', 'yml');
  if (lower.includes('markdown') || lower.includes('readme')) fileTypeConstraints.push('md');
  if (lower.includes('image') || lower.includes('logo') || lower.includes('png') || lower.includes('svg')) {
    fileTypeConstraints.push('png', 'svg', 'jpg', 'jpeg', 'ico', 'webp');
  }

  // 3. Check for specific entity extraction based on intent patterns
  if (!primaryEntity) {
    // A. "Where is the server defined?" -> server
    // B. "Where is the application entry point?" -> application entry point
    // C. "What is the path of the ExynoX logo?" -> exynox logo
    // D. "Where is the database configured?" -> database
    // E. "Where is Redis configured?" -> redis
    // F. "Where are the tests for this function?" -> tests / function
    // G. "Who calls this function?" -> function
    // H. "How does authentication work?" -> authentication
    // I. "How does prediction work?" -> prediction
    // J. "How many classes are there?" -> classes
    // K. "How many Python files are there?" -> python files

    // Pattern: "path of (the )?X"
    const pathMatch = lower.match(/(?:path\s+(?:of|to)\s+(?:the\s+)?)(.+)/i);
    if (pathMatch) {
      primaryEntity = cleanSymbol(pathMatch[1]);
    }

    // Pattern: "where is (the )?X (defined|configured|used|referenced|imported|located)?"
    const whereMatch = lower.match(/where\s+(?:is|are|can\s+i\s+find)\s+(?:the\s+)?(?:function\s+|class\s+|method\s+)?(.+?)(?:\s+(?:defined|configured|used|referenced|imported|located|found|stored))?$/i);
    if (whereMatch && !primaryEntity) {
      primaryEntity = cleanSymbol(whereMatch[1]);
    }

    // Pattern: "who calls X" / "what does X call"
    const callMatch = lower.match(/(?:who\s+calls|functions?\s+calling|callers?\s+of)\s+([a-zA-Z0-9_().]+)/i)
      || lower.match(/(?:what\s+does\s+([a-zA-Z0-9_().]+)\s+call|callees?\s+of\s+([a-zA-Z0-9_().]+))/i);
    if (callMatch && !primaryEntity) {
      primaryEntity = cleanSymbol(callMatch[1] || callMatch[2]);
    }

    // Pattern: "how does X work"
    const behaviorMatch = lower.match(/how\s+does\s+(?:the\s+)?(.+?)\s+(?:work|function|operate)/i);
    if (behaviorMatch && !primaryEntity) {
      primaryEntity = cleanSymbol(behaviorMatch[1]);
    }

    // Pattern: "how many X are there"
    const countMatch = lower.match(/how\s+many\s+(.+?)(?:\s+are\s+there|\s+does\s+this|\s+exist|$)/i);
    if (countMatch && !primaryEntity) {
      primaryEntity = cleanSymbol(countMatch[1]);
    }

    // Pattern: "tests for X" / "which test covers X"
    const testMatch = lower.match(/(?:tests?\s+for|test\s+covers?\s+)(.+)/i);
    if (testMatch && !primaryEntity) {
      primaryEntity = cleanSymbol(testMatch[1]);
    }

    // Pattern: "what does X import" / "where is X imported"
    const importMatch = lower.match(/(?:where\s+is\s+(.+?)\s+imported|what\s+does\s+(.+?)\s+import|depend\s+on\s+(.+))/i);
    if (importMatch && !primaryEntity) {
      primaryEntity = cleanSymbol(importMatch[1] || importMatch[2] || importMatch[3]);
    }
  }

  // If still empty, derive primary entity by removing stopwords and question words
  if (!primaryEntity) {
    const tokens = normalizedQuery.split(/\s+/);
    const meaningful = tokens.filter(t => !QUERY_STOPWORDS.has(t.toLowerCase()));
    primaryEntity = meaningful.join(' ').trim();
  }

  // Clean primary entity
  primaryEntity = cleanSymbol(primaryEntity);

  // Extract explicit symbol candidates (alphanumeric with underscores, camelCase, snake_case)
  const symbolMatches = normalizedQuery.match(/\b[a-zA-Z_][a-zA-Z0-9_]{2,}\b/g) || [];
  for (const s of symbolMatches) {
    if (!QUERY_STOPWORDS.has(s.toLowerCase()) && !symbols.includes(s)) {
      symbols.push(s);
    }
  }

  // Check negation
  const isNegation = lower.includes('not') || lower.includes('never') || lower.includes('without') || lower.includes('no ');

  return {
    rawQuery,
    normalizedQuery,
    primaryEntity,
    secondaryEntities,
    symbols,
    fileTypeConstraints,
    pathConstraints,
    isNegation,
    sourceEntity,
    targetEntity
  };
}
