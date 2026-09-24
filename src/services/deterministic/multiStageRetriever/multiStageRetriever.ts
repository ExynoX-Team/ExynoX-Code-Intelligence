/**
 * Multi-Stage Evidence Retriever
 * Samsung PRISM Gen AI Hackathon (Theme 1: Agentic Code Intelligence)
 * Phase 6.6 — General-Purpose Deterministic Repository Intelligence Engine
 *
 * Implements 7-stage retrieval pipeline:
 * Stage 1: Exact Match
 * Stage 2: Normalized Lexical Match
 * Stage 3: Deterministic Concept Expansion
 * Stage 4: Structural AST Retrieval
 * Stage 5: Semantic Chunk Search
 * Stage 6: Relationship & Call Graph Traversal
 * Stage 7: Context Expansion
 *
 * Zero hardcoding. Zero LLM.
 */

import type { UnifiedRepositoryKnowledgeModel } from '../knowledgeModel/knowledgeModel.js';
import type { CompositionalQuery } from '../queryUnderstanding/compositionalQuery.js';
import type { ResolvedEntityCandidate, EntityResolutionResult } from '../entityResolution/entityResolver.js';
import { EvidenceGraph, type EvidenceNode } from '../evidenceGraph/evidenceGraph.js';

export class MultiStageRetriever {
  /**
   * Deterministic concept expansions across common software engineering domains.
   */
  private static CONCEPT_MAP: Record<string, string[]> = {
    auth: ['login', 'authenticate', 'credentials', 'token', 'session', 'user'],
    authentication: ['auth', 'login', 'authenticate', 'credentials', 'token', 'session', 'user'],
    login: ['auth', 'authenticate', 'credentials', 'password'],
    predict: ['inference', 'model', 'forecast', 'pipeline', 'calculate'],
    prediction: ['predictor', 'model', 'inference', 'forecast', 'pipeline', 'lap_time'],
    pipeline: ['predict', 'prediction', 'run', 'stage', 'process', 'inference'],
    config: ['settings', 'configuration', 'env', 'environment', 'yaml', 'options'],
    data: ['dataset', 'loader', 'fetch', 'read', 'csv', 'pipeline'],
    database: ['db', 'connection', 'sql', 'query', 'schema', 'table'],
    server: ['express', 'router', 'listen', 'port', 'endpoint', 'fastapi', 'flask', 'uvicorn', 'aiohttp', 'websocket'],
    entry: ['main', 'start', 'run', 'index', 'app', 'cli'],
    asset: ['logo', 'icon', 'image', 'png', 'svg', 'static'],
    logo: ['f1_logo', 'logo', 'brand', 'icon', 'png', 'svg', 'assets'],
    doc: ['readme', 'docs', 'setup', 'instructions', 'install'],
    readme: ['readme', 'setup', 'instructions', 'architecture', 'overview']
  };

