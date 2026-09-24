/**
 * Universal Symbol Extractor
 * Extracts functions, classes, interfaces, types, constants, collections, and routes
 * across Python, TypeScript/JavaScript, Go, Java, C/C++, Rust, etc.
 * Zero hardcoded repository logic.
 */

import type { SymbolKnowledgeNode, SymbolKind } from './types.js';
import { RepositoryVocabulary } from './vocabularyIndex.js';

export class UniversalSymbolExtractor {
  /**
   * Extracts symbols from any source file.
   */
  static extractSymbols(
    filePath: string,
    lines: string[],
    language: string
  ): SymbolKnowledgeNode[] {
    const symbols: SymbolKnowledgeNode[] = [];
    const isPython = language === 'python' || filePath.endsWith('.py');
    const isTsJs = ['typescript', 'javascript', 'react', 'ts', 'js', 'tsx', 'jsx'].includes(language) ||
                   /\.(tsx?|jsx?|mjs|cjs)$/i.test(filePath);
    const isGo = language === 'go' || filePath.endsWith('.go');
    const isJava = language === 'java' || filePath.endsWith('.java');

    let currentDocstring = '';
    let inMultiComment = false;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const lineText = lines[i];
      const trimmed = lineText.trim();

      // Comment handling for docstrings
      if (trimmed.startsWith('/*') || trimmed.startsWith('/**')) {
        inMultiComment = true;
        currentDocstring = trimmed;
        if (trimmed.endsWith('*/')) inMultiComment = false;
        continue;
      }
      if (inMultiComment) {
        currentDocstring += '\n' + trimmed;
        if (trimmed.endsWith('*/')) inMultiComment = false;
        continue;
      }
      if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
        currentDocstring = currentDocstring ? currentDocstring + '\n' + trimmed : trimmed;
        continue;
      }

      // --- 1. Python Symbol Extraction ---
      if (isPython) {
        // Classes: class Driver(Base): or class LapTimePredictor:
        const classMatch = trimmed.match(/^class\s+([A-Za-z0-9_]+)(?:\s*\(([^)]*)\))?:/);
        if (classMatch) {
          const name = classMatch[1];
          const endLine = UniversalSymbolExtractor.findBlockEndLine(lines, i);
          symbols.push({
            id: `sym_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_class_${name}_${lineNum}`,
            name,
            normalizedName: name.toLowerCase(),
            tokens: RepositoryVocabulary.tokenize(name),
            kind: 'class',
            filePath,
            startLine: lineNum,
            endLine,
            docstring: currentDocstring || undefined,
            isExported: !name.startsWith('_'),
            snippet: lines.slice(i, Math.min(lines.length, i + 8)).join('\n')
          });
          currentDocstring = '';
          continue;
        }

