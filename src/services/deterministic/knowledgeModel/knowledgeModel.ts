/**
 * Unified Repository Knowledge Model
 * Samsung PRISM Gen AI Hackathon (Theme 1: Agentic Code Intelligence)
 * Phase 6.6 — General-Purpose Deterministic Repository Intelligence Engine
 *
 * Represents any arbitrary codebase as a fully connected, searchable graph model.
 * Zero hardcoded repository logic. Zero LLM.
 */

import type { RepositoryWorkspace } from '../../repository/repositoryWorkspace.js';
import type {
  FileKnowledgeNode,
  SymbolKnowledgeNode,
  ConfigEntryNode,
  DocSectionNode,
  AssetKnowledgeNode,
  TestKnowledgeNode,
  RelationshipEdge,
  RepositoryFileType
} from './types.js';
import { RepositoryVocabulary } from './vocabularyIndex.js';
import { UniversalSymbolExtractor } from './symbolExtractor.js';
import { ConfigExtractor } from './configExtractor.js';
import { DocExtractor } from './docExtractor.js';
import { RelationshipExtractor, type ExtractedCallSite, type ExtractedImport } from './relationshipExtractor.js';

export class UnifiedRepositoryKnowledgeModel {
  readonly files = new Map<string, FileKnowledgeNode>();
  readonly symbols: SymbolKnowledgeNode[] = [];
  readonly symbolsByName = new Map<string, SymbolKnowledgeNode[]>();
  readonly symbolsById = new Map<string, SymbolKnowledgeNode>();

  readonly imports: ExtractedImport[] = [];
  readonly importedBy = new Map<string, ExtractedImport[]>();
  readonly calls: ExtractedCallSite[] = [];
  readonly calledBy = new Map<string, ExtractedCallSite[]>();
  readonly callerMap = new Map<string, ExtractedCallSite[]>();

  readonly configs = new Map<string, ConfigEntryNode[]>();
  readonly configKeyMap = new Map<string, ConfigEntryNode[]>();
  readonly docs = new Map<string, DocSectionNode[]>();
  readonly assets = new Map<string, AssetKnowledgeNode>();
  readonly tests = new Map<string, TestKnowledgeNode[]>();
  readonly entryPoints = new Map<string, FileKnowledgeNode>();

  readonly vocabulary = new RepositoryVocabulary();
  readonly edges: RelationshipEdge[] = [];

  readonly stats = {
    totalFiles: 0,
    totalSymbols: 0,
    totalClasses: 0,
    totalFunctions: 0,
    totalRoutes: 0,
    totalConfigs: 0,
    totalAssets: 0,
    totalDocs: 0,
    totalTests: 0,
    buildTimeMs: 0
  };

  private constructor() {}

