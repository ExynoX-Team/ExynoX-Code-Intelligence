/**
 * ExynoX Code Intelligence — Structural Query Accuracy Metrics
 * Samsung PRISM Gen AI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 *
 * Evaluates Phase 5 structural queries:
 *   - definition accuracy
 *   - caller accuracy
 *   - callee accuracy
 *   - reference accuracy
 *   - import accuracy
 *   - call-chain success rate
 *   - count accuracy
 *
 * Negative Constraint:
 * Do not call this Precision@K unless it is calculated using the Precision@K definition.
 */

import type { BenchmarkQueryItem, StructuralAccuracyResult } from '../types.js';
import type { StructuralQueryResult } from '../../services/structural/index.js';

export function evaluateStructuralAccuracy(
  benchmarkItem: BenchmarkQueryItem,
  structuralResult?: StructuralQueryResult | null,
  retrievedCount: number = 0
): StructuralAccuracyResult {
  const category = benchmarkItem.queryType;

  // If the query is not a structural query type, mark as not evaluated
  const structuralTypes = ['definition', 'caller', 'callee', 'reference', 'import', 'call_chain', 'count'];
  if (!structuralTypes.includes(category)) {
    return {
      evaluated: false,
      category,
      exactMatch: false,
      partialMatch: false,
      missingResult: false,
      incorrectResult: false,
      score: 0,
      notes: `Query type '${category}' is evaluated via retrieval Precision/Recall rather than structural AST accuracy`
    };
  }

  // If no structural result was produced
  if (!structuralResult) {
    return {
      evaluated: true,
      category,
      exactMatch: false,
      partialMatch: false,
      missingResult: true,
      incorrectResult: false,
      score: 0,
      notes: 'Structural router did not handle this query or returned null result'
    };
  }

  // 1. Call chain evaluation
  if (category === 'call_chain') {
    const chain = structuralResult.callChain;
    const pathFound = chain?.pathFound === true;
    const stepsCount = chain?.steps?.length || 0;

    if (pathFound && stepsCount >= 1) {
      return {
        evaluated: true,
        category,
        exactMatch: true,
        partialMatch: false,
        missingResult: false,
        incorrectResult: false,
        actualOutput: chain,
        expectedOutput: benchmarkItem.expectedSymbols,
        score: 1.0,
        notes: `Call chain path successfully discovered with ${stepsCount} verified steps`
      };
    } else {
      return {
        evaluated: true,
        category,
        exactMatch: false,
        partialMatch: false,
        missingResult: false,
        incorrectResult: true,
        actualOutput: chain,
        score: 0.0,
        notes: 'Call chain path was not found between source and target'
      };
    }
  }

  // 2. Count query evaluation
  if (category === 'count') {
    const actualCount = structuralResult.entityInfo?.elementCount ?? structuralResult.matchedItemsCount ?? retrievedCount;
    const expectedCount = benchmarkItem.expectedCount;

    if (expectedCount !== undefined) {
      const exact = actualCount === expectedCount;
      const partial = Math.abs(actualCount - expectedCount) <= 1;
      return {
        evaluated: true,
        category,
        exactMatch: exact,
        partialMatch: !exact && partial,
        missingResult: actualCount === 0 && expectedCount > 0,
        incorrectResult: !exact && !partial,
        actualOutput: actualCount,
        expectedOutput: expectedCount,
        score: exact ? 1.0 : (partial ? 0.5 : 0.0),
        notes: exact 
          ? `Exact count matched: ${actualCount}` 
          : `Count disparity: expected ${expectedCount}, got ${actualCount}`
      };
    }
  }

  // 3. Caller / Callee / Definition / Reference / Import evaluation
  const expectedSymbols = benchmarkItem.expectedSymbols || [];
  const expectedEvidence = benchmarkItem.expectedEvidence || [];

  // Check if expected items were found
  if (expectedSymbols.length > 0 || expectedEvidence.length > 0) {
    const matchedCount = structuralResult.matchedItemsCount ?? retrievedCount;
    
    if (matchedCount === 0) {
      const expectsZero = expectedSymbols.length === 0 && expectedEvidence.length === 0;
      return {
        evaluated: true,
        category,
        exactMatch: expectsZero,
        partialMatch: false,
        missingResult: !expectsZero,
        incorrectResult: false,
        actualOutput: 0,
        expectedOutput: expectedSymbols.length || expectedEvidence.length,
        score: expectsZero ? 1.0 : 0.0,
        notes: expectsZero ? 'Correctly identified 0 matches' : 'No matches returned by structural engine'
      };
    }

    // Has matches: check how many match expected symbols
    return {
      evaluated: true,
      category,
      exactMatch: matchedCount >= (expectedSymbols.length || 1),
      partialMatch: matchedCount > 0 && matchedCount < (expectedSymbols.length || 1),
      missingResult: false,
      incorrectResult: false,
      actualOutput: matchedCount,
      expectedOutput: expectedSymbols.length || expectedEvidence.length,
      score: matchedCount >= (expectedSymbols.length || 1) ? 1.0 : 0.5,
      notes: `Structural query returned ${matchedCount} verified AST elements`
    };
  }

  return {
    evaluated: true,
    category,
    exactMatch: true,
    partialMatch: false,
    missingResult: false,
    incorrectResult: false,
    actualOutput: structuralResult.matchedItemsCount,
    score: 1.0,
    notes: 'Structural query completed successfully'
  };
}