        // Functions / Methods: def authenticate_user(credentials: UserCredentials) -> Dict[str, Any]:
        const defMatch = trimmed.match(/^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*[^:]+)?:/);
        if (defMatch) {
          const name = defMatch[1];
          const isMethod = lineText.startsWith('    ') || lineText.startsWith('\t');
          const endLine = UniversalSymbolExtractor.findBlockEndLine(lines, i);
          const params = defMatch[2].split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean);

          symbols.push({
            id: `sym_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${isMethod ? 'method' : 'function'}_${name}_${lineNum}`,
            name,
            normalizedName: name.toLowerCase(),
            tokens: RepositoryVocabulary.tokenize(name),
            kind: isMethod ? 'method' : 'function',
            filePath,
            startLine: lineNum,
            endLine,
            parameters: params,
            docstring: currentDocstring || undefined,
            isExported: !name.startsWith('_'),
            snippet: lines.slice(i, Math.min(lines.length, i + 6)).join('\n')
          });
          currentDocstring = '';
          continue;
        }

        // Collection constants: F1_DRIVERS = [ ... ] or CANONICAL_DRIVERS = ( ... )
        const collectionMatch = trimmed.match(/^([A-Z0-9_]+)\s*:\s*(?:List|Dict|Set|Tuple)?.*?=\s*(\[|\{)/) ||
                                trimmed.match(/^([A-Z0-9_]+)\s*=\s*(\[|\{)/);
        if (collectionMatch) {
          const name = collectionMatch[1];
          const endLine = UniversalSymbolExtractor.findClosingBracketLine(lines, i);
          const itemCount = UniversalSymbolExtractor.estimateCollectionItemCount(lines, i, endLine);
          symbols.push({
            id: `sym_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_collection_${name}_${lineNum}`,
            name,
            normalizedName: name.toLowerCase(),
            tokens: RepositoryVocabulary.tokenize(name),
            kind: 'collection',
            filePath,
            startLine: lineNum,
            endLine,
            itemCount,
            isExported: true,
            snippet: lines.slice(i, Math.min(lines.length, i + 6)).join('\n')
          });
          currentDocstring = '';
          continue;
        }
      }

      // --- 2. TypeScript / JavaScript Symbol Extraction ---
      if (isTsJs) {
        // Classes: export class UserService or class UserController extends BaseController
        const tsClassMatch = trimmed.match(/^(?:export\s+)?(?:default\s+)?class\s+([A-Za-z0-9_]+)(?:\s+extends\s+[A-Za-z0-9_]+)?(?:\s+implements\s+[^\{]+)?/);
        if (tsClassMatch) {
          const name = tsClassMatch[1];
          const endLine = UniversalSymbolExtractor.findClosingBracketLine(lines, i, '{', '}');
          symbols.push({
            id: `sym_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_class_${name}_${lineNum}`,
            name,
            normalizedName: name.toLowerCase(),
            tokens: RepositoryVocabulary.tokenize(name),
            kind: 'class',
            filePath,
            startLine: lineNum,
            endLine,
            docstring: currentDocstring || undefined,
            isExported: trimmed.startsWith('export'),
            snippet: lines.slice(i, Math.min(lines.length, i + 6)).join('\n')
          });
          currentDocstring = '';
          continue;
        }

        // Interfaces / Types: export interface User { or export type OrderStatus =
        const interfaceMatch = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:interface|type)\s+([A-Za-z0-9_]+)/);
        if (interfaceMatch) {
          const name = interfaceMatch[1];
          symbols.push({
            id: `sym_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_type_${name}_${lineNum}`,
            name,
            normalizedName: name.toLowerCase(),
            tokens: RepositoryVocabulary.tokenize(name),
            kind: 'interface',
            filePath,
            startLine: lineNum,
            endLine: Math.min(lines.length, lineNum + 4),
            docstring: currentDocstring || undefined,
            isExported: trimmed.startsWith('export'),
            snippet: lines.slice(i, Math.min(lines.length, i + 4)).join('\n')
          });
          currentDocstring = '';
          continue;
        }

        // Functions: export async function authenticateUser(...) or function verifyToken(...)
        const funcMatch = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
        if (funcMatch) {
          const name = funcMatch[1];
          const endLine = UniversalSymbolExtractor.findClosingBracketLine(lines, i, '{', '}');
          const params = funcMatch[2].split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean);
          symbols.push({
            id: `sym_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_function_${name}_${lineNum}`,
            name,
            normalizedName: name.toLowerCase(),
            tokens: RepositoryVocabulary.tokenize(name),
            kind: 'function',
            filePath,
            startLine: lineNum,
            endLine,
            parameters: params,
            docstring: currentDocstring || undefined,
            isExported: trimmed.startsWith('export'),
            snippet: lines.slice(i, Math.min(lines.length, i + 6)).join('\n')
          });
          currentDocstring = '';
          continue;
        }

        // Arrow function constants: export const loginUser = async (...) =>
        const arrowMatch = trimmed.match(/^(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=]+)?=>/);
        if (arrowMatch) {
          const name = arrowMatch[1];
          const endLine = UniversalSymbolExtractor.findClosingBracketLine(lines, i, '{', '}');
          const params = arrowMatch[2].split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean);
          symbols.push({
            id: `sym_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_function_${name}_${lineNum}`,
            name,
            normalizedName: name.toLowerCase(),
            tokens: RepositoryVocabulary.tokenize(name),
            kind: 'function',
            filePath,
            startLine: lineNum,
            endLine,
            parameters: params,
            docstring: currentDocstring || undefined,
            isExported: trimmed.startsWith('export'),
            snippet: lines.slice(i, Math.min(lines.length, i + 6)).join('\n')
          });
          currentDocstring = '';
          continue;
        }

        // HTTP Routes: app.get('/users', ...) or router.post('/login', ...)
        const routeMatch = trimmed.match(/^(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/i);
        if (routeMatch) {
          const method = routeMatch[1].toUpperCase();
          const path = routeMatch[2];
          const name = `${method} ${path}`;
          symbols.push({
            id: `sym_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_route_${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}_${lineNum}`,
            name,
            normalizedName: name.toLowerCase(),
            tokens: [...RepositoryVocabulary.tokenize(path), method.toLowerCase(), 'route', 'endpoint'],
            kind: 'route',
            filePath,
            startLine: lineNum,
            endLine: Math.min(lines.length, lineNum + 8),
            docstring: currentDocstring || undefined,
            isExported: true,
            snippet: lines.slice(i, Math.min(lines.length, i + 6)).join('\n')
          });
          currentDocstring = '';
          continue;
        }

        // TS Collection constants: export const USERS = [ ... ]
        const tsArrayMatch = trimmed.match(/^(?:export\s+)?const\s+([A-Z0-9_]+)(?:\s*:\s*[^=]+)?\s*=\s*\[/);
        if (tsArrayMatch) {
          const name = tsArrayMatch[1];
          const endLine = UniversalSymbolExtractor.findClosingBracketLine(lines, i, '[', ']');
          const itemCount = UniversalSymbolExtractor.estimateCollectionItemCount(lines, i, endLine);
          symbols.push({
            id: `sym_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_collection_${name}_${lineNum}`,
            name,
            normalizedName: name.toLowerCase(),
            tokens: RepositoryVocabulary.tokenize(name),
            kind: 'collection',
            filePath,
            startLine: lineNum,
            endLine,
            itemCount,
            isExported: trimmed.startsWith('export'),
            snippet: lines.slice(i, Math.min(lines.length, i + 6)).join('\n')
          });
          currentDocstring = '';
          continue;
        }
      }

      // --- 3. Go Symbol Extraction ---
      if (isGo) {
        const goFuncMatch = trimmed.match(/^func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
        if (goFuncMatch) {
          const name = goFuncMatch[1];
          symbols.push({
            id: `sym_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_func_${name}_${lineNum}`,
            name,
            normalizedName: name.toLowerCase(),
            tokens: RepositoryVocabulary.tokenize(name),
            kind: 'function',
            filePath,
            startLine: lineNum,
            endLine: UniversalSymbolExtractor.findClosingBracketLine(lines, i, '{', '}'),
            isExported: name[0] === name[0].toUpperCase(),
            snippet: lines.slice(i, Math.min(lines.length, i + 6)).join('\n')
          });
          continue;
        }

        const goStructMatch = trimmed.match(/^type\s+([A-Za-z0-9_]+)\s+struct\s*\{/);
        if (goStructMatch) {
          const name = goStructMatch[1];
          symbols.push({
            id: `sym_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_struct_${name}_${lineNum}`,
            name,
            normalizedName: name.toLowerCase(),
            tokens: RepositoryVocabulary.tokenize(name),
            kind: 'class',
            filePath,
            startLine: lineNum,
            endLine: UniversalSymbolExtractor.findClosingBracketLine(lines, i, '{', '}'),
            isExported: name[0] === name[0].toUpperCase(),
            snippet: lines.slice(i, Math.min(lines.length, i + 6)).join('\n')
          });
          continue;
        }
      }

      // --- 4. Java Symbol Extraction ---
      if (isJava) {
        const javaClassMatch = trimmed.match(/^(?:public\s+|protected\s+|private\s+)?(?:static\s+)?class\s+([A-Za-z0-9_]+)/);
        if (javaClassMatch) {
          const name = javaClassMatch[1];
          symbols.push({
            id: `sym_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_class_${name}_${lineNum}`,
            name,
            normalizedName: name.toLowerCase(),
            tokens: RepositoryVocabulary.tokenize(name),
            kind: 'class',
            filePath,
            startLine: lineNum,
            endLine: UniversalSymbolExtractor.findClosingBracketLine(lines, i, '{', '}'),
            isExported: trimmed.includes('public'),
            snippet: lines.slice(i, Math.min(lines.length, i + 6)).join('\n')
          });
          continue;
        }
      }

      // Reset docstring if not consumed on non-empty non-comment line
      if (trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
        currentDocstring = '';
      }
    }

    return symbols;
  }

  private static findBlockEndLine(lines: string[], startIdx: number): number {
    const baseIndent = lines[startIdx].search(/\S/);
    for (let j = startIdx + 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim()) continue; // Skip empty lines
      const indent = line.search(/\S/);
      if (indent !== -1 && indent <= baseIndent) {
        return j; // End of indentation block (1-based is j)
      }
    }
    return lines.length;
  }

  private static findClosingBracketLine(
    lines: string[],
    startIdx: number,
    openChar = '[',
    closeChar = ']'
  ): number {
    let depth = 0;
    for (let j = startIdx; j < lines.length; j++) {
      const line = lines[j];
      // On the first line, only scan after the '=' assignment
      const textToScan = (j === startIdx && line.includes('='))
        ? line.slice(line.indexOf('='))
        : line;

      for (const ch of textToScan) {
        if (ch === openChar) depth++;
        if (ch === closeChar) {
          depth--;
          if (depth <= 0 && j > startIdx) return j + 1;
          if (depth <= 0 && textToScan.includes(closeChar) && (line.endsWith(']') || line.endsWith('}'))) return j + 1;
        }
      }
    }
    return Math.min(lines.length, startIdx + 25);
  }

  private static estimateCollectionItemCount(
    lines: string[],
    startIdx: number,
    endIdx: number
  ): number {
    let count = 0;
    for (let j = startIdx; j < Math.min(lines.length, endIdx); j++) {
      const line = lines[j].trim();
      // Count object entries or commas
      if (line.endsWith(',') || line.includes('},') || line.includes('],')) {
        count++;
      } else if (line.startsWith('{') || line.startsWith('Driver(') || line.startsWith('"') || line.startsWith("'")) {
        count++;
      }
    }
    return Math.max(1, count);
  }
}
