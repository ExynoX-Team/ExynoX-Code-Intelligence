/**
 * ExynoX Code Intelligence — Evidence Grounding Verification
 * Samsung PRISM Gen AI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 *
 * Grounding Rule:
 * For every answer, verify that all cited files and lines physically exist in the workspace,
 * and no fabricated evidence was introduced.
 * The LLM's prose is never the source of truth; repository files are authoritative.
 */

import type { GroundingEvaluation, BenchmarkEvidenceRange } from '../types.js';
import type { RepositoryWorkspace } from '../../services/repository/repositoryWorkspace.js';

export interface EvaluatedEvidenceItem {
  filePath: string;
  startLine: number;
  endLine: number;
  content?: string;
}

export function evaluateEvidenceGrounding(
  evidenceList: EvaluatedEvidenceItem[],
  workspace?: RepositoryWorkspace | null,
  expectedEvidence?: BenchmarkEvidenceRange[]
): GroundingEvaluation {
  const unsupportedClaims: string[] = [];
  const fabricatedEvidence: string[] = [];
  const missingEvidence: string[] = [];

  if (!evidenceList || evidenceList.length === 0) {
    if (expectedEvidence && expectedEvidence.length > 0) {
      for (const exp of expectedEvidence) {
        missingEvidence.push(`Missing expected evidence from ${exp.file}:${exp.startLine || 1}`);
      }
    }
    return {
      isGrounded: false,
      allCitationsValid: false,
      unsupportedClaims: ['No evidence provided for answer'],
      fabricatedEvidence: [],
      missingEvidence,
      evidenceCount: 0
    };
  }

  let allCitationsValid = true;

  for (const item of evidenceList) {
    if (!item.filePath) {
      fabricatedEvidence.push('Evidence item missing file path');
      allCitationsValid = false;
      continue;
    }

    if (workspace) {
      const file = workspace.files.get(item.filePath);
      if (!file) {
        fabricatedEvidence.push(`Cited file '${item.filePath}' does not exist in repository`);
        allCitationsValid = false;
        continue;
      }

      // Verify line boundaries exist
      const lineCount = file.lines?.length || 0;
      if (item.startLine < 1 || item.startLine > lineCount) {
        unsupportedClaims.push(
          `Cited line start ${item.startLine} exceeds file boundary (total lines: ${lineCount}) in ${item.filePath}`
        );
        allCitationsValid = false;
      }
      if (item.endLine < item.startLine || item.endLine > lineCount) {
        unsupportedClaims.push(
          `Cited line end ${item.endLine} is invalid for ${item.filePath} (1–${lineCount})`
        );
        allCitationsValid = false;
      }

      // Verify snippet content actually matches file lines if content is present
      if (item.content && file.lines && item.startLine <= lineCount) {
        const actualSnippetLines = file.lines.slice(item.startLine - 1, Math.min(lineCount, item.endLine));
        const actualContent = actualSnippetLines.join('\n');
        // Simple sanity check: content should share non-whitespace tokens with actual lines
        const strippedItem = item.content.replace(/\s+/g, '');
        const strippedActual = actualContent.replace(/\s+/g, '');
        if (strippedItem.length > 20 && !strippedActual.includes(strippedItem.slice(0, 20)) && !strippedItem.includes(strippedActual.slice(0, 20))) {
          unsupportedClaims.push(
            `Snippet content at ${item.filePath}:${item.startLine}-${item.endLine} diverges from actual repository text`
          );
          allCitationsValid = false;
        }
      }
    }
  }

  // Check for missing expected evidence items
  if (expectedEvidence && expectedEvidence.length > 0) {
    for (const exp of expectedEvidence) {
      const found = evidenceList.some(e => 
        e.filePath === exp.file || e.filePath.endsWith('/' + exp.file)
      );
      if (!found) {
        missingEvidence.push(`Expected evidence in ${exp.file} was not retrieved`);
      }
    }
  }

  const isGrounded = allCitationsValid && fabricatedEvidence.length === 0;

  return {
    isGrounded,
    allCitationsValid,
    unsupportedClaims,
    fabricatedEvidence,
    missingEvidence,
    evidenceCount: evidenceList.length
  };
}
