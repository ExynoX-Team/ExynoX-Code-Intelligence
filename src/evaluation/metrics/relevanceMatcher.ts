/**
 * ExynoX Code Intelligence — Relevance Matcher
 * Samsung PRISM Gen AI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 *
 * Deterministically compares retrieved code findings against explicit ground truth.
 * Supports:
 *   1. Exact file + line-range overlap
 *   2. File + symbol name match
 *   3. Exact symbol name match
 *
 * Negative constraint:
 * Unrelated textual similarity is never sufficient for ground truth relevance.
 */

import type { BenchmarkEvidenceRange, RelevanceMatchResult } from '../types.js';

function normalizeFilePath(path: string): string {
  if (!path) return '';
  return path.replace(/^[./\\]+/, '').replace(/\\/g, '/').toLowerCase();
}

/**
 * Checks if two line ranges [startA, endA] and [startB, endB] overlap.
 */
function lineRangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): { overlaps: boolean; start: number; end: number } {
  const overlapStart = Math.max(startA, startB);
  const overlapEnd = Math.min(endA, endB);
  const overlaps = overlapStart <= overlapEnd;
  return { overlaps, start: overlapStart, end: overlapEnd };
}

/**
 * Matches a single retrieved code evidence item against a list of expected ground-truth evidence ranges and symbols.
 */
export function matchRetrievedEvidence(
  retrieved: {
    filePath: string;
    startLine: number;
    endLine: number;
    symbolName?: string;
  },
  expectedEvidence?: BenchmarkEvidenceRange[],
  expectedSymbols?: string[]
): RelevanceMatchResult {
  const retNormPath = normalizeFilePath(retrieved.filePath);
  const retSymbol = retrieved.symbolName?.trim();

  // If no ground truth is provided at all
  if ((!expectedEvidence || expectedEvidence.length === 0) && (!expectedSymbols || expectedSymbols.length === 0)) {
    return {
      isRelevant: false,
      matchType: 'none',
      explanation: 'No ground truth provided for this query'
    };
  }

  // 1. Check expected evidence items (file + line overlap / symbol)
  if (expectedEvidence && expectedEvidence.length > 0) {
    for (const exp of expectedEvidence) {
      const expNormPath = normalizeFilePath(exp.file);
      const filesMatch = retNormPath === expNormPath || retNormPath.endsWith('/' + expNormPath) || expNormPath.endsWith('/' + retNormPath);

      if (filesMatch) {
        // Check line overlap if lines are specified in ground truth
        if (typeof exp.startLine === 'number' && typeof exp.endLine === 'number') {
          const overlap = lineRangesOverlap(retrieved.startLine, retrieved.endLine, exp.startLine, exp.endLine);
          if (overlap.overlaps) {
            const isExact = retrieved.startLine === exp.startLine && retrieved.endLine === exp.endLine;
            return {
              isRelevant: true,
              matchType: isExact ? 'exact_file_line' : 'line_overlap',
              matchedExpectedEvidence: exp,
              overlapLines: { start: overlap.start, end: overlap.end },
              explanation: isExact 
                ? `Exact file and line match: ${exp.file} [lines ${exp.startLine}–${exp.endLine}]`
                : `Line range overlap [${overlap.start}–${overlap.end}] in ${exp.file} (retrieved ${retrieved.startLine}–${retrieved.endLine}, expected ${exp.startLine}–${exp.endLine})`
            };
          }
        }

        // Check symbol match within the same file
        if (exp.symbol && retSymbol && (exp.symbol.toLowerCase() === retSymbol.toLowerCase() || retSymbol.toLowerCase().endsWith('.' + exp.symbol.toLowerCase()))) {
          return {
            isRelevant: true,
            matchType: 'file_symbol',
            matchedExpectedEvidence: exp,
            matchedSymbol: retSymbol,
            explanation: `File and symbol match in ${exp.file}: symbol '${retSymbol}' matches expected '${exp.symbol}'`
          };
        }

        // If expected evidence specified only the file without lines or symbol, file match is relevant
        if (exp.startLine === undefined && exp.endLine === undefined && !exp.symbol) {
          return {
            isRelevant: true,
            matchType: 'exact_file_line',
            matchedExpectedEvidence: exp,
            explanation: `Target file match: ${exp.file}`
          };
        }
      }
    }
  }

  // 2. Check explicit expected symbols
  if (expectedSymbols && expectedSymbols.length > 0 && retSymbol) {
    for (const expSym of expectedSymbols) {
      const expLower = expSym.toLowerCase();
      const retLower = retSymbol.toLowerCase();
      if (retLower === expLower || retLower.endsWith('.' + expLower) || expLower.endsWith('.' + retLower)) {
        return {
          isRelevant: true,
          matchType: 'exact_symbol',
          matchedSymbol: expSym,
          explanation: `Symbol name match: retrieved '${retSymbol}' matches expected '${expSym}'`
        };
      }
    }
  }

  return {
    isRelevant: false,
    matchType: 'none',
    explanation: `Retrieved ${retrieved.filePath}:${retrieved.startLine}-${retrieved.endLine} does not overlap with expected ground truth`
  };
}