  /**
   * Builds a complete, unified knowledge model from any RepositoryWorkspace.
   */
  static build(workspace: RepositoryWorkspace): UnifiedRepositoryKnowledgeModel {
    const startTime = performance.now();
    const model = new UnifiedRepositoryKnowledgeModel();

    // 1. Index All Files
    for (const [path, file] of workspace.files.entries()) {
      const lowerPath = path.toLowerCase();
      const ext = (file.extension || '').toLowerCase();
      const filename = path.split('/').pop() || path;
      const basename = filename.split('.')[0] || filename;
      const dirSegments = path.split('/').slice(0, -1);
      const directory = dirSegments.join('/');

      let fileType: RepositoryFileType = 'source';
      if (lowerPath.match(/\.(png|svg|ico|jpg|jpeg|gif|webp|woff|woff2|ttf|mp4|webm)$/i) || lowerPath.startsWith('assets/')) {
        fileType = 'asset';
      } else if (lowerPath.match(/(\.test\.|\.spec\.|__tests__|test_|_test\.)/i)) {
        fileType = 'test';
      } else if (lowerPath.match(/\.(ya?ml|json|env|toml|ini|conf)$/i) || filename.toLowerCase() === 'dockerfile') {
        fileType = 'config';
      } else if (lowerPath.endsWith('.md') || lowerPath.startsWith('docs/') || lowerPath.includes('readme')) {
        fileType = 'documentation';
      } else if (lowerPath.match(/\.(csv|parquet|sqlite|db|tsv|data)$/i) || lowerPath.includes('dataset')) {
        fileType = 'data';
      } else if (
        filename.match(/^(main|server|app|index|cli)\.(py|ts|js|tsx|jsx|go|java|rs)$/i) ||
        lowerPath.endsWith('__main__.py')
      ) {
        fileType = 'entry_point';
      }

      const fileNode: FileKnowledgeNode = {
        id: `file_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
        path,
        filename,
        basename,
        extension: ext,
        directory,
        dirSegments,
        language: file.language || 'text',
        fileType,
        lineCount: file.lineCount || file.lines.length,
        lines: file.lines || [],
        size: file.size || 0
      };

      model.files.set(path, fileNode);

      if (fileType === 'entry_point') {
        model.entryPoints.set(path, fileNode);
        model.vocabulary.indexEntity('entrypoint', {
          entityId: fileNode.id,
          entityType: 'file',
          weight: 1.0,
          name: filename,
          filePath: path
        });
        model.vocabulary.indexEntity('entry', {
          entityId: fileNode.id,
          entityType: 'file',
          weight: 0.9,
          name: filename,
          filePath: path
        });
        model.vocabulary.indexEntity('main', {
          entityId: fileNode.id,
          entityType: 'file',
          weight: 1.0,
          name: filename,
          filePath: path
        });
        model.vocabulary.indexEntity('application', {
          entityId: fileNode.id,
          entityType: 'file',
          weight: 0.85,
          name: filename,
          filePath: path
        });
      }

      if (fileType === 'documentation') {
        model.vocabulary.indexEntity('documentation', { entityId: fileNode.id, entityType: 'doc', weight: 0.95, name: filename, filePath: path });
        model.vocabulary.indexEntity('docs', { entityId: fileNode.id, entityType: 'doc', weight: 0.95, name: filename, filePath: path });
        model.vocabulary.indexEntity('usage', { entityId: fileNode.id, entityType: 'doc', weight: 0.85, name: filename, filePath: path });
        model.vocabulary.indexEntity('readme', { entityId: fileNode.id, entityType: 'doc', weight: 0.95, name: filename, filePath: path });
      }

      // Index file in vocabulary
      model.vocabulary.indexEntity(filename, {
        entityId: fileNode.id,
        entityType: 'file',
        weight: fileType === 'entry_point' ? 1.0 : 0.85,
        name: filename,
        filePath: path,
        startLine: 1,
        endLine: fileNode.lineCount
      });
      model.vocabulary.indexEntity(basename, {
        entityId: fileNode.id,
        entityType: 'file',
        weight: 0.8,
        name: basename,
        filePath: path,
        startLine: 1,
        endLine: fileNode.lineCount
      });
      if (directory) {
        model.vocabulary.indexEntity(directory, {
          entityId: fileNode.id,
          entityType: 'file',
          weight: 0.6,
          name: directory,
          filePath: path
        });
      }
    }

    // 2. Extract Assets & References
    for (const [path, fileNode] of model.files.entries()) {
      if (fileNode.fileType === 'asset' || fileNode.fileType === 'data') {
        const ext = fileNode.extension.toLowerCase();
        let cat: AssetKnowledgeNode['category'] = 'other';
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) cat = 'image';
        else if (['.svg', '.ico', 'svg', 'ico'].includes(ext)) cat = 'icon';
        else if (['.woff', '.woff2', '.ttf', 'woff', 'woff2', 'ttf'].includes(ext)) cat = 'font';

        const assetNode: AssetKnowledgeNode = {
          id: `asset_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
          path,
          filename: fileNode.filename,
          extension: ext,
          category: cat,
          size: fileNode.size,
          referencedBy: []
        };
        model.assets.set(path, assetNode);

        model.vocabulary.indexEntity(fileNode.filename, {
          entityId: assetNode.id,
          entityType: 'asset',
          weight: 0.95,
          name: fileNode.filename,
          filePath: path
        });

        // Index asset category and structural discovery terms
        model.vocabulary.indexEntity('asset', { entityId: assetNode.id, entityType: 'asset', weight: 0.85, name: fileNode.filename, filePath: path });
        model.vocabulary.indexEntity('assets', { entityId: assetNode.id, entityType: 'asset', weight: 0.85, name: fileNode.filename, filePath: path });

        if (cat === 'image') {
          model.vocabulary.indexEntity('image', { entityId: assetNode.id, entityType: 'asset', weight: 0.9, name: fileNode.filename, filePath: path });
          model.vocabulary.indexEntity('images', { entityId: assetNode.id, entityType: 'asset', weight: 0.9, name: fileNode.filename, filePath: path });
        }

        if (fileNode.fileType === 'data') {
          model.vocabulary.indexEntity('dataset', { entityId: assetNode.id, entityType: 'asset', weight: 0.9, name: fileNode.filename, filePath: path });
          model.vocabulary.indexEntity('data', { entityId: assetNode.id, entityType: 'asset', weight: 0.85, name: fileNode.filename, filePath: path });
          if (ext === '.csv') {
            model.vocabulary.indexEntity('csv', { entityId: assetNode.id, entityType: 'asset', weight: 0.9, name: fileNode.filename, filePath: path });
          }
        }
      }
    }

