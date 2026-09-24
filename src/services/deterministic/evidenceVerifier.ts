/**
 * Evidence Verification & Negative Evidence Engine
 * Verifies code locations, file existence, and produces verified negative responses
 * Samsung PRISM Gen AI Hackathon (Theme 1: Agentic Code Intelligence)
 * Phase 6.5 — General Deterministic Query Intelligence Hardening
 */

import type { RepositoryWorkspace } from '../repository/repositoryWorkspace.js';
import type { 
  VerifiedEvidenceItem, 
  DeterministicEvidenceType, 
  QueryIntentCategory 
} from './types.js';

export interface VerificationCandidate {
  filePath: string;
  startLine: number;
  endLine: number;
  evidenceType: DeterministicEvidenceType;
  confidenceScore: number;
  primaryReason: string;
  evidenceSignals: string[];
  symbolName?: string;
  symbolType?: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'asset' | 'config' | 'test' | 'file';
  customContent?: string;
}

/**
 * Verifies a list of candidate findings against actual repository files and line numbers.
 * Filters out nonexistent files or out-of-bound line ranges.
 */
export function verifyEvidenceCandidates(
  candidates: VerificationCandidate[],
  workspace: RepositoryWorkspace
): VerifiedEvidenceItem[] {
  const verified: VerifiedEvidenceItem[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const file = workspace.files.get(cand.filePath);
    if (!file) {
      // File does not physically exist in workspace — reject
      continue;
    }

    const lineCount = file.lines.length;
    let startLine = Math.max(1, cand.startLine);
    let endLine = Math.min(lineCount > 0 ? lineCount : 1, Math.max(startLine, cand.endLine));

    // For asset files or binary files with 0 lines, set 1-1
    if (lineCount === 0) {
      startLine = 1;
      endLine = 1;
    }

    let snippet = cand.customContent;
    if (!snippet) {
      if (lineCount > 0) {
        snippet = workspace.getFileLines(cand.filePath, startLine, endLine) || file.lines[startLine - 1] || '';
      } else {
        snippet = `[Resource File: ${cand.filePath}] (Size: ${file.size} bytes)`;
      }
    }

    verified.push({
      id: `verified_${cand.filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${startLine}_${i}`,
      filePath: cand.filePath,
      startLine,
      endLine,
      content: snippet,
      language: file.language || 'text',
      evidenceType: cand.evidenceType,
      confidenceScore: Math.min(1.0, Math.max(0.1, cand.confidenceScore)),
      primaryReason: cand.primaryReason,
      evidenceSignals: cand.evidenceSignals,
      symbolName: cand.symbolName,
      symbolType: cand.symbolType
    });
  }

  return verified;
}

/**
 * Constructs a verified negative answer when an entity is genuinely absent from the repository.
 * (e.g. "Where is Redis configured?" when Redis does not exist).
 */
export function constructNegativeAnswer(
  entity: string,
  intent: QueryIntentCategory,
  searchedTerms: string[]
): string {
  const clean = entity.trim();
  switch (intent) {
    case 'configuration':
      return `No verified ${clean} configuration was found in this repository. Checked configuration files, environment variables, and module settings for: ${searchedTerms.slice(0, 4).join(', ')}.`;
    
    case 'asset_resource':
      return `No verified asset matching '${clean}' was found in this repository. Checked static assets, public directories, and image references.`;
    
    case 'definition':
      return `No definition for '${clean}' was found in the indexed repository files.`;
    
    case 'testing':
      return `No test files or test suites covering '${clean}' were found in this repository.`;
      
    case 'caller_callee':
      return `No callers or invocations of '${clean}' were found in the indexed codebase.`;
      
    case 'import_dependency':
      return `No imports or dependencies matching '${clean}' were found in this repository.`;
      
    default:
      return `No verified evidence for '${clean}' was found in the repository.`;
  }
}
