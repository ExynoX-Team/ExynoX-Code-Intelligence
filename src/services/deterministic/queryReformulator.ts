/**
 * Deterministic Query Reformulator & Expansion Engine
 * Expands concepts and entities using domain knowledge without any LLM
 * Samsung PRISM Gen AI Hackathon (Theme 1: Agentic Code Intelligence)
 * Phase 6.5 — General Deterministic Query Intelligence Hardening
 */

import { normalizeSingular } from './entityExtractor.js';
import type { QueryIntentCategory } from './types.js';

// Deterministic concept thesaurus for repository intelligence
const CONCEPT_EXPANSIONS: Record<string, string[]> = {
  auth: ['auth', 'authenticate', 'login', 'jwt', 'session', 'token', 'credentials', 'password', 'user'],
  authentication: ['auth', 'authenticate', 'login', 'jwt', 'session', 'token', 'credentials', 'password', 'user'],
  login: ['login', 'authenticate', 'credentials', 'password', 'session', 'token', 'auth'],
  
  predict: ['predict', 'prediction', 'predictor', 'model', 'inference', 'forecast', 'regression', 'pipeline'],
  prediction: ['predict', 'prediction', 'predictor', 'model', 'inference', 'forecast', 'regression', 'pipeline'],
  
  logo: ['logo', 'icon', 'brand', 'favicon', 'banner', 'mark', 'asset', 'image', 'png', 'svg'],
  asset: ['asset', 'logo', 'icon', 'image', 'static', 'public', 'resource', 'svg', 'png'],
  favicon: ['favicon', 'icon', 'logo'],
  
  server: ['server', 'express', 'listen', 'port', 'host', 'http', 'app', 'routes'],
  entry: ['entry', 'main', 'index', 'app', '__main__', 'start', 'run'],
  'entry point': ['entry', 'main', 'index', 'app', '__main__', 'start', 'server', 'cli'],
  
  database: ['database', 'db', 'sql', 'sqlite', 'postgres', 'postgresql', 'mongo', 'redis', 'datasource', 'connection'],
  db: ['database', 'db', 'sql', 'sqlite', 'postgres', 'datasource', 'connection'],
  redis: ['redis', 'redis_client', 'redis_url', 'redis_host', 'cache_redis'],
  
  setup: ['setup', 'install', 'installation', 'getting started', 'readme', 'requirements', 'quickstart', 'run'],
  install: ['install', 'installation', 'setup', 'requirements', 'package.json', 'pip'],
  installation: ['installation', 'install', 'setup', 'readme', 'getting started'],
  
  test: ['test', 'tests', 'spec', '__tests__', 'pytest', 'unittest', 'assert', 'describe', 'it'],
  tests: ['test', 'tests', 'spec', '__tests__', 'pytest', 'unittest', 'assert'],
  
  error: ['error', 'exception', 'catch', 'raise', 'throw', 'fail', 'failure', 'handler', 'try'],
  exception: ['exception', 'error', 'catch', 'raise', 'throw', 'handler'],
  
  driver: ['driver', 'drivers', 'f1_drivers', 'roster', 'driver_id'],
  degradation: ['degradation', 'tire', 'tire_age', 'compound'],
  telemetry: ['telemetry', 'dataset', 'sensor', 'laps', 'records']
};

/**
 * Expands an entity and intent into a deterministic list of search keywords and symbols.
 */
export function reformulateQuery(
  entity: string,
  intent: QueryIntentCategory,
  symbols: string[]
): string[] {
  const result = new Set<string>();

  if (entity) {
    result.add(entity);
    result.add(entity.toLowerCase());
    
    // Singular & plural
    const singular = normalizeSingular(entity);
    result.add(singular);

    // Individual words
    const tokens = entity.split(/\s+/).filter(t => t.length > 2);
    for (const t of tokens) {
      result.add(t.toLowerCase());
      result.add(normalizeSingular(t));
    }

    // Underscore and hyphen variants
    result.add(entity.replace(/\s+/g, '_').toLowerCase());
    result.add(entity.replace(/\s+/g, '-').toLowerCase());
  }

  for (const s of symbols) {
    result.add(s);
    result.add(s.toLowerCase());
    const singular = normalizeSingular(s);
    result.add(singular);
  }

  // Look up concept expansions
  const termsToCheck = [entity.toLowerCase(), ...symbols.map(s => s.toLowerCase())];
  for (const term of termsToCheck) {
    // Exact or prefix check
    for (const [key, expansions] of Object.entries(CONCEPT_EXPANSIONS)) {
      if (term === key || term.includes(key) || key.includes(term)) {
        for (const exp of expansions) {
          result.add(exp);
        }
      }
    }
  }

  // Add intent-specific anchor keywords
  switch (intent) {
    case 'configuration':
      result.add('config');
      result.add('settings');
      result.add('env');
      break;
    case 'asset_resource':
      result.add('asset');
      result.add('public');
      result.add('image');
      break;
    case 'documentation':
      result.add('readme');
      result.add('setup');
      result.add('install');
      break;
    case 'testing':
      result.add('test');
      result.add('spec');
      break;
    case 'error_handling':
      result.add('error');
      result.add('exception');
      break;
    case 'structural_architectural':
      if (entity.includes('server')) {
        result.add('listen');
        result.add('express');
      }
      break;
  }

  return Array.from(result);
}
