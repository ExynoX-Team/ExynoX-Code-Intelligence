/**
 * Cross-Modal Repository Resource Index & Source Reference Resolver
 * Maps assets, configurations, documentation, entry points, tests, and source-to-resource references
 * Samsung PRISM Gen AI Hackathon (Theme 1: Agentic Code Intelligence)
 * Phase 6.5 — General Deterministic Query Intelligence Hardening
 */

import type { RepositoryFile } from '../../types/index.js';
import type { RepositoryWorkspace } from '../repository/repositoryWorkspace.js';

export interface SourceReference {
  sourceFile: string;
  line: number;
  snippet: string;
}

export interface UniversalDefinition {
  name: string;
  kind: 'function' | 'class' | 'method' | 'variable' | 'interface';
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
  language: string;
}

export interface CrossModalResourceIndex {
  assets: Map<string, RepositoryFile>;
  configs: Map<string, RepositoryFile>;
  docs: Map<string, RepositoryFile>;
  tests: Map<string, RepositoryFile>;
  entryPoints: Map<string, RepositoryFile>;
  sourceFiles: Map<string, RepositoryFile>;
  
  // Source-to-Resource references (Section 8)
  assetReferences: Map<string, SourceReference[]>;
  configReferences: Map<string, SourceReference[]>;
  moduleImports: Map<string, SourceReference[]>;
  
  // Universal definitions
  definitions: UniversalDefinition[];
  definitionsByName: Map<string, UniversalDefinition[]>;
  
  // Fast path lookup
  allPaths: string[];
}

// In-memory cache keyed by workspace instance
const WORKSPACE_INDEX_CACHE = new WeakMap<RepositoryWorkspace, CrossModalResourceIndex>();

const ASSET_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'ico', 'svg', 'webp', 'bmp', 'tiff']);
const CONFIG_EXTENSIONS = new Set(['yaml', 'yml', 'toml', 'env', 'ini', 'cfg', 'conf', 'json']);
const DOC_EXTENSIONS = new Set(['md', 'markdown', 'txt', 'rst', 'docs']);

/**
 * Builds or retrieves the cached Cross-Modal Resource Index for a workspace.
 */
