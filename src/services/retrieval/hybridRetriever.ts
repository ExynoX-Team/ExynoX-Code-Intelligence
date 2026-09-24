/**
 * Hybrid Code Retrieval Engine
 * Fuses Semantic Vector Search, BM25 Lexical Matching, and Python AST Structural Relations.
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 */

import type { CodeChunk, HybridSearchOptions, RetrievalFinding, WhyThisResult } from '../../types/retrieval.js';
import type { VectorStore, EmbeddingProvider } from './embeddings/types.js';
import type { InvertedLexicalIndex } from './lexicalIndex.js';
import type { StructuralIndex } from '../structural/structuralIndex.js';

export interface HybridRetrieverDependencies {
  vectorStore: VectorStore;
  embeddingProvider: EmbeddingProvider;
  lexicalIndex: InvertedLexicalIndex;
  structuralIndex?: StructuralIndex;
  allChunks: CodeChunk[];
}

export class HybridRetriever {
  private vectorStore: VectorStore;
  private embeddingProvider: EmbeddingProvider;
  private lexicalIndex: InvertedLexicalIndex;
  private structuralIndex?: StructuralIndex;
  private chunksMap = new Map<string, CodeChunk>();

  constructor(deps: HybridRetrieverDependencies) {
    this.vectorStore = deps.vectorStore;
    this.embeddingProvider = deps.embeddingProvider;
    this.lexicalIndex = deps.lexicalIndex;
    this.structuralIndex = deps.structuralIndex;

    for (const chunk of deps.allChunks) {
      this.chunksMap.set(chunk.id, chunk);
    }
  }