    // 3. Extract Documentation Sections
    for (const [path, fileNode] of model.files.entries()) {
      if (fileNode.fileType === 'documentation' || fileNode.path.toLowerCase().endsWith('.md')) {
        const sections = DocExtractor.extractDocSections(path, fileNode.lines);
        model.docs.set(path, sections);

        for (const sec of sections) {
          model.vocabulary.indexEntity(sec.title, {
            entityId: sec.id,
            entityType: 'doc',
            weight: 0.9,
            name: sec.title,
            filePath: path,
            startLine: sec.startLine,
            endLine: sec.endLine
          });
        }
      }
    }

    // 4. Extract Configuration Entries
    for (const [path, fileNode] of model.files.entries()) {
      if (fileNode.fileType === 'config' || fileNode.extension.match(/\.(ya?ml|env|json|toml)$/i)) {
        const cfgEntries = ConfigExtractor.extractConfigEntries(path, fileNode.lines, fileNode.language);
        model.configs.set(path, cfgEntries);

        for (const entry of cfgEntries) {
          let list = model.configKeyMap.get(entry.key.toLowerCase());
          if (!list) {
            list = [];
            model.configKeyMap.set(entry.key.toLowerCase(), list);
          }
          list.push(entry);

          model.vocabulary.indexEntity(entry.key, {
            entityId: entry.id,
            entityType: 'config',
            weight: 0.95,
            name: entry.key,
            filePath: path,
            startLine: entry.line,
            endLine: entry.line
          });
        }
      }

      // Check env var usages across all source files
      if (fileNode.fileType === 'source' || fileNode.fileType === 'entry_point') {
        const envRefs = ConfigExtractor.extractEnvVarReferences(path, fileNode.lines);
        for (const entry of envRefs) {
          let list = model.configKeyMap.get(entry.key.toLowerCase());
          if (!list) {
            list = [];
            model.configKeyMap.set(entry.key.toLowerCase(), list);
          }
          list.push(entry);
        }
      }
    }

    // 5. Universal Symbol Extraction (Classes, Functions, Methods, Routes, Collections)
    const knownSymbolNames = new Set<string>();

