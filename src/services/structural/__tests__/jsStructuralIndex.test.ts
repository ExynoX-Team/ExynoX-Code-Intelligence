import { describe, it, expect, beforeEach } from 'vitest';
import { StructuralIndex } from '../structuralIndex.js';
import { parseJavaScriptSource } from '../jsAstParser.js';
import { resolveModulePath, resolveImportBinding } from '../moduleResolver.js';
import { SAMPLE_JS_FILES, loadSampleJavaScriptRepository } from '../../repository/sampleJsRepository.js';
import type { RepositoryFile } from '../../../types/index.js';

describe('JavaScript Structural Intelligence Pivot', () => {
  describe('jsAstParser with @babel/parser', () => {
    it('parses ES module imports and exports with precise 1-based line locations', () => {
      const code = `import express from 'express';
import { loadGatewayConfig } from './config/gatewayConfig.js';

export function initializeGateway(port = 3000) {
  const config = loadGatewayConfig();
  return config;
}
`;
      const result = parseJavaScriptSource('src/index.js', code);
      expect(result.parseStatus).toBe('success');
      expect(result.functions.length).toBe(1);

      const fn = result.functions[0];
      expect(fn.name).toBe('initializeGateway');
      expect(fn.startLine).toBe(4);
      expect(fn.endLine).toBe(7);
      expect(fn.parameters).toContain('port');

      expect(result.imports.length).toBe(2);
      expect(result.imports[1].importedName).toBe('loadGatewayConfig');
      expect(result.imports[1].sourceModule).toBe('./config/gatewayConfig.js');

      // Call sites should detect loadGatewayConfig call inside initializeGateway
      const calls = result.calls.filter(c => c.callee === 'loadGatewayConfig');
      expect(calls.length).toBe(1);
      expect(calls[0].caller).toBe('initializeGateway');
    });

    it('parses classes and method definitions accurately', () => {
      const code = `export class TelemetryRouter {
  constructor() {
    this.name = 'router';
  }

  dispatchMetric(payload) {
    return true;
  }
}
`;
      const result = parseJavaScriptSource('src/router/telemetryRouter.js', code);
      expect(result.classes.length).toBe(1);
      expect(result.classes[0].name).toBe('TelemetryRouter');
      expect(result.methods.length).toBe(2);
      expect(result.methods.map(m => m.name)).toContain('dispatchMetric');
      expect(result.methods.find(m => m.name === 'dispatchMetric')?.className).toBe('TelemetryRouter');
    });

    it('parses JSX / TS syntax without throwing fatal errors', () => {
      const code = `import React from 'react';
export const StatusIndicator = ({ isActive }: { isActive: boolean }) => {
  return <div className="badge">{isActive ? 'Online' : 'Offline'}</div>;
};
`;
      const result = parseJavaScriptSource('src/components/StatusIndicator.tsx', code);
      expect(result.parseStatus).toBe('success');
      expect(result.functions.length).toBe(1);
      expect(result.functions[0].name).toBe('StatusIndicator');
    });
  });

  describe('moduleResolver', () => {
    it('resolves relative file paths with or without extensions', () => {
      const allFiles = new Set(['src/index.js', 'src/auth/authService.js', 'src/config/gatewayConfig.js']);
      
      const resolved = resolveModulePath('./auth/authService.js', 'src/index.js', allFiles);
      expect(resolved.targetPath).toBe('src/auth/authService.js');
      expect(resolved.isExternal).toBe(false);

      const resolvedNoExt = resolveModulePath('./auth/authService', 'src/index.js', allFiles);
      expect(resolvedNoExt.targetPath).toBe('src/auth/authService.js');
      expect(resolvedNoExt.isExternal).toBe(false);
    });

    it('resolves named import binding to target file and original symbol', () => {
      const allFiles = new Set(['src/index.js', 'src/auth/authService.js']);
      const binding = resolveImportBinding('./auth/authService.js', 'validateToken', 'src/index.js', allFiles);
      expect(binding).not.toBeNull();
      expect(binding?.resolvedFilePath).toBe('src/auth/authService.js');
      expect(binding?.targetSymbol).toBe('validateToken');
    });
  });

  describe('StructuralIndex cross-file resolution for JS', () => {
    let index: StructuralIndex;

    beforeEach(() => {
      index = new StructuralIndex();
      const files: RepositoryFile[] = Object.entries(SAMPLE_JS_FILES).map(([path, sourceText]) => ({
        path,
        extension: path.split('.').pop() || '',
        size: sourceText.length,
        language: path.endsWith('.js') ? 'javascript' : 'markdown',
        isPython: false,
        lineCount: sourceText.split('\n').length,
        sourceText,
        lines: sourceText.split('\n')
      }));
      index.buildIndex(files);
    });

    it('indexes functions, classes, and methods across JavaScript files', () => {
      const stats = index.getStats();
      expect(stats.totalFiles).toBeGreaterThan(3);
      expect(stats.totalFunctions).toBeGreaterThan(0);
      expect(stats.totalClasses).toBeGreaterThan(0);

      const authFns = index.findFunctions('validateToken');
      expect(authFns.length).toBe(1);
      expect(authFns[0].filePath).toBe('src/auth/authService.js');

      const classes = index.findClasses('TelemetryRouter');
      expect(classes.length).toBe(1);
      expect(classes[0].filePath).toBe('src/router/telemetryRouter.js');
    });

    it('resolves cross-file caller and callee relationships with resolutionStatus', () => {
      // issueAccessToken is called in src/index.js inside initializeGateway
      const callers = index.findCallers('issueAccessToken');
      expect(callers.length).toBeGreaterThan(0);
      const indexCaller = callers.find(c => c.filePath === 'src/index.js');
      expect(indexCaller).toBeDefined();
      expect(indexCaller?.caller).toBe('initializeGateway');
      expect(indexCaller?.confidence).toBe('confirmed');
    });

    it('resolves import references accurately', () => {
      const imports = index.findImports('loadGatewayConfig');
      expect(imports.length).toBeGreaterThan(0);
      expect(imports.some(i => i.importedName === 'loadGatewayConfig')).toBe(true);
    });
  });

  describe('Sample JS Workspace Integration', () => {
    it('initializes RepositoryWorkspace with JS files and reports JS stats', () => {
      const workspace = loadSampleJavaScriptRepository();
      const stats = workspace.getRepositoryStats();
      expect(stats.jsFileCount).toBeGreaterThan(0);
      expect(stats.jsLines).toBeGreaterThan(0);
      expect(workspace.jsAnalysisAvailable).toBe(true);

      const fns = workspace.findFunctions('validateToken');
      expect(fns.length).toBe(1);
    });
  });
});
