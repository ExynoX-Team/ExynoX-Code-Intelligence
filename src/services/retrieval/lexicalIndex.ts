/**
 * Inverted Lexical Index with BM25 Scoring and Symbol Matching
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 */

import type { CodeChunk } from '../../types/retrieval.js';

export interface LexicalMatch {
  chunk: CodeChunk;
  score: number;
  matchedTerms: string[];
  exactSymbolMatch: boolean;
}

export class InvertedLexicalIndex {
  // Term -> List of { chunkId, termFrequency }
  private index = new Map<string, Map<string, number>>();
  // Chunk ID -> CodeChunk
  private chunks = new Map<string, CodeChunk>();
  // Chunk ID -> token count
  private docLengths = new Map<string, number>();
  // Average document length
  private avgDocLength = 0;

  /**
   * Builds the inverted index over a set of code chunks.
   */
  indexChunks(chunks: CodeChunk[]): void {
    this.index.clear();
    this.chunks.clear();
    this.docLengths.clear();

    let totalTokens = 0;

    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);

      // Extract tokens from path, symbol, docstring, and source code
      const tokens = this.tokenizeText(`${chunk.filePath} ${chunk.symbolName} ${chunk.docstring || ''} ${chunk.sourceText}`);
      this.docLengths.set(chunk.id, tokens.length);
      totalTokens += tokens.length;

      const tfMap = new Map<string, number>();
      for (const token of tokens) {
        tfMap.set(token, (tfMap.get(token) || 0) + 1);
      }

      for (const [token, count] of tfMap.entries()) {
        if (!this.index.has(token)) {
          this.index.set(token, new Map<string, number>());
        }
        this.index.get(token)!.set(chunk.id, count);
      }
    }

    this.avgDocLength = chunks.length > 0 ? totalTokens / chunks.length : 0;
  }

  /**
   * Performs BM25 lexical ranking for a query.
   */
  search(query: string, topK = 10): LexicalMatch[] {
    const queryTokens = this.tokenizeText(query);
    if (queryTokens.length === 0) return [];

    const scores = new Map<string, number>();
    const matchedTermsMap = new Map<string, Set<string>>();
    const N = this.chunks.size;
    const k1 = 1.2;
    const b = 0.75;

    for (const token of queryTokens) {
      const postings = this.index.get(token);
      if (!postings) continue;

      const df = postings.size;
      // BM25 IDF
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

      for (const [chunkId, tf] of postings.entries()) {
        const docLen = this.docLengths.get(chunkId) || this.avgDocLength;
        const denom = tf + k1 * (1 - b + b * (docLen / (this.avgDocLength || 1)));
        const termScore = idf * ((tf * (k1 + 1)) / denom);

        scores.set(chunkId, (scores.get(chunkId) || 0) + termScore);

        if (!matchedTermsMap.has(chunkId)) {
          matchedTermsMap.set(chunkId, new Set<string>());
        }
        matchedTermsMap.get(chunkId)!.add(token);
      }
    }

    const results: LexicalMatch[] = [];
    const queryLower = query.toLowerCase();

    for (const [chunkId, rawScore] of scores.entries()) {
      const chunk = this.chunks.get(chunkId);
      if (!chunk) continue;

      const matchedTerms = Array.from(matchedTermsMap.get(chunkId) || []);
      const symbolLower = chunk.symbolName.toLowerCase();
      const exactSymbolMatch = queryLower.includes(symbolLower) || symbolLower.includes(queryLower);

      // Symbol boost
      let finalScore = rawScore;
      if (exactSymbolMatch) {
        finalScore *= 1.8;
      }
      if (chunk.filePath.toLowerCase().includes(queryLower)) {
        finalScore *= 1.3;
      }

      results.push({
        chunk,
        score: finalScore,
        matchedTerms,
        exactSymbolMatch
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  getDocumentCount(): number {
    return this.chunks.size;
  }

  /**
   * Code-aware tokenization splitting camelCase, snake_case, punctuation.
   */
  private tokenizeText(text: string): string[] {
    const rawTokens = text
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase split
      .replace(/[^a-zA-Z0-9_]+/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 1);

    return rawTokens;
  }
}
