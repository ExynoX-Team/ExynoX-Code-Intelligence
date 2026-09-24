/**
 * Repository Vocabulary Index
 * Builds an inverted index of all terms, symbols, filenames, and config keys in a repository.
 * Zero hardcoding.
 */

import type { VocabularyTokenMatch } from './types.js';

export class RepositoryVocabulary {
  private tokenIndex = new Map<string, VocabularyTokenMatch[]>();

  /**
   * Decomposes a name (camelCase, PascalCase, snake_case, kebab-case, dot-notation) into sub-tokens.
   */
  static tokenize(text: string): string[] {
    if (!text) return [];
    // Replace punctuation and separators with spaces
    const normalized = text
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase split
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // XMLParser -> XML Parser
      .replace(/[_\-./\\:@#]/g, ' ')
      .toLowerCase();

    return normalized
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t.length > 1);
  }

  /**
   * Adds a token mapping to the vocabulary index.
   */
  addToken(token: string, match: VocabularyTokenMatch): void {
    const clean = token.toLowerCase().trim();
    if (!clean || clean.length < 2) return;

    let list = this.tokenIndex.get(clean);
    if (!list) {
      list = [];
      this.tokenIndex.set(clean, list);
    }
    // Avoid exact duplicate matches for same entity
    if (!list.some(m => m.entityId === match.entityId && m.filePath === match.filePath)) {
      list.push(match);
    }
  }

  /**
   * Indexes an entity under its full name and all decomposed sub-tokens.
   */
  indexEntity(name: string, match: VocabularyTokenMatch): void {
    const rawLower = name.toLowerCase().trim();
    if (rawLower.length >= 2) {
      this.addToken(rawLower, { ...match, weight: match.weight * 1.2 });
    }

    const subTokens = RepositoryVocabulary.tokenize(name);
    for (const token of subTokens) {
      this.addToken(token, match);
    }
  }

  /**
   * Searches for matches matching query tokens.
   */
  search(tokens: string[]): VocabularyTokenMatch[] {
    const scoreMap = new Map<string, { match: VocabularyTokenMatch; score: number }>();

    for (const token of tokens) {
      const clean = token.toLowerCase().trim();
      const directMatches = this.tokenIndex.get(clean) || [];

      for (const m of directMatches) {
        const key = `${m.entityType}:${m.entityId}`;
        const existing = scoreMap.get(key);
        if (existing) {
          existing.score += m.weight * 1.5; // Token overlap reinforcement
        } else {
          scoreMap.set(key, { match: m, score: m.weight });
        }
      }

      // Partial prefix/suffix matches for stems
      if (clean.length >= 4) {
        for (const [indexToken, matches] of this.tokenIndex.entries()) {
          if (indexToken !== clean && (indexToken.startsWith(clean) || clean.startsWith(indexToken))) {
            for (const m of matches) {
              const key = `${m.entityType}:${m.entityId}`;
              const existing = scoreMap.get(key);
              if (existing) {
                existing.score += m.weight * 0.7;
              } else {
                scoreMap.set(key, { match: m, score: m.weight * 0.7 });
              }
            }
          }
        }
      }
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .map(entry => ({ ...entry.match, weight: entry.score }));
  }

  getAllTokens(): string[] {
    return Array.from(this.tokenIndex.keys());
  }
}
