/**
 * Universal Relationship Extractor
 * Extracts imports, call sites, references, inheritance, and asset links across languages.
 * Zero hardcoded repository logic.
 */

import type { RelationshipEdge } from './types.js';

export interface ExtractedCallSite {
  callerFile: string;
  callerSymbol?: string;
  callee: string;
  line: number;
  snippet: string;
}

export interface ExtractedImport {
  sourceFile: string;
  importedSymbol?: string;
  sourceModule: string;
  line: number;
  snippet: string;
}

export class RelationshipExtractor {
  /**
   * Extracts static imports from any source file.
   */
  static extractImports(filePath: string, lines: string[], language: string): ExtractedImport[] {
    const imports: ExtractedImport[] = [];
    const isPy = language === 'python' || filePath.endsWith('.py');
    const isTsJs = ['typescript', 'javascript', 'react', 'ts', 'js', 'tsx', 'jsx'].includes(language) ||
                   /\.(tsx?|jsx?|mjs|cjs)$/i.test(filePath);

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const lineText = lines[i];
      const trimmed = lineText.trim();

      // Python: from models.driver import Driver, F1_DRIVERS or import os
      if (isPy) {
        const fromMatch = trimmed.match(/^from\s+([A-Za-z0-9_.]+)\s+import\s+(.+)$/);
        if (fromMatch) {
          const mod = fromMatch[1];
          const rawSymbols = fromMatch[2].split(',');
          for (const s of rawSymbols) {
            const sym = s.trim().split(/\s+as\s+/)[0].trim();
            if (sym && sym !== '(' && sym !== ')') {
              imports.push({
                sourceFile: filePath,
                sourceModule: mod,
                importedSymbol: sym,
                line: lineNum,
                snippet: trimmed
              });
            }
          }
          continue;
        }

        const importMatch = trimmed.match(/^import\s+([A-Za-z0-9_.]+)/);
        if (importMatch) {
          imports.push({
            sourceFile: filePath,
            sourceModule: importMatch[1],
            line: lineNum,
            snippet: trimmed
          });
          continue;
        }
      }

      // TypeScript / JavaScript: import { Driver } from './driver.js' or const auth = require('./auth')
      if (isTsJs) {
        const esmMatch = trimmed.match(/^import\s+(?:\{([^}]+)\}|([A-Za-z0-9_]+))\s+from\s+['"`]([^'"`]+)['"`]/);
        if (esmMatch) {
          const mod = esmMatch[3];
          if (esmMatch[1]) {
            const symbols = esmMatch[1].split(',');
            for (const s of symbols) {
              const sym = s.trim().split(/\s+as\s+/)[0].trim();
              if (sym) {
                imports.push({
                  sourceFile: filePath,
                  sourceModule: mod,
                  importedSymbol: sym,
                  line: lineNum,
                  snippet: trimmed
                });
              }
            }
          } else if (esmMatch[2]) {
            imports.push({
              sourceFile: filePath,
              sourceModule: mod,
              importedSymbol: esmMatch[2].trim(),
              line: lineNum,
              snippet: trimmed
            });
          }
          continue;
        }

        const cjsMatch = trimmed.match(/const\s+(?:\{([^}]+)\}|([A-Za-z0-9_]+))\s*=\s*require\(['"`]([^'"`]+)['"`]\)/);
        if (cjsMatch) {
          const mod = cjsMatch[3];
          if (cjsMatch[1]) {
            const symbols = cjsMatch[1].split(',');
            for (const s of symbols) {
              const sym = s.trim().split(/\s+as\s+/)[0].trim();
              if (sym) {
                imports.push({
                  sourceFile: filePath,
                  sourceModule: mod,
                  importedSymbol: sym,
                  line: lineNum,
                  snippet: trimmed
                });
              }
            }
          } else if (cjsMatch[2]) {
            imports.push({
              sourceFile: filePath,
              sourceModule: mod,
              importedSymbol: cjsMatch[2].trim(),
              line: lineNum,
              snippet: trimmed
            });
          }
          continue;
        }
      }
    }

    return imports;
  }

  /**
   * Extracts static call sites from source code.
   */
  static extractCallSites(
    filePath: string,
    lines: string[],
    knownSymbols: Set<string>
  ): ExtractedCallSite[] {
    const callSites: ExtractedCallSite[] = [];
    let currentEnclosingFunction: string | undefined = undefined;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const lineText = lines[i];
      const trimmed = lineText.trim();

      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('*')) {
        continue;
      }

      // Track enclosing function / method
      const funcDefMatch = trimmed.match(/^(?:async\s+)?(?:def|function)\s+([A-Za-z0-9_]+)/) ||
                           trimmed.match(/^(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/);
      if (funcDefMatch) {
        currentEnclosingFunction = funcDefMatch[1];
        continue;
      }

      // Detect function calls: fnName(...) or obj.methodName(...)
      const callMatches = trimmed.matchAll(/(?:(?:\b([A-Za-z0-9_]+)\.)?\b([A-Za-z0-9_]{3,})\s*\()/g);
      for (const m of callMatches) {
        const callee = m[2];
        // Ignore keywords
        if (['if', 'while', 'for', 'switch', 'catch', 'return', 'print', 'console', 'sizeof', 'typeof', 'expect'].includes(callee)) {
          continue;
        }

        // If known symbol or standard invocation
        if (knownSymbols.has(callee) || knownSymbols.has(callee.toLowerCase())) {
          callSites.push({
            callerFile: filePath,
            callerSymbol: currentEnclosingFunction,
            callee,
            line: lineNum,
            snippet: trimmed
          });
        }
      }
    }

    return callSites;
  }
}
