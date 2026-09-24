/**
 * General Entity Resolution Engine & Ambiguity Detector
 * Samsung PRISM Gen AI Hackathon (Theme 1: Agentic Code Intelligence)
 * Phase 6.6 — General-Purpose Deterministic Repository Intelligence Engine
 *
 * Resolves natural language references to verified repository entities (symbols, files, configs, docs, assets).
 * Detects semantic ambiguity when multiple distinct entities match with comparable confidence.
 * Zero hardcoding. Zero LLM.
 */

import type { UnifiedRepositoryKnowledgeModel } from '../knowledgeModel/knowledgeModel.js';
import type { CompositionalQuery } from '../queryUnderstanding/compositionalQuery.js';
import { RepositoryVocabulary } from '../knowledgeModel/vocabularyIndex.js';
import { normalizeSingular } from '../entityExtractor.js';

export interface ResolvedEntityCandidate {
  entityId: string;
  entityType: 'symbol' | 'file' | 'config' | 'doc' | 'asset' | 'collection';
  name: string;
  filePath: string;
  startLine?: number;
  endLine?: number;
  confidence: number;
  matchReason: string;
  kind?: string;
  itemCount?: number;
}

export interface EntityResolutionResult {
  resolved: boolean;
  primaryCandidate?: ResolvedEntityCandidate;
  allCandidates: ResolvedEntityCandidate[];
  isAmbiguous: boolean;
  ambiguousEntities?: ResolvedEntityCandidate[];
  normalizedTerms: string[];
}

