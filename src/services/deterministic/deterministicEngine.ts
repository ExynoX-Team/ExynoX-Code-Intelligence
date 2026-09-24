/**
 * Deterministic Repository Intelligence Engine
 * Orchestrates the full AI-OFF deterministic repository intelligence pipeline
 * Samsung PRISM Gen AI Hackathon (Theme 1: Agentic Code Intelligence)
 * Phase 6.6 — General-Purpose Deterministic Repository Intelligence Engine
 *
 * Replaces hardcoded string matches with a general-purpose, multi-stage retrieval
 * and evidence-verified reasoning architecture.
 * Zero hardcoding. Zero LLM.
 */

import type { RepositoryWorkspace } from '../repository/repositoryWorkspace.js';
import type { DeterministicQueryResult } from './types.js';
import { CompositionalQueryParser } from './queryUnderstanding/compositionalQuery.js';
import { getOrCreateKnowledgeModel } from './knowledgeModel/knowledgeModel.js';
import { EntityResolver } from './entityResolution/entityResolver.js';
import { MultiStageRetriever } from './multiStageRetriever/multiStageRetriever.js';
import { EvidenceVerifier } from './evidenceVerifier/evidenceVerifier.js';
import { AnswerSynthesizer } from './answerSynthesis/answerSynthesizer.js';

export class DeterministicEngine {
  /**
   * Executes the full deterministic repository intelligence pipeline:
   * 1. Query Understanding (Compositional query decomposition)
   * 2. Repository Knowledge Model (Unified graph representation)
   * 3. Entity Resolution (Vocabulary matching & ambiguity detection)
   * 4. Multi-Stage Candidate Retrieval (Exact, Lexical, Concept, Structural, Call Graph)
   * 5. Evidence Verification (Strict validation against real repository files & line bounds)
   * 6. Answer Synthesis (Structured grounded answer without LLM hallucination)
   */
  async execute(
    query: string,
    workspace: RepositoryWorkspace
  ): Promise<DeterministicQueryResult> {
    const cleanQuery = query.trim();

    // 1. Compositional Query Understanding
    const compositionalQuery = CompositionalQueryParser.parse(cleanQuery);

    // 2. Unified Repository Knowledge Model
    const model = getOrCreateKnowledgeModel(workspace);

    // 3. Entity Resolution & Ambiguity Detection
    const resolution = EntityResolver.resolve(compositionalQuery, model);

    // 4. Multi-Stage Evidence Retrieval
    const evidenceGraph = MultiStageRetriever.retrieve(compositionalQuery, resolution, model);

    // 5. Strict Evidence Verification
    const candidateNodes = evidenceGraph.getAllNodes();
    const verifiedEvidence = EvidenceVerifier.verifyAll(candidateNodes, model);

    // 6. Grounded Answer Synthesis
    return AnswerSynthesizer.synthesize(
      compositionalQuery,
      resolution,
      verifiedEvidence,
      model
    );
  }
}

export const deterministicEngine = new DeterministicEngine();
