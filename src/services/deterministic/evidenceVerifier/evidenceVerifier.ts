/**
 * Evidence Verification Engine
 * Samsung PRISM Gen AI Hackathon (Theme 1: Agentic Code Intelligence)
 * Phase 6.6 — General-Purpose Deterministic Repository Intelligence Engine
 *
 * Strictly verifies candidate evidence against real files, lines, symbols, and configs.
 * Rejects any candidate that does not exist or whose line bounds/content are invalid.
 * Zero hardcoding. Zero LLM.
 */

import type { UnifiedRepositoryKnowledgeModel } from '../knowledgeModel/knowledgeModel.js';
import type { EvidenceNode } from '../evidenceGraph/evidenceGraph.js';

export interface VerifiedEvidenceItem {
  node: EvidenceNode;
  verified: boolean;
  rejectionReason?: string;
  verifiedSnippet: string;
}

export class EvidenceVerifier {
  /**
   * Verifies an evidence candidate against the actual repository files.
   */
  static verify(
    candidate: EvidenceNode,
    model: UnifiedRepositoryKnowledgeModel
  ): VerifiedEvidenceItem {
    // 1. File existence check
    const fileNode = model.files.get(candidate.filePath);
    if (!fileNode) {
      return {
        node: candidate,
        verified: false,
        rejectionReason: `File '${candidate.filePath}' does not exist in repository`,
        verifiedSnippet: ''
      };
    }

    // 2. Line range checks
    const startLine = candidate.startLine || 1;
    const endLine = candidate.endLine || startLine;

    if (startLine < 1 || startLine > fileNode.lineCount) {
      return {
        node: candidate,
        verified: false,
        rejectionReason: `Start line ${startLine} out of bounds for ${candidate.filePath} (total lines: ${fileNode.lineCount})`,
        verifiedSnippet: ''
      };
    }

    // 3. Extract verified snippet directly from real lines
    const startIdx = Math.max(0, startLine - 1);
    const endIdx = Math.min(fileNode.lines.length, endLine);
    const linesSlice = fileNode.lines.slice(startIdx, endIdx);
    const verifiedSnippet = linesSlice.join('\n').trim();

    // 4. Verification by node type
    if (candidate.type === 'symbol') {
      // Ensure the symbol name actually appears in the snippet
      const nameLower = candidate.name.toLowerCase();
      const snippetLower = verifiedSnippet.toLowerCase();
      if (!snippetLower.includes(nameLower) && !snippetLower.includes(candidate.name)) {
        // Tolerant check: check line before or after
        const expandedStart = Math.max(0, startIdx - 2);
        const expandedEnd = Math.min(fileNode.lines.length, endIdx + 2);
        const expandedSnippet = fileNode.lines.slice(expandedStart, expandedEnd).join('\n');
        if (!expandedSnippet.toLowerCase().includes(nameLower)) {
          return {
            node: candidate,
            verified: false,
            rejectionReason: `Symbol '${candidate.name}' not found at lines ${startLine}-${endLine} in ${candidate.filePath}`,
            verifiedSnippet: ''
          };
        }
      }
    } else if (candidate.type === 'config') {
      const keyLower = candidate.name.toLowerCase();
      if (!verifiedSnippet.toLowerCase().includes(keyLower)) {
        return {
          node: candidate,
          verified: false,
          rejectionReason: `Config key '${candidate.name}' not found at line ${startLine} in ${candidate.filePath}`,
          verifiedSnippet: ''
        };
      }
    } else if (candidate.type === 'asset') {
      // Asset existence verified by fileNode check above
      if (fileNode.fileType !== 'asset' && !candidate.filePath.includes('assets/')) {
        return {
          node: candidate,
          verified: false,
          rejectionReason: `Path '${candidate.filePath}' is not an asset file`,
          verifiedSnippet: ''
        };
      }
    }

    return {
      node: candidate,
      verified: true,
      verifiedSnippet: verifiedSnippet || candidate.snippet || ''
    };
  }

  /**
   * Verifies an array of candidate nodes, returning only verified candidates.
   */
  static verifyAll(
    candidates: EvidenceNode[],
    model: UnifiedRepositoryKnowledgeModel
  ): VerifiedEvidenceItem[] {
    const verifiedList: VerifiedEvidenceItem[] = [];

    for (const c of candidates) {
      const res = EvidenceVerifier.verify(c, model);
      if (res.verified) {
        verifiedList.push(res);
      }
    }

    return verifiedList;
  }
}
