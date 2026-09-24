/**
 * Code-Aware Chunking Engine
 * Uses Phase 2 StructuralIndex for Python and language-aware boundary parsing for non-Python files.
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 */

import type { CodeChunk } from '../../types/retrieval.js';
import type { RepositoryFile } from '../../types/index.js';
import { StructuralIndex } from '../structural/structuralIndex.js';

/**
 * Validates that a chunk's line boundaries and text correspond exactly to reality.
 */
export function validateChunk(chunk: CodeChunk, fileLines?: string[]): { isValid: boolean; error?: string } {
  if (!chunk.filePath || typeof chunk.filePath !== 'string') {
    return { isValid: false, error: 'Chunk missing valid filePath' };
  }
  if (!chunk.language || typeof chunk.language !== 'string') {
    return { isValid: false, error: 'Chunk missing valid language' };
  }
  if (typeof chunk.startLine !== 'number' || isNaN(chunk.startLine) || chunk.startLine <= 0) {
    return { isValid: false, error: `Invalid startLine: ${chunk.startLine}` };
  }
  if (typeof chunk.endLine !== 'number' || isNaN(chunk.endLine) || chunk.endLine < chunk.startLine) {
    return { isValid: false, error: `Invalid endLine: ${chunk.endLine} (startLine: ${chunk.startLine})` };
  }
  if (typeof chunk.sourceText !== 'string') {
    return { isValid: false, error: 'Chunk missing valid sourceText' };
  }

  // Exact correspondence check against underlying file lines
  if (fileLines) {
    const totalLines = fileLines.length;
    if (chunk.startLine > totalLines || chunk.endLine > totalLines) {
      return { isValid: false, error: `Chunk lines [${chunk.startLine}, ${chunk.endLine}] exceed total lines ${totalLines}` };
    }
    const expected = fileLines.slice(chunk.startLine - 1, chunk.endLine).join('\n');
    if (expected !== chunk.sourceText) {
      return { isValid: false, error: `Chunk sourceText does not match repository lines ${chunk.startLine}–${chunk.endLine} in ${chunk.filePath}` };
    }
  }

  return { isValid: true };
}

/**
 * Builds intelligent, semantic-boundary chunks for an entire repository.
 */
export function buildRepositoryChunks(
  files: RepositoryFile[],
  structuralIndex?: StructuralIndex
): CodeChunk[] {
  const allChunks: CodeChunk[] = [];

  for (const file of files) {
    if (!file.lines || file.lines.length === 0) continue;

    // Use AST structural chunking for both JavaScript and Python
    const isJsLike = StructuralIndex.isJsLike(file);
    const hasStructure = structuralIndex && (file.isPython || isJsLike) && structuralIndex.getFileStructure(file.path);

    const rawChunks = hasStructure
      ? chunkStructuredSourceFile(file, structuralIndex!)
      : chunkNonPythonFile(file);

    for (const chunk of rawChunks) {
      const validation = validateChunk(chunk, file.lines);
      if (validation.isValid) {
        allChunks.push(chunk);
      } else {
        console.warn(`[Chunker] Rejected invalid chunk ${chunk.id} in ${chunk.filePath}: ${validation.error}`);
      }
    }
  }

  return allChunks;
}

/**
 * Creates structural code chunks for JavaScript/TypeScript and Python files using the AST index.
 */
