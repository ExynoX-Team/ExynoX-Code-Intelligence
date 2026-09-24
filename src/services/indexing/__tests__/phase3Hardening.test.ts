import { describe, it, expect, beforeAll } from 'vitest';
import { loadSampleRepository } from '../../repository/sampleRepository.js';
import { calculateRepositoryWideStats } from '../lineCounter.js';
import { detectLanguageSpec, analyzeFileLines } from '../languageDetector.js';
import { buildRepositoryChunks, validateChunk } from '../chunker.js';
import { StructuralIndex } from '../../structural/structuralIndex.js';
import { routeStructuralQuery } from '../../structural/queryRouter.js';
import { RepositoryWorkspace } from '../../repository/repositoryWorkspace.js';
import type { CodeChunk, RepositoryFile } from '../../../types/index.js';

describe('Phase 3 Hardening & Consistency Suite', () => {
  let workspace: RepositoryWorkspace;
  let structuralIndex: StructuralIndex;
  let allFiles: RepositoryFile[];

  beforeAll(async () => {
    workspace = await loadSampleRepository();
    structuralIndex = workspace.structuralIndex;
    allFiles = Array.from(workspace.files.values());
  });

  describe('1. Repository Statistics Mathematical Consistency', () => {
    it('guarantees totalLines equals the sum of line categories across all indexed files', () => {
      const allMeta = Array.from(workspace.repositoryIndex.files.values());
      const stats = calculateRepositoryWideStats(allMeta, 0);
      const sumOfCategories = 
        stats.totalCodeLines + 
        stats.totalCommentLines + 
        stats.totalBlankLines + 
        (stats.totalDataLines || 0) + 
        (stats.totalConfigLines || 0) + 
        (stats.totalDocumentationLines || 0);

      expect(stats.totalLines).toBe(sumOfCategories);
      expect(stats.totalLines).toBeGreaterThan(0);
    });

    it('guarantees language breakdown line sum equals totalLines exactly', () => {
      const allMeta = Array.from(workspace.repositoryIndex.files.values());
      const stats = calculateRepositoryWideStats(allMeta, 0);
      expect(stats.byLanguage).toBeDefined();
      const byLang = stats.byLanguage!;
      let sumLanguageLines = 0;
      let sumLanguageComments = 0;

      for (const lang of Object.values(byLang)) {
        sumLanguageLines += lang.totalLines;
        sumLanguageComments += lang.commentLines;
        // Check per-language consistency
        const langSum = lang.codeLines + lang.commentLines + lang.blankLines + lang.dataLines + (lang.configLines || 0) + (lang.documentationLines || 0);
        expect(lang.totalLines).toBe(langSum);
      }

      expect(sumLanguageLines).toBe(stats.totalLines);
      expect(sumLanguageComments).toBe(stats.totalCommentLines);
    });

    it('ensures no files are double-counted in category accounting', () => {
      const allMeta = Array.from(workspace.repositoryIndex.files.values());
      const stats = calculateRepositoryWideStats(allMeta, 0);
      const totalIndexed = (stats.sourceFiles || 0) + (stats.configFiles || 0) + (stats.documentationFiles || 0) + (stats.dataFiles || 0);
      expect(totalIndexed).toBe(stats.totalReadableFiles);
    });
  });

  describe('2. Language Classification and Detection', () => {
    it('accurately identifies Python source files', () => {
      const spec = detectLanguageSpec('app/main.py');
      expect(spec).not.toBeNull();
      expect(spec?.language).toBe('Python');
      expect(spec?.isSourceCode).toBe(true);
      expect(spec?.category).toBe('source');
    });

    it('accurately identifies YAML as configuration rather than code', () => {
      const spec = detectLanguageSpec('config.yaml');
      expect(spec).not.toBeNull();
      expect(spec?.language).toBe('YAML');
      expect(spec?.isConfiguration).toBe(true);
      expect(spec?.isSourceCode).toBe(false);
      expect(spec?.category).toBe('configuration');
    });

    it('accurately accounts for comments in YAML without treating it as source code', () => {
      const yamlContent = [
        '# This is a configuration comment',
        'server:',
        '  port: 8080 # inline not count',
        '  ',
        '# Another comment'
      ];
      const spec = detectLanguageSpec('config.yaml');
      const analysis = analyzeFileLines(yamlContent, spec);
      expect(analysis.commentLines).toBe(2);
      expect(analysis.blankLines).toBe(1);
      expect(analysis.configLines).toBe(2);
      expect(analysis.codeLines).toBe(0);
      expect(analysis.commentLines + analysis.blankLines + analysis.configLines).toBe(yamlContent.length);
    });

    it('accurately identifies Markdown as documentation and counts prose lines', () => {
      const mdContent = [
        '# Documentation Header',
        '',
        'This is a descriptive paragraph explaining the architecture.',
        'Here is another line of documentation.'
      ];
      const spec = detectLanguageSpec('README.md');
      const analysis = analyzeFileLines(mdContent, spec);
      expect(analysis.codeLines).toBe(0);
      expect(analysis.blankLines).toBe(1);
      expect(analysis.documentationLines).toBe(3);
      expect(analysis.blankLines + analysis.documentationLines).toBe(mdContent.length);
    });
  });

  describe('3. Chunker Boundary and Validation', () => {
    it('validates chunks correctly against actual line content', () => {
      const sampleLines = ['def add(a, b):', '    return a + b', ''];
      const validChunk: CodeChunk = {
        id: 'c1',
        filePath: 'test.py',
        language: 'Python',
        symbolType: 'function',
        symbolName: 'add',
        startLine: 1,
        endLine: 2,
        sourceText: 'def add(a, b):\n    return a + b'
      };
      const result = validateChunk(validChunk, sampleLines);
      expect(result.isValid).toBe(true);
    });

    it('rejects chunks with startLine > endLine or mismatched sourceText', () => {
      const sampleLines = ['x = 1', 'y = 2'];
      const invalidChunk: CodeChunk = {
        id: 'c2',
        filePath: 'test.py',
        language: 'Python',
        symbolType: 'block',
        symbolName: 'invalid',
        startLine: 2,
        endLine: 1,
        sourceText: 'x = 1'
      };
      const result = validateChunk(invalidChunk, sampleLines);
      expect(result.isValid).toBe(false);

      const mismatchedTextChunk: CodeChunk = {
        id: 'c3',
        filePath: 'test.py',
        language: 'Python',
        symbolType: 'block',
        symbolName: 'mismatch',
        startLine: 1,
        endLine: 2,
        sourceText: 'completely hallucinated code'
      };
      const mismatchResult = validateChunk(mismatchedTextChunk, sampleLines);
      expect(mismatchResult.isValid).toBe(false);
    });

    it('builds repository chunks where every chunk passes strict validation', () => {
      const chunks = buildRepositoryChunks(allFiles, structuralIndex);
      expect(chunks.length).toBeGreaterThan(0);

      for (const chunk of chunks) {
        const file = workspace.files.get(chunk.filePath);
        expect(file).toBeDefined();
        const validation = validateChunk(chunk, file?.lines);
        expect(validation.isValid).toBe(true);
      }
    });
  });

  describe('4. Structural Query Routing and Honest Evidence', () => {
    it('routes plural definition queries correctly when matched', () => {
      const result = routeStructuralQuery('Where are the credentials defined?', structuralIndex, workspace);
      expect(result.handled).toBe(true);
      expect(result.queryResult?.matchedItemsCount).toBeGreaterThanOrEqual(1);
    });

    it('routes usage queries to find call sites and imports', () => {
      const result = routeStructuralQuery('Where is validate_token used?', structuralIndex, workspace);
      expect(result.handled).toBe(true);
      expect(result.queryResult?.queryType).toBe('find_references');
    });

    it('provides honest response when entity count cannot be confirmed', () => {
      const result = routeStructuralQuery('How many unreferenced_widgets does it have?', structuralIndex, workspace);
      expect(result.handled).toBe(true);
      expect(result.queryResult?.explanation).toContain('could not determine a reliable total');
    });

    it('honestly reports when a definition query targets an undefined symbol', () => {
      const result = routeStructuralQuery('Where are the drivers defined?', structuralIndex, workspace);
      expect(result.handled).toBe(true);
      expect(result.queryResult?.matchedItemsCount).toBe(0);
      expect(result.queryResult?.explanation).toContain('No definition matching');
    });
  });
});
