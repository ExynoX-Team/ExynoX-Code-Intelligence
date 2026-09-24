import { describe, it, expect, beforeAll } from 'vitest';
import { loadF1SampleRepository } from '../../repository/f1SampleRepository.js';
import { routeStructuralQuery } from '../queryRouter.js';
import type { RepositoryWorkspace } from '../../repository/repositoryWorkspace.js';

describe('Count and Quantity Query Disambiguation Suite', () => {
  let workspace: RepositoryWorkspace;

  beforeAll(async () => {
    workspace = await loadF1SampleRepository();
  });

  describe('1. Class Count Queries', () => {
    it('accurately counts specific class definitions without confusing with entity instances', () => {
      const result = routeStructuralQuery(
        'How many Driver classes are there?',
        workspace.structuralIndex,
        workspace
      );

      expect(result.handled).toBe(true);
      expect(result.queryResult?.matchedItemsCount).toBe(1);
      expect(result.queryResult?.entityInfo?.countType).toBe('class_count');
      expect(result.queryResult?.entityInfo?.className).toBe('Driver');
      expect(result.queryResult?.explanation).toContain('1 class matching');
      expect(result.findings.length).toBe(1);
      expect(result.findings[0].location.filePath).toBe('models/driver.py');
      expect(result.findings[0].location.startLine).toBe(9);
      expect(result.findings[0].location.endLine).toBe(19);
    });

    it('accurately counts total repository classes', () => {
      const result = routeStructuralQuery(
        'How many classes does it have?',
        workspace.structuralIndex,
        workspace
      );

      expect(result.handled).toBe(true);
      expect(result.queryResult?.matchedItemsCount).toBe(4);
      expect(result.queryResult?.explanation).toContain('4 Python classes');
    });
  });

  describe('2. Entity & Roster Count Queries', () => {
    it('accurately resolves "How many drivers does it have?" to 10 entities in F1_DRIVERS', () => {
      const result = routeStructuralQuery(
        'How many drivers does it have?',
        workspace.structuralIndex,
        workspace
      );

      expect(result.handled).toBe(true);
      expect(result.queryResult?.matchedItemsCount).toBe(10);
      expect(result.queryResult?.explanation).toContain('10 drivers');
      expect(result.queryResult?.entityInfo?.countType).toBe('entity_roster');
      expect(result.queryResult?.entityInfo?.collectionVariable).toBe('F1_DRIVERS');
      expect(result.queryResult?.entityInfo?.elementCount).toBe(10);
      expect(result.queryResult?.entityInfo?.reliable).toBe(true);

      expect(result.findings.length).toBe(1);
      const finding = result.findings[0];
      expect(finding.location.filePath).toBe('models/driver.py');
      expect(finding.location.startLine).toBe(22);
      expect(finding.location.endLine).toBe(33);
      expect(finding.codeSnippet?.content).toContain('F1_DRIVERS');
      expect(finding.codeSnippet?.content).toContain('VER');
      expect(finding.codeSnippet?.content).toContain('HAM');
    });

    it('resolves "How many registered drivers?" to the 10 driver entities', () => {
      const result = routeStructuralQuery(
        'How many registered drivers?',
        workspace.structuralIndex,
        workspace
      );

      expect(result.handled).toBe(true);
      expect(result.queryResult?.matchedItemsCount).toBe(10);
      expect(result.queryResult?.explanation).toContain('10 registered drivers');
      expect(result.findings[0].location.filePath).toBe('models/driver.py');
      expect(result.findings[0].location.startLine).toBe(22);
      expect(result.findings[0].location.endLine).toBe(33);
    });

    it('resolves short count queries like "How many drivers?"', () => {
      const result = routeStructuralQuery(
        'How many drivers?',
        workspace.structuralIndex,
        workspace
      );

      expect(result.handled).toBe(true);
      expect(result.queryResult?.matchedItemsCount).toBe(10);
      expect(result.queryResult?.explanation).toContain('10 drivers');
    });
  });

  describe('3. Function Count Queries', () => {
    it('accurately counts top-level repository functions', () => {
      const result = routeStructuralQuery(
        'How many functions does it have?',
        workspace.structuralIndex,
        workspace
      );

      expect(result.handled).toBe(true);
      expect(result.queryResult?.matchedItemsCount).toBeGreaterThanOrEqual(10);
      expect(result.queryResult?.explanation).toContain('top-level functions');
    });
  });

  describe('4. Ambiguous / Unknown Entity Count Queries (Honest Non-Guessing Fallback)', () => {
    it('returns honest explanation when entity class exists but instance roster is missing (users)', () => {
      const result = routeStructuralQuery(
        'How many users does it have?',
        workspace.structuralIndex,
        workspace
      );

      expect(result.handled).toBe(true);
      expect(result.queryResult?.matchedItemsCount).toBe(0);
      expect(result.queryResult?.explanation).toContain('UserCredentials class');
      expect(result.queryResult?.explanation).toContain('could not reliably determine');
      expect(result.queryResult?.entityInfo?.reliable).toBe(false);
      expect(result.findings.length).toBe(1);
      expect(result.findings[0].location.filePath).toBe('auth/login.py');
    });

    it('returns honest explanation when entity class exists in directory but instance roster is missing (models)', () => {
      const result = routeStructuralQuery(
        'How many models does it have?',
        workspace.structuralIndex,
        workspace
      );

      expect(result.handled).toBe(true);
      expect(result.queryResult?.matchedItemsCount).toBe(0);
      expect(result.queryResult?.explanation).toContain('LapTimePredictor class');
      expect(result.queryResult?.explanation).toContain('could not reliably determine');
      expect(result.queryResult?.entityInfo?.reliable).toBe(false);
    });

    it('returns honest explanation when target entity is completely unknown in repository', () => {
      const result = routeStructuralQuery(
        'How many unreferenced_widgets does it have?',
        workspace.structuralIndex,
        workspace
      );

      expect(result.handled).toBe(true);
      expect(result.queryResult?.matchedItemsCount).toBe(0);
      expect(result.queryResult?.explanation).toContain('could not determine a reliable total count');
      expect(result.findings.length).toBe(0);
    });
  });
});
