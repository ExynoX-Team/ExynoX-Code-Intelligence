/**
 * JavaScript Module and File Dependency Resolver
 * Resolves ES modules, CommonJS require(), relative paths, and index files.
 * Samsung PRISM GenAI Hackathon (Theme 1: Agentic Code Intelligence)
 */

export interface ResolvedModule {
  targetPath: string | null;
  isExternal: boolean;
  rawModule: string;
}

const JS_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json'];

/**
 * Normalizes a repository file path (forward slashes, no leading ./)
 */
export function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Resolves an imported module path relative to the importing file against known repository files.
 *
 * Examples:
 * - './login.js' from 'src/auth/index.js' -> 'src/auth/login.js'
 * - '../utils' from 'src/auth/login.js' -> 'src/utils.js' or 'src/utils/index.js'
 * - 'express' -> { isExternal: true, targetPath: null }
 */
export function resolveModulePath(
  sourceModule: string,
  importingFilePath: string,
  knownFiles: string[] | Set<string>
): ResolvedModule {
  const fileSet = knownFiles instanceof Set ? knownFiles : new Set(knownFiles.map(normalizeRepoPath));
  const raw = sourceModule.trim();

  // If not relative (starts with . or ..) or absolute, consider external package
  if (!raw.startsWith('.') && !raw.startsWith('/')) {
    return {
      targetPath: null,
      isExternal: true,
      rawModule: raw
    };
  }

  // Determine current directory
  const normalizedImporting = normalizeRepoPath(importingFilePath);
  const slashIdx = normalizedImporting.lastIndexOf('/');
  const currentDir = slashIdx !== -1 ? normalizedImporting.slice(0, slashIdx) : '';

  // Resolve path segments
  const combined = currentDir ? `${currentDir}/${raw}` : raw;
  const segments = combined.split('/');
  const resolvedSegments: string[] = [];

  for (const seg of segments) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      resolvedSegments.pop();
    } else {
      resolvedSegments.push(seg);
    }
  }

  const basePath = resolvedSegments.join('/');

  // 1. Direct match
  if (fileSet.has(basePath)) {
    return {
      targetPath: basePath,
      isExternal: false,
      rawModule: raw
    };
  }

  // 2. Try file extensions
  for (const ext of JS_EXTENSIONS) {
    const candidate = `${basePath}${ext}`;
    if (fileSet.has(candidate)) {
      return {
        targetPath: candidate,
        isExternal: false,
        rawModule: raw
      };
    }
  }

  // 3. Try directory index (e.g. ./utils -> utils/index.js)
  for (const ext of JS_EXTENSIONS) {
    const candidate = `${basePath}/index${ext}`;
    if (fileSet.has(candidate)) {
      return {
        targetPath: candidate,
        isExternal: false,
        rawModule: raw
      };
    }
  }

  return {
    targetPath: null,
    isExternal: false,
    rawModule: raw
  };
}

/**
 * Resolves an imported symbol to its target file and original symbol name.
 */
export function resolveImportBinding(
  sourceModule: string,
  importedName: string,
  importingFilePath: string,
  knownFiles: string[] | Set<string>
): { resolvedFilePath: string | null; targetSymbol: string; isExternal: boolean } {
  const resolved = resolveModulePath(sourceModule, importingFilePath, knownFiles);
  return {
    resolvedFilePath: resolved.targetPath,
    targetSymbol: importedName,
    isExternal: resolved.isExternal
  };
}

/**
 * Builds a forward dependency graph: file -> files it imports
 */
export function buildDependencyGraph(
  files: { filePath: string; imports: { sourceModule: string }[] }[],
  allRepoFiles: string[]
): Map<string, Set<string>> {
  const fileSet = new Set(allRepoFiles.map(normalizeRepoPath));
  const graph = new Map<string, Set<string>>();

  for (const f of files) {
    const normPath = normalizeRepoPath(f.filePath);
    if (!graph.has(normPath)) {
      graph.set(normPath, new Set());
    }

    for (const imp of f.imports) {
      const resolved = resolveModulePath(imp.sourceModule, normPath, fileSet);
      if (resolved.targetPath) {
        graph.get(normPath)!.add(resolved.targetPath);
      }
    }
  }

  return graph;
}
