import { describe, it, expect } from 'vitest';
import { parseJavaScriptSource } from '../jsAstParser.js';

describe('Phase 2 — JavaScript AST Parser (@babel/parser)', () => {
  it('extracts function declarations with exact lines and parameters', () => {
    const code = `function calculateSum(a, b = 10) {
  // Line 2 comment
  return a + b;
}`;
    const result = parseJavaScriptSource('src/math.js', code);
    expect(result.parseStatus).toBe('success');
    expect(result.functions.length).toBe(1);

    const fn = result.functions[0];
    expect(fn.name).toBe('calculateSum');
    expect(fn.filePath).toBe('src/math.js');
    expect(fn.startLine).toBe(1);
    expect(fn.endLine).toBe(4);
    expect(fn.parameters).toEqual(['a', 'b']);
    expect(fn.parameterDetails[0].hasDefault).toBe(false);
    expect(fn.parameterDetails[1].hasDefault).toBe(true);
    expect(fn.isAsync).toBe(false);
  });

  it('extracts async arrow functions and function expressions', () => {
    const code = `const fetchRemoteData = async (endpoint) => {
  return await fetch(endpoint);
};

const handleRequest = function(req, res) {
  res.send('ok');
};`;
    const result = parseJavaScriptSource('src/api.js', code);
    expect(result.functions.length).toBe(2);

    const arrowFn = result.functions.find(f => f.name === 'fetchRemoteData')!;
    expect(arrowFn).toBeDefined();
    expect(arrowFn.isAsync).toBe(true);
    expect(arrowFn.isArrow).toBe(true);
    expect(arrowFn.startLine).toBe(1);
    expect(arrowFn.endLine).toBe(3);

    const exprFn = result.functions.find(f => f.name === 'handleRequest')!;
    expect(exprFn).toBeDefined();
    expect(exprFn.isAsync).toBe(false);
    expect(exprFn.isArrow).toBe(false);
  });

  it('extracts classes, base classes, constructors, and methods', () => {
    const code = `class DeviceController extends BaseController {
  constructor(deviceId) {
    super();
    this.deviceId = deviceId;
  }

  async connect() {
    return true;
  }
}`;
    const result = parseJavaScriptSource('src/device.js', code);
    expect(result.classes.length).toBe(1);
    const cls = result.classes[0];
    expect(cls.name).toBe('DeviceController');
    expect(cls.baseClasses).toEqual(['BaseController']);
    expect(cls.methods).toContain('constructor');
    expect(cls.methods).toContain('connect');
    expect(cls.startLine).toBe(1);
    expect(cls.endLine).toBe(10);

    expect(result.methods.length).toBe(2);
    const constructorMethod = result.methods.find(m => m.name === 'constructor')!;
    expect(constructorMethod.isConstructor).toBe(true);
    expect(constructorMethod.className).toBe('DeviceController');

    const connectMethod = result.methods.find(m => m.name === 'connect')!;
    expect(connectMethod.isAsync).toBe(true);
    expect(connectMethod.className).toBe('DeviceController');
  });

  it('extracts ES imports (named, default, namespace)', () => {
    const code = `import express, { Router, json as parseJson } from 'express';
import * as path from 'path';
import './polyfills.js';`;
    const result = parseJavaScriptSource('src/server.js', code);
    expect(result.imports.length).toBe(4);

    const defaultImp = result.imports.find(i => i.importType === 'es_default')!;
    expect(defaultImp.sourceModule).toBe('express');
    expect(defaultImp.alias).toBe('express');

    const namedImp = result.imports.find(i => i.alias === 'parseJson')!;
    expect(namedImp.importedName).toBe('json');
    expect(namedImp.sourceModule).toBe('express');

    const nsImp = result.imports.find(i => i.importType === 'es_namespace')!;
    expect(nsImp.sourceModule).toBe('path');
    expect(nsImp.importedName).toBe('*');
  });

  it('extracts CommonJS require() and module.exports / exports', () => {
    const code = `const { validateToken, issueJwt } = require('./auth/login.js');
const config = require('./config/settings.js');

function loginHandler() {
  validateToken('test');
}

module.exports = {
  loginHandler
};
exports.version = '1.0';`;
    const result = parseJavaScriptSource('src/index.js', code);
    expect(result.imports.some(i => i.importedName === 'validateToken')).toBe(true);
    expect(result.imports.some(i => i.importedName === 'config')).toBe(true);

    expect(result.exports.some(e => e.exportedName === 'loginHandler')).toBe(true);
    expect(result.exports.some(e => e.exportedName === 'version')).toBe(true);
  });

  it('extracts static function and method call sites with caller context', () => {
    const code = `function main() {
  handleIncomingDeeplink('settings/bluetooth');
}

function handleIncomingDeeplink(uri) {
  openBluetoothSettings();
}`;
    const result = parseJavaScriptSource('src/main.js', code);
    expect(result.calls.length).toBe(2);

    const call1 = result.calls.find(c => c.callee === 'handleIncomingDeeplink')!;
    expect(call1.caller).toBe('main');
    expect(call1.confidence).toBe('confirmed');

    const call2 = result.calls.find(c => c.callee === 'openBluetoothSettings')!;
    expect(call2.caller).toBe('handleIncomingDeeplink');
  });

  it('marks dynamic calls conservatively as unresolved or likely rather than hallucinating', () => {
    const code = `function dynamicDispatcher(actionName) {
  handlers[actionName]();
}`;
    const result = parseJavaScriptSource('src/dispatch.js', code);
    expect(result.calls.length).toBe(1);
    expect(result.calls[0].callee).toContain('handlers[computed]');
    expect(result.calls[0].confidence).toBe('unresolved');
  });
});