export class EntityResolver {
  private static STOPWORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'about', 'like', 'from', 'what', 'where', 'how', 'who', 'which',
    'does', 'do', 'did', 'work', 'code', 'file', 'project', 'repo', 'repository', 'there'
  ]);

  /**
   * Resolves query target entities against the repository knowledge model.
   */
  static resolve(
    query: CompositionalQuery,
    model: UnifiedRepositoryKnowledgeModel
  ): EntityResolutionResult {
    // 1. Extract & normalize search terms from query target & raw query
    const targetText = query.primaryTarget || query.normalizedQuery;
    const rawTokens = RepositoryVocabulary.tokenize(targetText);
    const meaningfulTokens: string[] = [];
    const countStructuralWords = new Set(['file', 'files', 'function', 'functions', 'class', 'classes', 'method', 'methods', 'model', 'models', 'item', 'items', 'test', 'tests', 'driver', 'drivers', 'entity', 'entities']);

    for (const t of rawTokens) {
      const isStructuralWord = countStructuralWords.has(t);
      if (!EntityResolver.STOPWORDS.has(t) || ((query.isCount || query.kindConstraint) && isStructuralWord)) {
        meaningfulTokens.push(t);
        const sing = normalizeSingular(t);
        if (sing !== t && !meaningfulTokens.includes(sing)) {
          meaningfulTokens.push(sing);
        }
      }
    }

    if (meaningfulTokens.length === 0 && !query.isCount) {
      return {
        resolved: false,
        allCandidates: [],
        isAmbiguous: false,
        normalizedTerms: []
      };
    }

    // 2. Query Repository Vocabulary
    const vocabMatches = model.vocabulary.search(meaningfulTokens);
    const candidateMap = new Map<string, ResolvedEntityCandidate>();

    // 3. Direct Symbol Matching
    let directSymbol = model.findSymbol(query.primaryTarget);
    if (!directSymbol && query.primaryTarget.includes(' on ')) {
      const parts = query.primaryTarget.split(/\s+on\s+/i);
      directSymbol = model.findSymbol(parts[0]) || model.findSymbol(parts[1]);
    }
    if (!directSymbol) {
      const targetNorm = query.primaryTarget.toLowerCase().replace(/[^a-z0-9_]/g, '');
      directSymbol = model.symbols.find(s => s.normalizedName === targetNorm || (targetNorm.length >= 6 && s.normalizedName.includes(targetNorm))) || null;
    }

    if (directSymbol) {
      candidateMap.set(directSymbol.id, {
        entityId: directSymbol.id,
        entityType: directSymbol.kind === 'collection' ? 'collection' : 'symbol',
        name: directSymbol.name,
        filePath: directSymbol.filePath,
        startLine: directSymbol.startLine,
        endLine: directSymbol.endLine,
        confidence: 1.0,
        matchReason: `Exact match for symbol name '${directSymbol.name}'`,
        kind: directSymbol.kind,
        itemCount: directSymbol.itemCount
      });
    }

    // 4. Evaluate Vocabulary Matches
    for (const vm of vocabMatches) {
      if (candidateMap.has(vm.entityId)) continue;

      let conf = Math.min(0.95, vm.weight / (meaningfulTokens.length * 1.5));
      if (conf < 0.45 && vm.weight < 0.8) continue;
      let matchReason = `Matched term in ${vm.entityType} '${vm.name}'`;

      // Boost if query kindConstraint matches
      if (query.kindConstraint === 'class' && vm.entityType === 'symbol') {
        const sym = model.symbolsById.get(vm.entityId);
        if (sym?.kind === 'class') conf += 0.2;
      } else if (query.kindConstraint === 'function' && vm.entityType === 'symbol') {
        const sym = model.symbolsById.get(vm.entityId);
        if (sym?.kind === 'function') conf += 0.2;
      } else if (query.requestedOutputs.has('asset') && vm.entityType === 'asset') {
        conf += 0.25;
      } else if (query.requestedOutputs.has('config') && vm.entityType === 'config') {
        conf += 0.25;
      }

      // Check if it's a collection
      let itemCount: number | undefined;
      let kind: string | undefined;
      if (vm.entityType === 'symbol') {
        const sym = model.symbolsById.get(vm.entityId);
        if (sym) {
          kind = sym.kind;
          itemCount = sym.itemCount;
        }
      }

      candidateMap.set(vm.entityId, {
        entityId: vm.entityId,
        entityType: (kind === 'collection' ? 'collection' : vm.entityType) as any,
        name: vm.name,
        filePath: vm.filePath,
        startLine: vm.startLine,
        endLine: vm.endLine,
        confidence: Math.min(1.0, conf),
        matchReason,
        kind,
        itemCount
      });
    }

    // 5. Check Documentation Sections
    if (query.requestedOutputs.has('doc')) {
      for (const [path, sections] of model.docs.entries()) {
        for (const sec of sections) {
          const secTitleLower = sec.title.toLowerCase();
          const matchCount = meaningfulTokens.filter(t => secTitleLower.includes(t)).length;
          if (matchCount > 0) {
            const conf = 0.7 + (matchCount / meaningfulTokens.length) * 0.25;
            candidateMap.set(sec.id, {
              entityId: sec.id,
              entityType: 'doc',
              name: sec.title,
              filePath: path,
              startLine: sec.startLine,
              endLine: sec.endLine,
              confidence: conf,
              matchReason: `Section heading matches documentation query`
            });
          }
        }
      }
    }

    // 6. Check Configuration Keys
    for (const [key, entries] of model.configKeyMap.entries()) {
      const matchCount = meaningfulTokens.filter(t => key.includes(t)).length;
      if (matchCount > 0) {
        const entry = entries[0];
        candidateMap.set(entry.id, {
          entityId: entry.id,
          entityType: 'config',
          name: entry.key,
          filePath: entry.filePath,
          startLine: entry.line,
          endLine: entry.line,
          confidence: 0.85,
          matchReason: `Configuration key '${entry.key}' matches query`
        });
      }
    }

    // 7. Check Asset Nodes
    if (query.requestedOutputs.has('asset') || query.primaryIntent === 'asset_resource') {
      for (const [path, assetNode] of model.assets.entries()) {
        const lowerFilename = assetNode.filename.toLowerCase();
        const matchCount = meaningfulTokens.filter(t => lowerFilename.includes(t)).length;
        if (matchCount > 0 || (meaningfulTokens.includes('logo') && lowerFilename.includes('logo'))) {
          candidateMap.set(assetNode.id, {
            entityId: assetNode.id,
            entityType: 'asset',
            name: assetNode.filename,
            filePath: path,
            startLine: 1,
            endLine: 1,
            confidence: 0.95,
            matchReason: `Asset filename '${assetNode.filename}' matches asset query`
          });
        }
      }
    }

    // If count query and no specific symbol/file matched, add structural count candidate
    if (query.isCount && candidateMap.size === 0) {
      candidateMap.set('count_structural_target', {
        entityId: 'count_structural_target',
        entityType: 'symbol',
        name: query.primaryTarget || 'items',
        filePath: '',
        confidence: 0.9,
        matchReason: `Structural count query for '${query.primaryTarget}'`
      });
    }

    // Sort candidates by confidence
    const allCandidates = Array.from(candidateMap.values()).sort((a, b) => b.confidence - a.confidence);

    // 8. Ambiguity Detection
    // If we have distinct candidates with different semantic kinds (e.g. a Class vs a Collection of items)
    // and both match the query target with high confidence:
    let isAmbiguous = false;
    let ambiguousEntities: ResolvedEntityCandidate[] | undefined = undefined;

    if (allCandidates.length >= 2) {
      const top1 = allCandidates[0];
      const top2 = allCandidates[1];

      const isSemanticDivergence =
        (top1.kind === 'class' && top2.kind === 'collection') ||
        (top1.kind === 'collection' && top2.kind === 'class') ||
        (top1.entityType === 'symbol' && top2.entityType === 'file' && top1.name.toLowerCase() === top2.name.toLowerCase()) ||
        (top1.entityType === 'symbol' && top2.entityType === 'collection');

      if (isSemanticDivergence && Math.abs(top1.confidence - top2.confidence) < 0.35 && top1.name.toLowerCase() !== (query.primaryTarget || '').toLowerCase()) {
        isAmbiguous = true;
        ambiguousEntities = [top1, top2];
      }
    }

    return {
      resolved: allCandidates.length > 0,
      primaryCandidate: allCandidates[0],
      allCandidates,
      isAmbiguous,
      ambiguousEntities,
      normalizedTerms: meaningfulTokens
    };
  }
}
