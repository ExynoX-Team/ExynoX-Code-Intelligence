/**
 * In-Memory Vector Store with Cosine Similarity Search
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 */

import type { VectorStore, EmbeddedChunk, VectorSearchResult, CodeChunk } from '../../../types/retrieval.js';

export class InMemoryVectorStore implements VectorStore {
  private items: EmbeddedChunk[] = [];

  async add(newItems: EmbeddedChunk[]): Promise<void> {
    // Upsert items by chunk id
    const existingMap = new Map<string, EmbeddedChunk>();
    for (const item of this.items) {
      existingMap.set(item.chunk.id, item);
    }
    for (const newItem of newItems) {
      existingMap.set(newItem.chunk.id, newItem);
    }
    this.items = Array.from(existingMap.values());
  }

  async search(
    queryVector: number[],
    topK = 5,
    filter?: (chunk: CodeChunk) => boolean
  ): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];

    for (const item of this.items) {
      if (filter && !filter(item.chunk)) {
        continue;
      }

      const score = this.cosineSimilarity(queryVector, item.vector);
      results.push({
        chunk: item.chunk,
        score
      });
    }

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  async delete(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    this.items = this.items.filter(item => !idSet.has(item.chunk.id));
  }

  async clear(): Promise<void> {
    this.items = [];
  }

  size(): number {
    return this.items.length;
  }

  /**
   * Cosine similarity between two vectors. Assumes L2 normalized vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    let dot = 0;
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
    }
    // Clamp between 0 and 1 for normalized vectors
    return Math.max(0, Math.min(1, dot));
  }
}