    for (const [path, fileNode] of model.files.entries()) {
      if (fileNode.fileType === 'asset' || fileNode.fileType === 'data') continue;

      // Extract symbols using UniversalSymbolExtractor
      const symbols = UniversalSymbolExtractor.extractSymbols(path, fileNode.lines, fileNode.language);

      // If workspace has Python StructuralIndex, cross-correlate and enrich
      if (fileNode.language === 'python' && workspace.structuralIndex) {
        const struct = workspace.structuralIndex.getFileStructure(path);
        if (struct) {
          // Enrich classes
          for (const c of struct.classes) {
            if (!symbols.some(s => s.name === c.name && s.kind === 'class')) {
              symbols.push({
                id: `sym_${path.replace(/[^a-zA-Z0-9]/g, '_')}_class_${c.name}_${c.startLine}`,
                name: c.name,
                normalizedName: c.name.toLowerCase(),
                tokens: RepositoryVocabulary.tokenize(c.name),
                kind: 'class',
                filePath: path,
                startLine: c.startLine,
                endLine: c.endLine,
                docstring: c.docstring,
                isExported: true,
                snippet: fileNode.lines.slice(c.startLine - 1, Math.min(fileNode.lines.length, c.startLine + 6)).join('\n')
              });
            }
          }
          // Enrich functions
          for (const f of struct.functions) {
            if (!symbols.some(s => s.name === f.name && s.kind === 'function')) {
              symbols.push({
                id: `sym_${path.replace(/[^a-zA-Z0-9]/g, '_')}_function_${f.name}_${f.startLine}`,
                name: f.name,
                normalizedName: f.name.toLowerCase(),
                tokens: RepositoryVocabulary.tokenize(f.name),
                kind: 'function',
                filePath: path,
                startLine: f.startLine,
                endLine: f.endLine,
                parameters: f.parameters.map(p => typeof p === 'string' ? p : (p as any).name || String(p)),
                docstring: f.docstring,
                isExported: true,
                snippet: fileNode.lines.slice(f.startLine - 1, Math.min(fileNode.lines.length, f.startLine + 6)).join('\n')
              });
            }
          }
        }
      }

      for (const sym of symbols) {
        model.symbols.push(sym);
        model.symbolsById.set(sym.id, sym);
        knownSymbolNames.add(sym.name);

        let byName = model.symbolsByName.get(sym.name);
        if (!byName) {
          byName = [];
          model.symbolsByName.set(sym.name, byName);
        }
        byName.push(sym);

        const lowerName = sym.name.toLowerCase();
        if (lowerName !== sym.name) {
          let byLower = model.symbolsByName.get(lowerName);
          if (!byLower) {
            byLower = [];
            model.symbolsByName.set(lowerName, byLower);
          }
          byLower.push(sym);
        }

        // Add to vocabulary
        const kindWeight = sym.kind === 'class' ? 1.0 : sym.kind === 'function' ? 0.95 : sym.kind === 'route' ? 0.95 : 0.85;
        model.vocabulary.indexEntity(sym.name, {
          entityId: sym.id,
          entityType: 'symbol',
          weight: kindWeight,
          name: sym.name,
          filePath: sym.filePath,
          startLine: sym.startLine,
          endLine: sym.endLine
        });

        // If collection, also index item concepts
        if (sym.kind === 'collection') {
          model.vocabulary.indexEntity(sym.normalizedName.replace(/^[a-z0-9]+_/, ''), {
            entityId: sym.id,
            entityType: 'symbol',
            weight: 0.9,
            name: sym.name,
            filePath: sym.filePath,
            startLine: sym.startLine,
            endLine: sym.endLine
          });
        }
      }
    }

    // 6. Universal Imports & Relationships
    for (const [path, fileNode] of model.files.entries()) {
      if (fileNode.fileType === 'asset' || fileNode.fileType === 'data') continue;

      const fileImports = RelationshipExtractor.extractImports(path, fileNode.lines, fileNode.language);
      for (const imp of fileImports) {
        model.imports.push(imp);
        const modKey = imp.sourceModule.toLowerCase();
        let list = model.importedBy.get(modKey);
        if (!list) {
          list = [];
          model.importedBy.set(modKey, list);
        }
        list.push(imp);

        if (imp.importedSymbol) {
          const symKey = imp.importedSymbol.toLowerCase();
          let symList = model.importedBy.get(symKey);
          if (!symList) {
            symList = [];
            model.importedBy.set(symKey, symList);
          }
          symList.push(imp);
        }
      }

      // Check asset references in lines
      for (let i = 0; i < fileNode.lines.length; i++) {
        const line = fileNode.lines[i];
        for (const [assetPath, assetNode] of model.assets.entries()) {
          if (line.includes(assetNode.filename) || line.includes(assetPath)) {
            assetNode.referencedBy.push({
              filePath: path,
              line: i + 1,
              snippet: line.trim()
            });
          }
        }
      }
    }

    // 7. Universal Calls & Call Graph
    for (const [path, fileNode] of model.files.entries()) {
      if (fileNode.fileType === 'asset' || fileNode.fileType === 'data') continue;

      const callSites = RelationshipExtractor.extractCallSites(path, fileNode.lines, knownSymbolNames);
      for (const cs of callSites) {
        model.calls.push(cs);

        // Map calledBy
        const calleeKey = cs.callee.toLowerCase();
        let calleeList = model.calledBy.get(calleeKey);
        if (!calleeList) {
          calleeList = [];
          model.calledBy.set(calleeKey, calleeList);
        }
        calleeList.push(cs);

        // Map callerMap
        if (cs.callerSymbol) {
          const callerKey = cs.callerSymbol.toLowerCase();
          let callerList = model.callerMap.get(callerKey);
          if (!callerList) {
            callerList = [];
            model.callerMap.set(callerKey, callerList);
          }
          callerList.push(cs);
        }
      }
    }