export function chunkStructuredSourceFile(
  file: RepositoryFile,
  structuralIndex: StructuralIndex
): CodeChunk[] {
  const isJs = StructuralIndex.isJsLike(file);
  const langName = isJs ? 'JavaScript' : 'Python';
  const prefix = isJs ? 'js' : 'py';
  const chunks: CodeChunk[] = [];
  const fileStructure = structuralIndex.getFileStructure(file.path);
  const fileImports = fileStructure?.imports.map(i => 
    isJs 
      ? (i.isFromImport ? `import { ${i.importedName} } from '${i.sourceModule}'` : `import '${i.sourceModule}'`)
      : (i.isFromImport ? `from ${i.sourceModule} import ${i.importedName}` : `import ${i.sourceModule}`)
  ) || [];

  const lines = file.lines;
  const totalLines = lines.length;
  if (totalLines === 0) return [];

  // 1. Module chunk (top-level summary, docstring, imports)
  const modEnd = Math.min(25, totalLines);
  const moduleSummary = lines.slice(0, modEnd).join('\n');
  chunks.push({
    id: `${prefix}_mod_${file.path}`,
    filePath: file.path,
    language: langName,
    symbolType: 'module',
    symbolName: file.path.split('/').pop() || file.path,
    startLine: 1,
    endLine: modEnd,
    sourceText: moduleSummary,
    relatedImports: fileImports,
    surroundingContext: `Module: ${file.path}\nImports: ${fileImports.join(', ')}`
  });

  if (fileStructure) {
    // 2. Class chunks
    for (const cls of fileStructure.classes) {
      const start = Math.max(1, cls.startLine);
      const end = Math.min(totalLines, Math.max(start, cls.endLine));
      const sourceSlice = lines.slice(start - 1, end).join('\n');

      chunks.push({
        id: `${prefix}_cls_${file.path}_${cls.name}_${start}`,
        filePath: file.path,
        language: langName,
        symbolType: 'class',
        symbolName: cls.name,
        startLine: start,
        endLine: end,
        sourceText: sourceSlice,
        docstring: cls.docstring,
        relatedImports: fileImports,
        surroundingContext: `Class: ${cls.name} (${cls.baseClasses.join(', ') || 'object'})\nMethods: ${cls.methods.join(', ')}`
      });

      // 3. Method chunks within classes
      const classMethods = fileStructure.methods.filter(m => m.className === cls.name);
      for (const meth of classMethods) {
        const mStart = Math.max(1, meth.startLine);
        const mEnd = Math.min(totalLines, Math.max(mStart, meth.endLine));
        const mSlice = lines.slice(mStart - 1, mEnd).join('\n');

        chunks.push({
          id: `${prefix}_meth_${file.path}_${cls.name}_${meth.name}_${mStart}`,
          filePath: file.path,
          language: langName,
          symbolType: 'method',
          symbolName: `${cls.name}.${meth.name}`,
          startLine: mStart,
          endLine: mEnd,
          parentClass: cls.name,
          sourceText: mSlice,
          docstring: meth.docstring,
          parameters: meth.parameters,
          relatedImports: fileImports,
          surroundingContext: `Method in class ${cls.name}: ${meth.name}(${meth.parameters ? meth.parameters.join(', ') : ''})`
        });
      }
    }

    // 4. Standalone Top-Level Functions
    for (const fn of fileStructure.functions) {
      const fStart = Math.max(1, fn.startLine);
      const fEnd = Math.min(totalLines, Math.max(fStart, fn.endLine));
      const fSlice = lines.slice(fStart - 1, fEnd).join('\n');

      chunks.push({
        id: `${prefix}_fn_${file.path}_${fn.name}_${fStart}`,
        filePath: file.path,
        language: langName,
        symbolType: 'function',
        symbolName: fn.name,
        startLine: fStart,
        endLine: fEnd,
        sourceText: fSlice,
        docstring: fn.docstring,
        parameters: fn.parameters,
        relatedImports: fileImports,
        surroundingContext: `Function: ${fn.name}(${fn.parameters ? fn.parameters.join(', ') : ''}) in ${file.path}`
      });
    }
  }

  // If no classes or functions were found, create safe block chunks
  if (chunks.length <= 1 && totalLines > 0) {
    const fallbackBlocks = chunkByParagraphs(file, langName);
    chunks.push(...fallbackBlocks);
  }

  return chunks;
}

export function chunkPythonFile(
  file: RepositoryFile,
  structuralIndex: StructuralIndex
): CodeChunk[] {
  return chunkStructuredSourceFile(file, structuralIndex);
}

/**
 * Creates language-aware chunks for non-Python files.
 */
export function chunkNonPythonFile(file: RepositoryFile): CodeChunk[] {
  const lang = file.language.toLowerCase();

  switch (lang) {
    case 'typescript':
    case 'ts':
    case 'tsx':
    case 'javascript':
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
    case 'java':
    case 'c':
    case 'cpp':
    case 'c++':
    case 'c#':
    case 'csharp':
    case 'go':
    case 'rust':
      return chunkJavaScriptFamily(file);

    case 'markdown':
    case 'md':
      return chunkMarkdown(file);

    case 'html':
    case 'htm':
    case 'xml':
    case 'svg':
      return chunkHtml(file);

    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return chunkCss(file);

    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
      return chunkStructuredConfig(file);

    case 'csv':
    case 'tsv':
      return chunkCsv(file);

    default:
      return chunkByParagraphs(file, file.language);
  }
}

/**
 * Structure-aware chunking for TypeScript / JavaScript files.
 * Identifies function, class, and export declarations.
 */