export function getOrCreateResourceIndex(workspace: RepositoryWorkspace): CrossModalResourceIndex {
  const cached = WORKSPACE_INDEX_CACHE.get(workspace);
  if (cached) return cached;

  const assets = new Map<string, RepositoryFile>();
  const configs = new Map<string, RepositoryFile>();
  const docs = new Map<string, RepositoryFile>();
  const tests = new Map<string, RepositoryFile>();
  const entryPoints = new Map<string, RepositoryFile>();
  const sourceFiles = new Map<string, RepositoryFile>();
  
  const assetReferences = new Map<string, SourceReference[]>();
  const configReferences = new Map<string, SourceReference[]>();
  const moduleImports = new Map<string, SourceReference[]>();
  
  const definitions: UniversalDefinition[] = [];
  const definitionsByName = new Map<string, UniversalDefinition[]>();

  const addDefinition = (def: UniversalDefinition) => {
    if (!def || !def.name) return;
    definitions.push(def);
    const key = def.name.toLowerCase();
    const list = definitionsByName.get(key) || [];
    list.push(def);
    definitionsByName.set(key, list);
  };

  const addReference = (map: Map<string, SourceReference[]>, key: string, ref: SourceReference) => {
    const list = map.get(key) || [];
    list.push(ref);
    map.set(key, list);
  };

  // 1. Categorize files
  for (const [path, file] of workspace.files.entries()) {
    const lowerPath = path.toLowerCase();
    const ext = file.extension.toLowerCase();
    const filename = lowerPath.split('/').pop() || '';

    if (ASSET_EXTENSIONS.has(ext)) {
      assets.set(path, file);
    } else if (DOC_EXTENSIONS.has(ext) || lowerPath.includes('readme') || lowerPath.startsWith('docs/')) {
      docs.set(path, file);
    } else if (
      CONFIG_EXTENSIONS.has(ext) ||
      lowerPath.includes('config') ||
      lowerPath.includes('settings') ||
      filename === 'dockerfile' ||
      filename.startsWith('.env')
    ) {
      configs.set(path, file);
    }

    if (
      lowerPath.includes('.test.') ||
      lowerPath.includes('.spec.') ||
      lowerPath.includes('__tests__') ||
      filename.startsWith('test_') ||
      filename.endsWith('_test.py')
    ) {
      tests.set(path, file);
    }

    // Detect entry points
    if (
      filename === 'main.py' ||
      filename === '__main__.py' ||
      filename === 'server.ts' ||
      filename === 'server.js' ||
      filename === 'app.ts' ||
      filename === 'app.py' ||
      filename === 'main.ts' ||
      filename === 'main.tsx' ||
      filename === 'index.html' ||
      filename === 'index.ts'
    ) {
      entryPoints.set(path, file);
    }

    if (file.lines.length > 0 && !ASSET_EXTENSIONS.has(ext)) {
      sourceFiles.set(path, file);
    }
  }

  // 2. Scan source files for references and definitions
  for (const [path, file] of sourceFiles.entries()) {
    const lines = file.lines;
    const isPy = file.isPython || path.endsWith('.py');
    const isTsJs = path.endsWith('.ts') || path.endsWith('.tsx') || path.endsWith('.js') || path.endsWith('.jsx');

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const lineNum = i + 1;
      const trimmed = lineText.trim();

      // Check asset references: e.g. "exynox-logo.png", "/exynox-logo.png", "logo.svg"
      const assetMatch = lineText.match(/['"`]([^'"`\n]+\.(?:png|svg|jpg|jpeg|gif|ico|webp))['"`]/i);
      if (assetMatch) {
        const rawRef = assetMatch[1];
        const cleanRef = rawRef.replace(/^\//, '').toLowerCase();
        const baseName = cleanRef.split('/').pop() || cleanRef;
        const refItem: SourceReference = { sourceFile: path, line: lineNum, snippet: trimmed };
        addReference(assetReferences, cleanRef, refItem);
        addReference(assetReferences, baseName, refItem);
      }

      // Check config / env references: process.env.PORT, os.environ.get(...), settings.yaml
      if (lineText.includes('process.env') || lineText.includes('os.environ') || lineText.includes('.env') || lineText.includes('config')) {
        const envMatch = lineText.match(/(?:process\.env\.|os\.environ(?:\.get)?\(['"])([a-zA-Z0-9_]+)/);
        if (envMatch) {
          const varName = envMatch[1].toLowerCase();
          addReference(configReferences, varName, { sourceFile: path, line: lineNum, snippet: trimmed });
        }
      }

      // Check import references: import ... from '...', from ... import ...
      const importMatch = lineText.match(/(?:from\s+([a-zA-Z0-9_.]+)\s+import|import\s+(?:\{[^}]+\}\s+from\s+)?['"]([^'"]+)['"])/);
      if (importMatch) {
        const moduleName = (importMatch[1] || importMatch[2] || '').toLowerCase().replace(/^[./]+/, '');
        if (moduleName) {
          addReference(moduleImports, moduleName, { sourceFile: path, line: lineNum, snippet: trimmed });
        }
      }

      // Extract Universal Definitions (Functions & Classes)
      if (isPy) {
        // Python definitions: def func_name(, class ClassName:
        const pyFn = trimmed.match(/^def\s+([a-zA-Z0-9_]+)\s*\(/);
        if (pyFn) {
          addDefinition({
            name: pyFn[1],
            kind: 'function',
            filePath: path,
            startLine: lineNum,
            endLine: Math.min(lines.length, lineNum + 15),
            snippet: trimmed,
            language: 'python'
          });
        }
        const pyCls = trimmed.match(/^class\s+([a-zA-Z0-9_]+)(?:\s*\(|:)/);
        if (pyCls) {
          addDefinition({
            name: pyCls[1],
            kind: 'class',
            filePath: path,
            startLine: lineNum,
            endLine: Math.min(lines.length, lineNum + 15),
            snippet: trimmed,
            language: 'python'
          });
        }
      } else if (isTsJs) {
        // TS/JS definitions: function name, const name = ..., class Name
        const tsFn = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/)
          || trimmed.match(/^(?:export\s+)?const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>/);
        if (tsFn) {
          addDefinition({
            name: tsFn[1],
            kind: 'function',
            filePath: path,
            startLine: lineNum,
            endLine: Math.min(lines.length, lineNum + 15),
            snippet: trimmed,
            language: 'typescript'
          });
        }
        const tsCls = trimmed.match(/^(?:export\s+)?class\s+([a-zA-Z0-9_]+)/);
        if (tsCls) {
          addDefinition({
            name: tsCls[1],
            kind: 'class',
            filePath: path,
            startLine: lineNum,
            endLine: Math.min(lines.length, lineNum + 15),
            snippet: trimmed,
            language: 'typescript'
          });
        }
      }
    }
  }

  // Also include Python AST definitions if structural index is available
  if (workspace.structuralIndex && workspace.pythonAnalysisAvailable) {
    const stats = workspace.structuralIndex.getStats();
    if (stats.pythonAnalysisAvailable !== false) {
      for (const pyFile of workspace.pythonFiles) {
        const structure = workspace.getFileStructure(pyFile.path);
        if (structure) {
          for (const fn of structure.functions) {
            addDefinition({
              name: fn.name,
              kind: 'function',
              filePath: fn.filePath,
              startLine: fn.startLine,
              endLine: fn.endLine,
              snippet: `def ${fn.name}(${(fn.parameters || []).join(', ')}):`,
              language: 'python'
            });
          }
          for (const cls of structure.classes) {
            addDefinition({
              name: cls.name,
              kind: 'class',
              filePath: cls.filePath,
              startLine: cls.startLine,
              endLine: cls.endLine,
              snippet: `class ${cls.name}:`,
              language: 'python'
            });
            for (const methodName of cls.methods) {
              if (methodName && typeof methodName === 'string') {
                addDefinition({
                  name: methodName,
                  kind: 'method',
                  filePath: cls.filePath,
                  startLine: cls.startLine,
                  endLine: cls.endLine,
                  snippet: `def ${methodName}(...):`,
                  language: 'python'
                });
              }
            }
          }
        }
      }
    }
  }

  const allPaths = Array.from(workspace.files.keys()).sort();

  const index: CrossModalResourceIndex = {
    assets,
    configs,
    docs,
    tests,
    entryPoints,
    sourceFiles,
    assetReferences,
    configReferences,
    moduleImports,
    definitions,
    definitionsByName,
    allPaths
  };

  WORKSPACE_INDEX_CACHE.set(workspace, index);
  return index;
}