  /**
   * Executes unified hybrid retrieval across lexical, semantic, and structural layers.
   */
  async retrieve(
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<RetrievalFinding[]> {
    const topK = options.topK || 5;
    const queryLower = query.toLowerCase().trim();

    if (!queryLower) return [];

    // 1. Semantic vector search
    const queryVector = await this.embeddingProvider.embedText(query);
    const semanticResults = await this.vectorStore.search(
      queryVector,
      topK * 3,
      chunk => {
        if (options.language && chunk.language.toLowerCase() !== options.language.toLowerCase()) {
          return false;
        }
        return true;
      }
    );

    // 2. Lexical inverted search
    const lexicalResults = this.lexicalIndex.search(query, topK * 3);

    // 3. Fused Candidate Map
    interface CandidateScores {
      chunk: CodeChunk;
      semanticScore: number;
      lexicalScore: number;
      symbolScore: number;
      structuralScore: number;
      pathScore: number;
      signals: string[];
      evidence: string[];
      astRelations?: string[];
    }

    const candidateMap = new Map<string, CandidateScores>();

    const getOrCreateCandidate = (chunk: CodeChunk): CandidateScores => {
      let cand = candidateMap.get(chunk.id);
      if (!cand) {
        cand = {
          chunk,
          semanticScore: 0,
          lexicalScore: 0,
          symbolScore: 0,
          structuralScore: 0,
          pathScore: 0,
          signals: [],
          evidence: [],
          astRelations: []
        };
        candidateMap.set(chunk.id, cand);
      }
      return cand;
    };

    // Integrate semantic results
    for (const sr of semanticResults) {
      if (sr.score > 0.05) {
        const cand = getOrCreateCandidate(sr.chunk);
        cand.semanticScore = sr.score;
        cand.signals.push(`Semantic similarity (${(sr.score * 100).toFixed(0)}%)`);
      }
    }

    // Integrate lexical results
    for (const lr of lexicalResults) {
      if (options.language && lr.chunk.language.toLowerCase() !== options.language.toLowerCase()) {
        continue;
      }
      const cand = getOrCreateCandidate(lr.chunk);
      // Normalize BM25 score approximately
      const normLex = Math.min(1.0, lr.score / 5.0);
      cand.lexicalScore = Math.max(cand.lexicalScore, normLex);
      cand.signals.push(`Lexical match: ${lr.matchedTerms.slice(0, 3).join(', ')}`);

      if (lr.exactSymbolMatch) {
        cand.symbolScore = 1.0;
        cand.signals.push(`Direct symbol match (${lr.chunk.symbolName})`);
      }
    }

    // 4. Structural AST Integration (Python only when available)
    const hasPythonAST = Boolean(
      this.structuralIndex && 
      this.structuralIndex.getStats().pythonAnalysisAvailable !== false && 
      this.structuralIndex.getStats().filesAnalyzed > 0
    );

    if (hasPythonAST && this.structuralIndex) {
      for (const cand of candidateMap.values()) {
        const chunk = cand.chunk;
        if (chunk.language.toLowerCase() === 'python' && chunk.symbolName) {
          // Check if symbol exists in AST
          const fnDef = this.structuralIndex.findFunctionDefinition(chunk.symbolName);
          const clsDef = !fnDef ? this.structuralIndex.findClassDefinition(chunk.symbolName) : null;

          if (fnDef || clsDef) {
            cand.structuralScore = 0.8;
            cand.signals.push('Verified AST definition');

            // Find callers
            const callers = this.structuralIndex.findCallers(chunk.symbolName);
            if (callers.length > 0) {
              const callerNames = callers.map(c => `${c.caller} (line ${c.line})`).slice(0, 3);
              cand.astRelations?.push(`Callers: ${callerNames.join('; ')}`);
              cand.evidence.push(`Referenced by callers: ${callerNames.join(', ')}`);
            }

            // Find callees
            const callees = this.structuralIndex.findCallees(chunk.symbolName);
            if (callees.length > 0) {
              const calleeNames = callees.map(c => `${c.callee} (line ${c.line})`).slice(0, 3);
              cand.astRelations?.push(`Callees: ${calleeNames.join('; ')}`);
              cand.evidence.push(`Calls downstream: ${calleeNames.join(', ')}`);
            }

            // Parameters
            if (fnDef && fnDef.parameters.length > 0) {
              cand.evidence.push(`Parameters: (${fnDef.parameters.join(', ')})`);
            }
          }
        }
      }
    }

    // Path name matching across all candidates
    for (const cand of candidateMap.values()) {
      const chunk = cand.chunk;
      if (chunk.filePath.toLowerCase().includes(queryLower)) {
        cand.pathScore = 0.5;
        cand.signals.push(`Path contains "${queryLower}"`);
      }
    }

    // 5. Unified Scoring & Ranking
    const wSem = hasPythonAST ? (options.semanticWeight ?? 0.45) : (options.semanticWeight ?? 0.55);
    const wLex = hasPythonAST ? (options.lexicalWeight ?? 0.25) : (options.lexicalWeight ?? 0.35);
    const wStruct = hasPythonAST ? (options.structuralWeight ?? 0.20) : 0;
    const wSym = 0.10;

    const findings: RetrievalFinding[] = [];

    for (const cand of candidateMap.values()) {
      const chunk = cand.chunk;
      const effectiveStructScore = hasPythonAST ? cand.structuralScore : 0;
      const totalScore = 
        (cand.semanticScore * wSem) +
        (cand.lexicalScore * wLex) +
        (effectiveStructScore * wStruct) +
        (cand.symbolScore * wSym) +
        (cand.pathScore * 0.1);

      if (totalScore < 0.15) continue;

      // Determine transparent match type and composite signals
      const isSemantic = cand.semanticScore > 0.25;
      const isLexical = cand.lexicalScore > 0.25;
      const isStructural = hasPythonAST && cand.structuralScore > 0.3;

      let matchType: 'semantic' | 'lexical' | 'structural' | 'hybrid' | 'symbol' = 'lexical';
      if ((isSemantic && isLexical) || (isSemantic && isStructural) || (isLexical && isStructural)) {
        matchType = 'hybrid';
      } else if (isSemantic) {
        matchType = 'semantic';
      } else if (isStructural) {
        matchType = 'structural';
      } else if (cand.symbolScore > 0) {
        matchType = 'symbol';
      } else {
        matchType = 'lexical';
      }

      const reasonParts: string[] = [];
      if (isSemantic) reasonParts.push(`semantic similarity (${(cand.semanticScore * 100).toFixed(0)}%)`);
      if (isLexical) reasonParts.push(`lexical matching (${(cand.lexicalScore * 100).toFixed(0)}%)`);
      if (isStructural) reasonParts.push(`AST structural relationships`);
      if (cand.symbolScore > 0) reasonParts.push(`direct symbol match`);
      if (cand.pathScore > 0) reasonParts.push(`path correlation`);

      const retrievalReason = `${matchType.charAt(0).toUpperCase() + matchType.slice(1)}: ${reasonParts.join(' + ') || 'Relevance matching'}`;

      // Build readable score breakdown string
      const scoreParts: string[] = [];
      scoreParts.push(`Semantic=${(cand.semanticScore * 100).toFixed(0)}%`);
      scoreParts.push(`Lexical=${(cand.lexicalScore * 100).toFixed(0)}%`);
      if (hasPythonAST && cand.structuralScore > 0) {
        scoreParts.push(`Structural=${(cand.structuralScore * 100).toFixed(0)}%`);
      }
      if (cand.pathScore > 0) {
        scoreParts.push(`Path=${(cand.pathScore * 100).toFixed(0)}%`);
      }

      // Format transparent whyThisResult
      const whyThisResult: WhyThisResult = {
        primaryReason: `${matchType.charAt(0).toUpperCase() + matchType.slice(1)} match: Located ${chunk.symbolType} "${chunk.symbolName}" in ${chunk.filePath} (lines ${chunk.startLine}–${chunk.endLine}) via ${reasonParts.join(' and ')}.`,
        breakdown: `Scored ${(totalScore * 100).toFixed(0)}% composite relevance: ${scoreParts.join(', ')}.`,
        signals: cand.signals,
        semanticConfidence: cand.semanticScore,
        symbolContext: chunk.parentClass ? `Member of ${chunk.parentClass}` : undefined,
        astRelations: cand.astRelations && cand.astRelations.length > 0 ? cand.astRelations : undefined,
        scoreBreakdown: {
          semantic: cand.semanticScore,
          lexical: cand.lexicalScore,
          structural: effectiveStructScore
        }
      };

      const finalEvidence = [
        `File: ${chunk.filePath} (lines ${chunk.startLine}–${chunk.endLine})`,
        `Language: ${chunk.language}`,
        `Symbol: ${chunk.symbolType} ${chunk.symbolName}`,
        ...cand.evidence
      ];

      findings.push({
        id: `finding_${chunk.id}_${Date.now()}`,
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        language: chunk.language,
        symbolName: chunk.symbolName,
        symbolType: chunk.symbolType,
        relevantSource: chunk.sourceText,
        retrievalReason,
        relevanceScore: totalScore,
        confidenceScore: totalScore,
        matchType,
        hybridScore: {
          semanticScore: cand.semanticScore,
          lexicalScore: cand.lexicalScore,
          structuralBoost: effectiveStructScore,
          finalScore: totalScore
        },
        evidence: finalEvidence,
        whyThisResult,
        location: {
          filePath: chunk.filePath,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          functionName: chunk.symbolType === 'function' || chunk.symbolType === 'method' ? chunk.symbolName : undefined,
          className: chunk.symbolType === 'class' ? chunk.symbolName : chunk.parentClass
        },
        codeSnippet: {
          id: `snip_${chunk.id}`,
          location: {
            filePath: chunk.filePath,
            startLine: chunk.startLine,
            endLine: chunk.endLine
          },
          content: chunk.sourceText,
          language: chunk.language.toLowerCase()
        }
      });
    }

    // Sort descending by score
    findings.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return findings.slice(0, topK);
  }
}
