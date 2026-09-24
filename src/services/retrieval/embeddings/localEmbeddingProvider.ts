/**
 * High-Performance Deterministic Local Embedding Provider
 * Zero external network dependencies, fast client-side cosine similarity.
 * Language-neutral code intelligence concepts: JavaScript/TypeScript & Python.
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 */

import type { EmbeddingProvider } from '../../../types/retrieval.js';

// 16 Curated universal software engineering & code intelligence concepts (32 dimensions)
const SEMANTIC_CONCEPTS: { name: string; terms: string[] }[] = [
  { name: 'auth_security', terms: ['auth', 'login', 'token', 'jwt', 'verify', 'password', 'credential', 'mfa', 'authenticate', 'bearer', 'session', 'oauth'] },
  { name: 'database_storage', terms: ['database', 'connection', 'db', 'db_url', 'sql', 'query', 'table', 'store', 'repository', 'connect', 'schema', 'entity'] },
  { name: 'network_http', terms: ['middleware', 'request', 'response', 'headers', 'dispatch', 'authorization', 'handler', 'route', 'api', 'http', 'fetch', 'axios', 'endpoint'] },
  { name: 'ml_computation', terms: ['predict', 'prediction', 'model', 'inference', 'dataset', 'features', 'train', 'classifier', 'regression', 'estimator', 'calculate'] },
  { name: 'crypto_hashing', terms: ['crypto', 'hash', 'salt', 'hmac', 'sha256', 'secret', 'signature', 'sign', 'digest', 'encrypt', 'decrypt'] },
  { name: 'device_hardware', terms: ['device', 'bluetooth', 'hub', 'settings', 'deeplink', 'pairing', 'hardware', 'beacon', 'adapter', 'sensor', 'peripheral'] },
  { name: 'error_handling', terms: ['error', 'exception', 'catch', 'raise', 'try', 'throw', 'fault', 'fail', 'fallback', 'validationerror', 'reject'] },
  { name: 'audit_logging', terms: ['audit', 'log', 'security_event', 'logging', 'logger', 'trace', 'events', 'monitor', 'record', 'debug', 'console'] },
  { name: 'config_environment', terms: ['config', 'settings', 'env', 'environment', 'debug', 'host', 'port', 'url', 'parameter', 'options', 'constants'] },
  { name: 'async_concurrency', terms: ['async', 'await', 'promise', 'then', 'observable', 'stream', 'event', 'emit', 'listen', 'subscribe', 'channel'] },
  { name: 'data_parsing', terms: ['load', 'read', 'csv', 'parse', 'json', 'dataset', 'records', 'file', 'stream', 'import_data', 'serialize'] },
  { name: 'initialization', terms: ['init', 'initialize', 'bootstrap', 'startup', 'main', 'start', 'lifecycle', 'setup', 'index', 'app'] },
  { name: 'class_architecture', terms: ['class', 'base', 'inherit', 'subclass', 'mixin', 'constructor', 'prototype', 'extends', 'implements', 'interface'] },
  { name: 'call_graph', terms: ['call', 'caller', 'callee', 'calls', 'invoke', 'execute', 'run', 'pipeline', 'dispatch', 'forward'] },
  { name: 'user_management', terms: ['user', 'username', 'account', 'profile', 'role', 'scopes', 'permissions', 'admin', 'tenant', 'member'] },
  { name: 'validation_check', terms: ['validate_token', 'validate', 'validation', 'check', 'valid', 'expiry', 'authentic', 'assert', 'verify', 'schema'] }
];

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = 'exynox-local-fast-embed';
  readonly dimension = 128; // 96 n-gram hashing dimensions + 32 semantic concept dimensions

  /**
   * Generates a 128-dimensional normalized dense semantic vector for text.
   */
  async embedText(text: string): Promise<number[]> {
    const vector = new Array<number>(this.dimension).fill(0);
    const normalized = text.toLowerCase();
    const tokens = normalized.split(/[^a-z0-9_]+/).filter(t => t.length > 1);

    // 1. Subword character 3-grams and token hashing (dimensions 0 to 95)
    for (const token of tokens) {
      const hToken = this.hashString(token) % 48;
      vector[hToken] += 1.0;

      // 3-grams
      for (let i = 0; i <= token.length - 3; i++) {
        const trigram = token.slice(i, i + 3);
        const hTri = 48 + (this.hashString(trigram) % 48);
        vector[hTri] += 0.5;
      }
    }

    // 2. Latent code concept projection (dimensions 96 to 127)
    for (let cIdx = 0; cIdx < SEMANTIC_CONCEPTS.length; cIdx++) {
      const concept = SEMANTIC_CONCEPTS[cIdx];
      let matchWeight = 0;

      for (const term of concept.terms) {
        if (tokens.includes(term)) {
          matchWeight += 2.0;
        } else if (normalized.includes(term)) {
          matchWeight += 1.0;
        }
      }

      if (matchWeight > 0) {
        vector[96 + (cIdx * 2)] += matchWeight;
        vector[96 + (cIdx * 2) + 1] += Math.log1p(matchWeight);
      }
    }

    // 3. L2 Normalization (Euclidean norm = 1.0)
    let sumSq = 0;
    for (let i = 0; i < this.dimension; i++) {
      sumSq += vector[i] * vector[i];
    }

    if (sumSq > 0) {
      const norm = Math.sqrt(sumSq);
      for (let i = 0; i < this.dimension; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  /**
   * Generates embeddings for a batch of text items sequentially/concurrently.
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embedText(t)));
  }

  /**
   * Fast polynomial rolling hash for string tokens
   */
  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