    // Also integrate structuralIndex call sites if available
    if (workspace.structuralIndex && workspace.pythonAnalysisAvailable) {
      for (const [callee, sites] of (workspace.structuralIndex as any).getAllCallSites?.() || []) {
        const calleeKey = callee.toLowerCase();
        let calleeList = model.calledBy.get(calleeKey);
        if (!calleeList) {
          calleeList = [];
          model.calledBy.set(calleeKey, calleeList);
        }
        for (const s of sites) {
          if (!calleeList.some(c => c.callerFile === s.filePath && c.line === s.line)) {
            calleeList.push({
              callerFile: s.filePath,
              callerSymbol: s.caller,
              callee: s.callee,
              line: s.line,
              snippet: s.snippet || ''
            });
          }
        }
      }
    }

    // 8. Calculate Stats
    model.stats.totalFiles = model.files.size;
    model.stats.totalSymbols = model.symbols.length;
    model.stats.totalClasses = model.symbols.filter(s => s.kind === 'class').length;
    model.stats.totalFunctions = model.symbols.filter(s => s.kind === 'function' || s.kind === 'method').length;
    model.stats.totalRoutes = model.symbols.filter(s => s.kind === 'route').length;
    model.stats.totalConfigs = model.configKeyMap.size;
    model.stats.totalAssets = model.assets.size;
    model.stats.totalDocs = model.docs.size;
    model.stats.totalTests = model.tests.size;
    model.stats.buildTimeMs = Math.round(performance.now() - startTime);

    return model;
  }

  /**
   * Finds a symbol definition by exact or normalized name.
   */
  findSymbol(name: string): SymbolKnowledgeNode | null {
    const direct = this.symbolsByName.get(name);
    if (direct && direct.length > 0) return direct[0];

    const lower = this.symbolsByName.get(name.toLowerCase());
    if (lower && lower.length > 0) return lower[0];

    return null;
  }

  /**
   * Finds all call sites invoking the given symbol.
   */
  findCallers(symbolName: string): ExtractedCallSite[] {
    const list = this.calledBy.get(symbolName.toLowerCase()) || [];
    return list;
  }

  /**
   * Finds all functions/symbols invoked by the given caller symbol.
   */
  findCallees(callerSymbol: string): ExtractedCallSite[] {
    const list = this.callerMap.get(callerSymbol.toLowerCase()) || [];
    return list;
  }

  /**
   * Finds call chain path between two symbols using breadth-first search.
   */
  findCallChain(
    startSymbol: string,
    targetSymbol: string
  ): { pathFound: boolean; steps: Array<{ caller: string; callee: string; file: string; line: number }> } {
    const startKey = startSymbol.toLowerCase();
    const targetKey = targetSymbol.toLowerCase();

    if (startKey === targetKey) {
      return { pathFound: true, steps: [] };
    }

    const queue: Array<{ current: string; path: Array<{ caller: string; callee: string; file: string; line: number }> }> = [
      { current: startKey, path: [] }
    ];
    const visited = new Set<string>([startKey]);

    while (queue.length > 0) {
      const { current, path } = queue.shift()!;
      if (path.length > 8) continue; // Max depth

      const callees = this.callerMap.get(current) || [];
      for (const call of callees) {
        const nextKey = call.callee.toLowerCase();
        const nextStep = {
          caller: current,
          callee: call.callee,
          file: call.callerFile,
          line: call.line
        };
        const newPath = [...path, nextStep];

        if (nextKey === targetKey) {
          return { pathFound: true, steps: newPath };
        }

        if (!visited.has(nextKey)) {
          visited.add(nextKey);
          queue.push({ current: nextKey, path: newPath });
        }
      }
    }

    return { pathFound: false, steps: [] };
  }
}

// Caching layer: one unified knowledge model per workspace instance
const workspaceKnowledgeModelCache = new WeakMap<RepositoryWorkspace, UnifiedRepositoryKnowledgeModel>();

export function getOrCreateKnowledgeModel(workspace: RepositoryWorkspace): UnifiedRepositoryKnowledgeModel {
  let model = workspaceKnowledgeModelCache.get(workspace);
  if (!model) {
    model = UnifiedRepositoryKnowledgeModel.build(workspace);
    workspaceKnowledgeModelCache.set(workspace, model);
  }
  return model;
}