function chunkJavaScriptFamily(file: RepositoryFile): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = file.lines;
  const total = lines.length;

  if (total === 0) return [];

  const declarationRegex = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?\s+([a-zA-Z0-9_$]+)|class\s+([a-zA-Z0-9_$]+)|const\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\()/;

  let currentStart = -1;
  let currentSymbol = '';
  let currentType: 'function' | 'class' | 'block' = 'function';
  let braceCount = 0;

  for (let i = 0; i < total; i++) {
    const line = lines[i];
    const match = line.match(declarationRegex);

    if (match && braceCount === 0) {
      // If we had a previous chunk waiting, finalize it
      if (currentStart !== -1 && i > currentStart) {
        chunks.push({
          id: `js_${file.path}_${currentSymbol}_${currentStart + 1}`,
          filePath: file.path,
          language: file.language,
          symbolType: currentType,
          symbolName: currentSymbol,
          startLine: currentStart + 1,
          endLine: i,
          sourceText: lines.slice(currentStart, i).join('\n')
        });
      }

      currentStart = i;
      currentSymbol = match[1] || match[2] || match[3] || 'anonymous';
      currentType = match[2] ? 'class' : 'function';
      braceCount = 0;
    }

    // Track braces
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;
    braceCount += (openBraces - closeBraces);

    if (currentStart !== -1 && braceCount <= 0 && (openBraces > 0 || closeBraces > 0)) {
      chunks.push({
        id: `js_${file.path}_${currentSymbol}_${currentStart + 1}`,
        filePath: file.path,
        language: file.language,
        symbolType: currentType,
        symbolName: currentSymbol,
        startLine: currentStart + 1,
        endLine: i + 1,
        sourceText: lines.slice(currentStart, i + 1).join('\n')
      });
      currentStart = -1;
      currentSymbol = '';
      braceCount = 0;
    }
  }

  // Finalize remaining lines
  if (currentStart !== -1 && currentStart < total) {
    chunks.push({
      id: `js_${file.path}_${currentSymbol || 'tail'}_${currentStart + 1}`,
      filePath: file.path,
      language: file.language,
      symbolType: currentType,
      symbolName: currentSymbol || 'module',
      startLine: currentStart + 1,
      endLine: total,
      sourceText: lines.slice(currentStart, total).join('\n')
    });
  }

  // If no declarations matched, fallback to safe paragraph chunking
  if (chunks.length === 0) {
    return chunkByParagraphs(file, file.language);
  }

  return chunks;
}

/**
 * Structure-aware chunking for Markdown by heading sections.
 */
function chunkMarkdown(file: RepositoryFile): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = file.lines;
  const total = lines.length;

  let currentHeading = 'Overview';
  let sectionStart = 0;

  for (let i = 0; i < total; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,4})\s+(.+)$/);

    if (match) {
      if (i > sectionStart) {
        chunks.push({
          id: `md_${file.path}_${sectionStart + 1}`,
          filePath: file.path,
          language: 'Markdown',
          symbolType: 'section',
          symbolName: currentHeading,
          startLine: sectionStart + 1,
          endLine: i,
          sourceText: lines.slice(sectionStart, i).join('\n')
        });
      }
      currentHeading = match[2].trim();
      sectionStart = i;
    }
  }

  if (sectionStart < total) {
    chunks.push({
      id: `md_${file.path}_${sectionStart + 1}`,
      filePath: file.path,
      language: 'Markdown',
      symbolType: 'section',
      symbolName: currentHeading,
      startLine: sectionStart + 1,
      endLine: total,
      sourceText: lines.slice(sectionStart, total).join('\n')
    });
  }

  return chunks;
}

/**
 * Structure-aware chunking for HTML major elements.
 */
function chunkHtml(file: RepositoryFile): CodeChunk[] {
  const lines = file.lines;
  const total = lines.length;
  const chunks: CodeChunk[] = [];

  const sectionRegex = /<(main|section|article|header|nav|form|div\s+id=["']([^"']+)["'])/i;
  let sectionStart = -1;
  let sectionTag = '';

  for (let i = 0; i < total; i++) {
    const match = lines[i].match(sectionRegex);
    if (match) {
      if (sectionStart !== -1 && i > sectionStart) {
        chunks.push({
          id: `html_${file.path}_${sectionStart + 1}`,
          filePath: file.path,
          language: 'HTML',
          symbolType: 'section',
          symbolName: `<${sectionTag}>`,
          startLine: sectionStart + 1,
          endLine: i,
          sourceText: lines.slice(sectionStart, i).join('\n')
        });
      }
      sectionStart = i;
      sectionTag = match[2] ? `#${match[2]}` : match[1];
    }
  }

  if (sectionStart !== -1 && sectionStart < total) {
    chunks.push({
      id: `html_${file.path}_${sectionStart + 1}`,
      filePath: file.path,
      language: 'HTML',
      symbolType: 'section',
      symbolName: `<${sectionTag}>`,
      startLine: sectionStart + 1,
      endLine: total,
      sourceText: lines.slice(sectionStart, total).join('\n')
    });
  }

  if (chunks.length === 0) {
    return chunkByParagraphs(file, 'HTML');
  }

  return chunks;
}

