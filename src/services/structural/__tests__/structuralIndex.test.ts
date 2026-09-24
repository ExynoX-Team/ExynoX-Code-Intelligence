import { describe, it, expect, beforeEach } from 'vitest';
import { parsePythonSource } from '../astParser.js';
import { StructuralIndex } from '../structuralIndex.js';
import { routeStructuralQuery } from '../queryRouter.js';
import { RepositoryWorkspace } from '../../repository/repositoryWorkspace.js';
import { loadSampleRepository } from '../../repository/sampleRepository.js';
import type { RepositoryFile } from '../../../types/index.js';

describe('Phase 2 — Python Structural Intelligence', () => {
  describe('AST Parser (py-ast)', () => {
    it('extracts top-level functions with exact line numbers and parameters', () => {
      const code = `def calculate_sum(a: int, b: int = 10) -> int:
    """Calculates sum of two integers."""
    return a + b
`;
      const result = parsePythonSource('math_ops.py', code);
      expect(result.parseStatus).toBe('success');
      expect(result.functions.length).toBe(1);

      const fn = result.functions[0];
      expect(fn.name).toBe('calculate_sum');
      expect(fn.filePath).toBe('math_ops.py');
      expect(fn.startLine).toBe(1);
      expect(fn.endLine).toBe(3);
      expect(fn.parameters).toEqual(['a', 'b']);
      expect(fn.parameterDetails[0].name).toBe('a');
      expect(fn.parameterDetails[0].hasDefault).toBe(false);
      expect(fn.parameterDetails[1].name).toBe('b');
      expect(fn.parameterDetails[1].hasDefault).toBe(true);
      expect(fn.isAsync).toBe(false);
      expect(fn.docstring).toBe('Calculates sum of two integers.');
    });

    it('extracts async functions correctly', () => {
      const code = `async def fetch_remote_data(endpoint: str):
    await client.get(endpoint)
`;
      const result = parsePythonSource('network.py', code);
      expect(result.functions.length).toBe(1);
      expect(result.functions[0].isAsync).toBe(true);
      expect(result.functions[0].name).toBe('fetch_remote_data');
    });

    it('extracts classes with base classes and methods', () => {
      const code = `class DeviceController(BaseController, LoggingMixin):
    """Main device controller."""
    def __init__(self, device_id: str):
        self.device_id = device_id

    def connect(self) -> bool:
        return True
`;
      const result = parsePythonSource('device.py', code);
      expect(result.classes.length).toBe(1);

      const cls = result.classes[0];
      expect(cls.name).toBe('DeviceController');
      expect(cls.baseClasses).toEqual(['BaseController', 'LoggingMixin']);
      expect(cls.methods).toEqual(['__init__', 'connect']);
      expect(cls.startLine).toBe(1);
      expect(cls.endLine).toBe(7);

      expect(result.methods.length).toBe(2);
      expect(result.methods[0].className).toBe('DeviceController');
      expect(result.methods[1].className).toBe('DeviceController');
    });

    it('extracts imports (both standard and from...import with aliases)', () => {
      const code = `import os
import sys as system
from typing import List, Optional as Opt
from auth.login import validate_token
`;
      const result = parsePythonSource('main.py', code);
      expect(result.imports.length).toBe(5);

      expect(result.imports[0]).toMatchObject({
        sourceModule: 'os',
        importedName: 'os',
        isFromImport: false
      });
      expect(result.imports[1]).toMatchObject({
        sourceModule: 'sys',
        importedName: 'sys',
        alias: 'system',
        isFromImport: false
      });
      expect(result.imports[2]).toMatchObject({
        sourceModule: 'typing',
        importedName: 'List',
        isFromImport: true
      });
      expect(result.imports[3]).toMatchObject({
        sourceModule: 'typing',
        importedName: 'Optional',
        alias: 'Opt',
        isFromImport: true
      });
      expect(result.imports[4]).toMatchObject({
        sourceModule: 'auth.login',
        importedName: 'validate_token',
        isFromImport: true
      });
    });

    it('extracts function call sites with caller context', () => {
      const code = `from auth.login import validate_token

def process_token(token: str):
    if validate_token(token):
        return True
    return False
`;
      const result = parsePythonSource('handler.py', code);
      expect(result.calls.length).toBe(1);
      expect(result.calls[0]).toMatchObject({
        caller: 'process_token',
        callee: 'validate_token',
        line: 4,
        confidence: 'confirmed'
      });
    });

    it('handles syntax errors gracefully without throwing', () => {
      const brokenCode = `def invalid_syntax(
    # missing parameter list and colon
    return None
`;
      const result = parsePythonSource('syntax_err.py', brokenCode);
      expect(result.parseStatus).toBe('error');
      expect(result.parseError).toBeDefined();
      expect(result.functions.length).toBe(0);
      expect(result.classes.length).toBe(0);
    });
  });

  describe('StructuralIndex', () => {
    let index: StructuralIndex;

    const fileA: RepositoryFile = {
      path: 'auth/token.py',
      extension: 'py',
      language: 'python',
      sourceText: `def validate_token(token: str) -> bool:
    return len(token) > 10
`,
      lines: ['def validate_token(token: str) -> bool:', '    return len(token) > 10'],
      size: 60,
      lineCount: 2,
      isPython: true
    };

    const fileB: RepositoryFile = {
      path: 'auth/middleware.py',
      extension: 'py',
      language: 'python',
      sourceText: `from auth.token import validate_token

class AuthMiddleware:
    def handle_request(self, req):
        if not validate_token(req.token):
            raise PermissionError()
`,
      lines: [
        'from auth.token import validate_token',
        '',
        'class AuthMiddleware:',
        '    def handle_request(self, req):',
        '        if not validate_token(req.token):',
        '            raise PermissionError()'
      ],
      size: 150,
      lineCount: 6,
      isPython: true
    };

    beforeEach(() => {
      index = new StructuralIndex();
      index.buildIndex([fileA, fileB]);
    });

    it('indexes files and reports accurate statistics', () => {
      const stats = index.getStats();
      expect(stats.filesAnalyzed).toBe(2);
      expect(stats.successfullyParsed).toBe(2);
      expect(stats.parseFailures).toBe(0);
      expect(stats.totalFunctions).toBe(1);
      expect(stats.totalClasses).toBe(1);
      expect(stats.totalMethods).toBe(1);
    });

    it('finds function definition by name', () => {
      const fn = index.findFunctionDefinition('validate_token');
      expect(fn).not.toBeNull();
      expect(fn?.filePath).toBe('auth/token.py');
      expect(fn?.startLine).toBe(1);
    });

    it('finds class definition by name', () => {
      const cls = index.findClassDefinition('AuthMiddleware');
      expect(cls).not.toBeNull();
      expect(cls?.filePath).toBe('auth/middleware.py');
      expect(cls?.methods).toContain('handle_request');
    });

    it('finds callers of a function', () => {
      const callers = index.findCallers('validate_token');
      expect(callers.length).toBe(1);
      expect(callers[0].caller).toBe('AuthMiddleware.handle_request');
      expect(callers[0].filePath).toBe('auth/middleware.py');
      expect(callers[0].line).toBe(5);
    });

    it('finds callees of a method', () => {
      const callees = index.findCallees('handle_request');
      expect(callees.length).toBeGreaterThanOrEqual(1);
      expect(callees.some(c => c.callee === 'validate_token')).toBe(true);
    });

    it('finds imports of a module', () => {
      const imports = index.findImports('auth.token');
      expect(imports.length).toBe(1);
      expect(imports[0].filePath).toBe('auth/middleware.py');
      expect(imports[0].importedName).toBe('validate_token');
    });
  });

  describe('Sample Repository Integration', () => {
    it('indexes samsung-prism-device-hub with complete structural relationships', async () => {
      const workspace = await loadSampleRepository();
      const stats = workspace.getStructuralStats();

      expect(stats.filesAnalyzed).toBe(8);
      expect(stats.successfullyParsed).toBe(8);
      expect(stats.parseFailures).toBe(0);
      expect(stats.totalFunctions).toBeGreaterThanOrEqual(10);
      expect(stats.totalClasses).toBeGreaterThanOrEqual(5);

      // Verify validate_token is called by AuthenticationMiddleware.process_request
      const callers = workspace.findCallers('validate_token');
      expect(callers.length).toBeGreaterThanOrEqual(1);
      const mwCaller = callers.find(c => c.caller.includes('process_request'));
      expect(mwCaller).toBeDefined();
      expect(mwCaller?.filePath).toBe('auth/middleware.py');

      // Verify BluetoothSettingsDeeplink class is defined in bluetooth/settings.py
      const cls = workspace.findClassDefinition('BluetoothSettingsDeeplink');
      expect(cls).toBeDefined();
      expect(cls?.filePath).toBe('bluetooth/settings.py');

      // Verify audit logger imports
      const auditImports = workspace.findImports('services.audit');
      expect(auditImports.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Structural Query Router', () => {
    it('routes "Where is validate_token defined?" to structural tool', async () => {
      const workspace = await loadSampleRepository();
      const outcome = routeStructuralQuery(
        'Where is validate_token defined?',
        workspace.structuralIndex,
        workspace
      );

      expect(outcome.handled).toBe(true);
      expect(outcome.queryResult?.queryType).toBe('find_function_def');
      expect(outcome.findings.length).toBe(1);
      expect(outcome.findings[0].location.filePath).toBe('auth/login.py');
    });

    it('routes "Which functions call validate_token?" to findCallers', async () => {
      const workspace = await loadSampleRepository();
      const outcome = routeStructuralQuery(
        'Which functions call validate_token?',
        workspace.structuralIndex,
        workspace
      );

      expect(outcome.handled).toBe(true);
      expect(outcome.queryResult?.queryType).toBe('find_callers');
      expect(outcome.findings.length).toBeGreaterThanOrEqual(1);
      expect(outcome.findings[0].location.filePath).toBe('auth/middleware.py');
    });

    it('routes "What functions are defined in auth/login.py?" to getFunctionsInFile', async () => {
      const workspace = await loadSampleRepository();
      const outcome = routeStructuralQuery(
        'What functions are defined in auth/login.py?',
        workspace.structuralIndex,
        workspace
      );

      expect(outcome.handled).toBe(true);
      expect(outcome.queryResult?.queryType).toBe('list_file_functions');
      expect(outcome.findings.length).toBeGreaterThanOrEqual(2);
    });

    it('routes "Which files import services.audit?" to findImports', async () => {
      const workspace = await loadSampleRepository();
      const outcome = routeStructuralQuery(
        'Which files import services.audit?',
        workspace.structuralIndex,
        workspace
      );

      expect(outcome.handled).toBe(true);
      expect(outcome.queryResult?.queryType).toBe('find_imports');
      expect(outcome.findings.length).toBeGreaterThanOrEqual(3);
    });
  });
});
