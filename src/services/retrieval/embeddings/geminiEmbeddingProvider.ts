/**
 * Gemini-based Embedding Provider with automatic graceful fallback
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 */

import type { EmbeddingProvider } from '../../../types/retrieval.js';
import { LocalEmbeddingProvider } from './localEmbeddingProvider.js';

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = 'gemini-text-embedding-004';
  readonly dimension = 768;
  private fallback: LocalEmbeddingProvider;
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    this.fallback = new LocalEmbeddingProvider();
    this.apiKey = apiKey || (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || null;
  }

  async embedText(text: string): Promise<number[]> {
    if (!this.apiKey) {
      return this.fallback.embedText(text);
    }

    try {
      // Dynamic import to support lazy loading
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: this.apiKey });
      const response = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: text
      });

      const res = response as { embedding?: { values: number[] }; embeddings?: Array<{ values: number[] }> };
      if (res.embedding?.values) {
        return res.embedding.values;
      }
      if (res.embeddings && res.embeddings.length > 0 && res.embeddings[0].values) {
        return res.embeddings[0].values;
      }
      return this.fallback.embedText(text);
    } catch {
      // Graceful fallback to local provider on any API or network issue
      return this.fallback.embedText(text);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embedText(t)));
  }
}