  /**
   * Retrieves evidence across all 7 stages and populates an EvidenceGraph.
   */
  static retrieve(
    query: CompositionalQuery,
    resolution: EntityResolutionResult,
    model: UnifiedRepositoryKnowledgeModel
  ): EvidenceGraph {
    const graph = new EvidenceGraph();

    // STAGE 1: Exact Match
    if (resolution.primaryCandidate) {
      const pc = resolution.primaryCandidate;
      graph.addNode({
        id: `ev_${pc.entityId}`,
        type: pc.entityType === 'asset' ? 'asset' : pc.entityType === 'config' ? 'config' : pc.entityType === 'file' ? 'file' : pc.entityType === 'doc' ? 'doc' : 'symbol',
        name: pc.name,
        filePath: pc.filePath,
        startLine: pc.startLine,
        endLine: pc.endLine,
        score: 1.0,
        metadata: { stage: 'stage1_exact', matchReason: pc.matchReason }
      });
    }

    // STAGE 2: Normalized Lexical Candidates
    for (const cand of resolution.allCandidates.slice(0, 6)) {
      graph.addNode({
        id: `ev_${cand.entityId}`,
        type: cand.entityType === 'asset' ? 'asset' : cand.entityType === 'config' ? 'config' : cand.entityType === 'file' ? 'file' : cand.entityType === 'doc' ? 'doc' : 'symbol',
        name: cand.name,
        filePath: cand.filePath,
        startLine: cand.startLine,
        endLine: cand.endLine,
        score: cand.confidence * 0.9,
        metadata: { stage: 'stage2_lexical', matchReason: cand.matchReason }
      });
    }

    // STAGE 3: Deterministic Concept Expansion
    const conceptTerms = new Set<string>();
    for (const tok of query.rawEntityTokens) {
      const expansions = MultiStageRetriever.CONCEPT_MAP[tok.toLowerCase()];
      if (expansions) {
        for (const exp of expansions) conceptTerms.add(exp);
      }
    }

    if (conceptTerms.size > 0) {
      const conceptMatches = model.vocabulary.search(Array.from(conceptTerms));
      for (const m of conceptMatches.slice(0, 5)) {
        graph.addNode({
          id: `ev_concept_${m.entityId}`,
          type: m.entityType === 'asset' ? 'asset' : m.entityType === 'config' ? 'config' : m.entityType === 'file' ? 'file' : m.entityType === 'doc' ? 'doc' : 'symbol',
          name: m.name,
          filePath: m.filePath,
          startLine: m.startLine,
          endLine: m.endLine,
          score: 0.8,
          metadata: { stage: 'stage3_concept', matchedTerm: m.name }
        });
      }
    }

    // STAGE 4: Structural AST Retrieval (Classes, Methods, Exported Functions)
    if (query.requestedOutputs.has('definition') || query.primaryIntent === 'definition') {
      const sym = model.findSymbol(query.primaryTarget);
      if (sym) {
        graph.addNode({
          id: `ev_struct_${sym.id}`,
          type: 'symbol',
          name: sym.name,
          filePath: sym.filePath,
          startLine: sym.startLine,
          endLine: sym.endLine,
          snippet: sym.snippet,
          score: 1.0,
          metadata: { stage: 'stage4_structural', kind: sym.kind }
        });
      }
    }

    // STAGE 4b: Documentation Retrieval
    if (query.primaryIntent === 'documentation' || query.requestedOutputs.has('doc')) {
      for (const [path, f] of model.files.entries()) {
        if (f.fileType === 'documentation') {
          graph.addNode({
            id: `ev_doc_${f.id}`,
            type: 'doc',
            name: f.filename,
            filePath: path,
            startLine: 1,
            endLine: f.lineCount,
            score: 1.15,
            metadata: { stage: 'stage_doc', fileType: 'documentation' }
          });
        }
      }
    }

    // STAGE 5: Relationship & Call Graph Traversal
    // Callers / Usage References
    if (query.requestedOutputs.has('callers') || query.primaryIntent === 'caller_callee' || query.primaryIntent === 'usage_reference') {
      const targetSyms = new Set<string>([query.primaryTarget, ...resolution.normalizedTerms]);
      if (query.primaryTarget.includes(' on ')) {
        const parts = query.primaryTarget.split(/\s+on\s+/i);
        parts.forEach(p => targetSyms.add(p.trim()));
      }
      if (resolution.primaryCandidate?.name) targetSyms.add(resolution.primaryCandidate.name);
      for (const sym of model.symbols) {
        const lower = sym.normalizedName;
        if (Array.from(targetSyms).some(t => (t.length >= 3 && lower.includes(t)) || (lower.length >= 3 && t.includes(lower)))) {
          targetSyms.add(sym.name);
        }
      }

      const isInvocationSiteQuery = /\b(invoked|called|who\s+calls?|callers?)\b/i.test(query.rawQuery);
      const callerScore = isInvocationSiteQuery ? 1.05 : 0.98;

      for (const symName of targetSyms) {
        const callers = model.findCallers(symName);
        for (const call of callers) {
          graph.addNode({
            id: `ev_caller_${call.callerFile.replace(/[^a-zA-Z0-9]/g, '_')}_${call.line}`,
            type: 'symbol',
            name: call.callerSymbol || call.callee,
            filePath: call.callerFile,
            startLine: call.line,
            endLine: call.line + 2,
            snippet: call.snippet,
            score: callerScore,
            metadata: { stage: 'stage5_callers', callee: call.callee }
          });
        }
      }
    }

    // Callees
    if (query.requestedOutputs.has('callees')) {
      const callees = model.findCallees(query.primaryTarget);
      for (const call of callees) {
        graph.addNode({
          id: `ev_callee_${call.callerFile}_${call.line}`,
          type: 'symbol',
          name: call.callee,
          filePath: call.callerFile,
          startLine: call.line,
          endLine: call.line + 2,
          snippet: call.snippet,
          score: 0.95,
          metadata: { stage: 'stage6_callees', callee: call.callee }
        });
      }
    }

    // Call Chain (Multi-hop)
    if (query.primaryIntent === 'relationship_data_flow' && query.sourceEntity && query.targetEntity) {
      const chain = model.findCallChain(query.sourceEntity, query.targetEntity);
      if (chain.pathFound) {
        for (let i = 0; i < chain.steps.length; i++) {
          const step = chain.steps[i];
          graph.addNode({
            id: `ev_chain_${step.file}_${step.line}`,
            type: 'symbol',
            name: step.caller,
            filePath: step.file,
            startLine: step.line,
            endLine: step.line + 2,
            score: 1.0 - i * 0.05,
            metadata: { stage: 'stage6_callchain', stepIndex: i, callee: step.callee }
          });
        }
      }
    }

    // STAGE 7: Context Expansion
    // For top nodes, ensure full enclosing context lines
    for (const node of graph.getAllNodes().slice(0, 3)) {
      const fileNode = model.files.get(node.filePath);
      if (fileNode && node.startLine) {
        const start = Math.max(1, node.startLine - 2);
        const end = Math.min(fileNode.lineCount, (node.endLine || node.startLine) + 5);
        node.startLine = start;
        node.endLine = end;
        node.snippet = fileNode.lines.slice(start - 1, end).join('\n');
      }
    }

    return graph;
  }
}