/**
 * Structure-aware chunking for CSS / SCSS rule blocks.
 */
function chunkCss(file: RepositoryFile): CodeChunk[] {
  const lines = file.lines;
  const total = lines.length;
  const chunks: CodeChunk[] = [];

  let start = -1;
  let selector = '';

  for (let i = 0; i < total; i++) {
    const line = lines[i].trim();
    if (line.includes('{') && start === -1) {
      start = i;
      selector = line.split('{')[0].trim() || 'rule';
    }
    if (line.includes('}') && start !== -1) {
      chunks.push({
        id: `css_${file.path}_${start + 1}`,
        filePath: file.path,
        language: file.language,
        symbolType: 'rule',
        symbolName: selector,
        startLine: start + 1,
        endLine: i + 1,
        sourceText: lines.slice(start, i + 1).join('\n')
      });
      start = -1;
      selector = '';
    }
  }

  if (chunks.length === 0) {
    return chunkByParagraphs(file, file.language);
  }

  return chunks;
}

/**
 * Structure-aware chunking for JSON / YAML top-level objects.
 */
function chunkStructuredConfig(file: RepositoryFile): CodeChunk[] {
  const lines = file.lines;
  const total = lines.length;
  const chunks: CodeChunk[] = [];

  // Break YAML or JSON by top-level keys
  const topKeyRegex = /^([a-zA-Z0-9_-]+):|^"([a-zA-Z0-9_-]+)":/;
  let currentStart = 0;
  let currentKey = 'root';

  for (let i = 0; i < total; i++) {
    const match = lines[i].match(topKeyRegex);
    if (match && i > 0) {
      chunks.push({
        id: `cfg_${file.path}_${currentStart + 1}`,
        filePath: file.path,
        language: file.language,
        symbolType: 'config_block',
        symbolName: currentKey,
        startLine: currentStart + 1,
        endLine: i,
        sourceText: lines.slice(currentStart, i).join('\n')
      });
      currentStart = i;
      currentKey = match[1] || match[2] || 'key';
    }
  }

  if (currentStart < total) {
    chunks.push({
      id: `cfg_${file.path}_${currentStart + 1}`,
      filePath: file.path,
      language: file.language,
      symbolType: 'config_block',
      symbolName: currentKey,
      startLine: currentStart + 1,
      endLine: total,
      sourceText: lines.slice(currentStart, total).join('\n')
    });
  }

  return chunks;
}

/**
 * Chunking for CSV data files (dataset header + sample rows).
 */
function chunkCsv(file: RepositoryFile): CodeChunk[] {
  const lines = file.lines;
  const total = lines.length;
  if (total === 0) return [];

  const header = lines[0];
  const sampleSlice = lines.slice(0, Math.min(50, total)).join('\n');

  return [{
    id: `csv_${file.path}_1`,
    filePath: file.path,
    language: 'CSV',
    symbolType: 'data_sample',
    symbolName: `dataset (${total - 1} rows)`,
    startLine: 1,
    endLine: Math.min(50, total),
    sourceText: sampleSlice,
    surroundingContext: `CSV Dataset Header: ${header}\nTotal rows: ${total - 1}`
  }];
}

/**
 * Safe paragraph-based fallback chunking for unsupported or unparsed formats.
 * Clearly records limitation as safe text blocks without claiming AST parsing.
 */
function chunkByParagraphs(file: RepositoryFile, language: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = file.lines;
  const total = lines.length;

  if (total === 0) return [];

  const chunkSize = 35;
  let i = 0;

  while (i < total) {
    const start = i + 1;
    const end = Math.min(total, i + chunkSize);
    const text = lines.slice(i, end).join('\n');

    chunks.push({
      id: `blk_${file.path}_${start}`,
      filePath: file.path,
      language,
      symbolType: 'block',
      symbolName: `lines ${start}–${end}`,
      startLine: start,
      endLine: end,
      sourceText: text,
      surroundingContext: `Safe text-based chunk in ${file.path} (no AST parser applied)`
    });

    i += (chunkSize - 5); // 5-line overlap
  }

  return chunks;
}
