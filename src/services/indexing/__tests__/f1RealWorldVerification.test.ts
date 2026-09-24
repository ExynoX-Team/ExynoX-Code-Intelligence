import { describe, it, expect, beforeAll } from 'vitest';
import { loadF1SampleRepository } from '../../repository/f1SampleRepository.js';
import { routeStructuralQuery } from '../../structural/queryRouter.js';
import type { RepositoryWorkspace } from '../../repository/repositoryWorkspace.js';
import type { RetrievalFinding } from '../../../types/retrieval.js';

describe('PHASE 3 — REAL-WORLD RETRIEVAL VERIFICATION (F1 Lap Predictor)', () => {
  let workspace: RepositoryWorkspace;

  beforeAll(async () => {
    workspace = await loadF1SampleRepository();
  }, 30000);

  it('verifies repository indexing metrics for F1 Lap Predictor', () => {
    const stats = workspace.getRepositoryWideStats();
    expect(stats).toBeDefined();
    expect(stats?.totalFiles).toBeGreaterThanOrEqual(10);
    expect(stats?.totalPythonFiles).toBe(9);
    expect(workspace.repositoryIndex.chunks.length).toBeGreaterThan(10);
    expect(workspace.repositoryIndex.lexicalIndex.getDocumentCount()).toBe(workspace.repositoryIndex.chunks.length);
  });

  const runHybridSearch = async (query: string, topK = 5): Promise<RetrievalFinding[]> => {
    return workspace.repositoryIndex.search(query, { topK });
  };

  const printResults = (results: RetrievalFinding[]) => {
    results.forEach((r, idx) => {
      console.log(`Rank #${idx + 1}: ${r.filePath} [Lines ${r.startLine}-${r.endLine}] (Score: ${r.relevanceScore.toFixed(4)}, Type: ${r.matchType})`);
      if (r.hybridScore) {
        console.log(`   Signals: Lexical=${r.hybridScore.lexicalScore.toFixed(3)}, Semantic=${r.hybridScore.semanticScore.toFixed(3)}, Structural=${r.hybridScore.structuralBoost.toFixed(3)}, Final=${r.hybridScore.finalScore.toFixed(3)}`);
      }
      if (r.whyThisResult) {
        console.log(`   Signals Listed: ${r.whyThisResult.signals.join(', ')}`);
        console.log(`   Breakdown: ${r.whyThisResult.breakdown}`);
      }
      console.log(`   Snippet:\n${r.relevantSource.split('\n').slice(0, 4).map(l => '     ' + l).join('\n')}\n`);
    });
  };

  it('Query 1: Where is the prediction model used?', async () => {
    const query = 'Where is the prediction model used?';
    const results = await runHybridSearch(query, 5);
    console.log(`\n=== QUERY 1: "${query}" ===`);
    printResults(results);

    expect(results.length).toBeGreaterThan(0);
    const topFiles = results.map(r => r.filePath);
    expect(topFiles.some(f => f.includes('predict.py') || f.includes('predictor.py'))).toBe(true);
  });

  it('Query 2: How does the application calculate lap-time degradation?', async () => {
    const query = 'How does the application calculate lap-time degradation?';
    const results = await runHybridSearch(query, 5);
    console.log(`\n=== QUERY 2: "${query}" ===`);
    printResults(results);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].filePath).toBe('models/degradation.py');
    expect(results[0].relevantSource).toContain('calculate_lap_time_degradation');
  });

  it('Query 3: Where is the dataset loaded?', async () => {
    const query = 'Where is the dataset loaded?';
    const results = await runHybridSearch(query, 5);
    console.log(`\n=== QUERY 3: "${query}" ===`);
    printResults(results);

    expect(results.length).toBeGreaterThan(0);
    const topFiles = results.map(r => r.filePath);
    expect(topFiles.some(f => f.includes('data/loader.py'))).toBe(true);
  });

  it('Query 4: Which functions handle data preprocessing?', async () => {
    const query = 'Which functions handle data preprocessing?';
    const results = await runHybridSearch(query, 5);
    console.log(`\n=== QUERY 4: "${query}" ===`);
    printResults(results);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].filePath).toBe('data/preprocessing.py');
  });

  it('Query 5 & 6: How many drivers does it have? & Where are the drivers defined?', async () => {
    const q5 = 'How many drivers does it have?';
    const structuralRes5 = routeStructuralQuery(q5, workspace.structuralIndex, workspace);
    console.log(`\n=== QUERY 5: "${q5}" (Structural Router) ===`);
    console.log(`Handled: ${structuralRes5.handled}`);
    console.log(`QueryType: ${structuralRes5.queryResult?.queryType}`);
    console.log(`Target: ${structuralRes5.queryResult?.targetSymbol}`);
    console.log(`Count: ${structuralRes5.queryResult?.matchedItemsCount}`);
    console.log(`Explanation: ${structuralRes5.queryResult?.explanation}`);

    const q6 = 'Where are the drivers defined?';
    const structuralRes6 = routeStructuralQuery(q6, workspace.structuralIndex, workspace);
    console.log(`\n=== QUERY 6: "${q6}" (Structural Router) ===`);
    console.log(`Handled: ${structuralRes6.handled}`);
    console.log(`QueryType: ${structuralRes6.queryResult?.queryType}`);
    console.log(`Target: ${structuralRes6.queryResult?.targetSymbol}`);
    console.log(`Explanation: ${structuralRes6.queryResult?.explanation}`);

    const hybridRes6 = await runHybridSearch(q6, 5);
    console.log(`\n=== QUERY 6: "${q6}" (Hybrid Retriever) ===`);
    printResults(hybridRes6);

    expect(structuralRes5.handled).toBe(true);
    expect(structuralRes5.queryResult?.matchedItemsCount).toBe(10);
    expect(structuralRes5.queryResult?.explanation).toContain('10 drivers');
    expect(structuralRes5.findings.length).toBeGreaterThanOrEqual(1);
    expect(structuralRes5.findings[0].location.filePath).toBe('models/driver.py');
    expect(structuralRes5.findings[0].location.startLine).toBe(22);
    expect(structuralRes5.findings[0].location.endLine).toBe(33);

    expect(structuralRes6.handled).toBe(true);
    expect(structuralRes6.queryResult?.matchedItemsCount).toBeGreaterThanOrEqual(1);
    expect(hybridRes6[0].filePath).toBe('models/driver.py');
  });

  it('CONTROLLED SEMANTIC TEST: Query A vs Query B', async () => {
    const queryA = 'Where is authentication handled?';
    const queryB = 'Where does the application log users in?';

    const resultsA = await runHybridSearch(queryA, 5);
    const resultsB = await runHybridSearch(queryB, 5);

    console.log(`\n=== CONTROLLED SEMANTIC TEST ===`);
    console.log(`\n--- Query A: "${queryA}" ---`);
    printResults(resultsA);

    console.log(`\n--- Query B: "${queryB}" ---`);
    printResults(resultsB);

    expect(resultsA.length).toBeGreaterThan(0);
    expect(resultsB.length).toBeGreaterThan(0);
  });
});
