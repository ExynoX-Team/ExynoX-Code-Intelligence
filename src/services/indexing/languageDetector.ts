/**
 * Language and File Type Detector for Repository-Wide Analysis
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 */

import type { FileCategory, FileMetadata } from '../../types/retrieval.js';

export interface LanguageSpec {
  language: string;
  category: FileCategory;
  extensions: string[];
  filenames?: string[];
  singleLineComments?: string[];
  multiLineCommentPairs?: [string, string][];
  isSourceCode: boolean;
  isData: boolean;
  isDocumentation: boolean;
  isConfiguration: boolean;
}

// Registry of supported languages and file types
const LANGUAGE_REGISTRY: LanguageSpec[] = [
  // 1. Source-code languages
  {
    language: 'Python',
    category: 'source',
    extensions: ['py', 'pyi', 'pyw'],
    singleLineComments: ['#'],
    multiLineCommentPairs: [['"""', '"""'], ["'''", "'''"]],
    isSourceCode: true,
    isData: false,
    isDocumentation: false,
    isConfiguration: false
  },
  {
    language: 'TypeScript',
    category: 'source',
    extensions: ['ts'],
    singleLineComments: ['//'],
    multiLineCommentPairs: [['/*', '*/']],
    isSourceCode: true,
    isData: false,
    isDocumentation: false,
    isConfiguration: false
  },
  {
    language: 'TSX',
    category: 'source',
    extensions: ['tsx'],
    singleLineComments: ['//'],
    multiLineCommentPairs: [['/*', '*/'], ['{/*', '*/}']],
    isSourceCode: true,
    isData: false,
    isDocumentation: false,
    isConfiguration: false
  },
  {
    language: 'JavaScript',
    category: 'source',
    extensions: ['js', 'mjs', 'cjs', 'jsx'],
    singleLineComments: ['//'],
    multiLineCommentPairs: [['/*', '*/']],
    isSourceCode: true,
    isData: false,
    isDocumentation: false,
    isConfiguration: false
  },
  {
    language: 'Java',
    category: 'source',
    extensions: ['java'],
    singleLineComments: ['//'],
    multiLineCommentPairs: [['/*', '*/']],
    isSourceCode: true,
    isData: false,
    isDocumentation: false,
    isConfiguration: false
  },
  {
    language: 'C',
    category: 'source',
    extensions: ['c', 'h'],
    singleLineComments: ['//'],
    multiLineCommentPairs: [['/*', '*/']],
    isSourceCode: true,
    isData: false,
    isDocumentation: false,
    isConfiguration: false
  },
  {
    language: 'C++',
    category: 'source',
    extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hh'],
    singleLineComments: ['//'],
    multiLineCommentPairs: [['/*', '*/']],
    isSourceCode: true,
    isData: false,
    isDocumentation: false,
    isConfiguration: false
  },
  {
    language: 'C#',
    category: 'source',
    extensions: ['cs'],
    singleLineComments: ['//'],
    multiLineCommentPairs: [['/*', '*/']],
    isSourceCode: true,
    isData: false,
    isDocumentation: false,
    isConfiguration: false
  },
  {
    language: 'Go',
    category: 'source',
    extensions: ['go'],
    singleLineComments: ['//'],
    multiLineCommentPairs: [['/*', '*/']],
    isSourceCode: true,
    isData: false,
    isDocumentation: false,
    isConfiguration: false
  },
  {
    language: 'Rust',
    category: 'source',
    extensions: ['rs'],
    singleLineComments: ['//'],
    multiLineCommentPairs: [['/*', '*/']],
    isSourceCode: true,
    isData: false,
    isDocumentation: false,
    isConfiguration: false
  },
  {
    language: 'HTML',
    category: 'source',
    extensions: ['html', 'htm'],
    multiLineCommentPairs: [['<!--', '-->']],
    isSourceCode: true,
    isData: false,
    isDocumentation: false,
    isConfiguration: false
  },
  {
    language: 'CSS',
    category: 'source',
    extensions: ['css'],
    multiLineCommentPairs: [['/*', '*/']],
    isSourceCode: true,
    isData: false,
    isDocumentation: false,
    isConfiguration: false
  },
  {
    language: 'SCSS',
    category: 'source',
    extensions: ['scss', 'sass'],
    singleLineComments: ['//'],
    multiLineCommentPairs: [['/*', '*/']],
    isSourceCode: true,
    isData: false,
    isDocumentation: false,
    isConfiguration: false
  },
  {
    language: 'SQL',
    category: 'source',
    extensions: ['sql'],
    singleLineComments: ['--'],
    multiLineCommentPairs: [['/*', '*/']],
    isSourceCode: true,
    isData: false,
    isDocumentation: false,
    isConfiguration: false
  },
  {
    language: 'Shell',
    category: 'source',
    extensions: ['sh', 'bash', 'zsh'],
    singleLineComments: ['#'],
    isSourceCode: true,
    isData: false,
    isDocumentation: false,
    isConfiguration: false
  },

  // 2. Data formats
  {
    language: 'CSV',
    category: 'data',
    extensions: ['csv', 'tsv'],
    isSourceCode: false,
    isData: true,
    isDocumentation: false,
    isConfiguration: false
  },
  {
    language: 'Jupyter Notebook',
    category: 'data',
    extensions: ['ipynb'],
    isSourceCode: false,
    isData: true,
    isDocumentation: false,
    isConfiguration: false
  },

  // 3. Documentation
  {
    language: 'Markdown',
    category: 'documentation',
    extensions: ['md', 'markdown'],
    isSourceCode: false,
    isData: false,
    isDocumentation: true,
    isConfiguration: false
  },

  // 4. Configuration formats
  {
    language: 'YAML',
    category: 'configuration',
    extensions: ['yaml', 'yml'],
    singleLineComments: ['#'],
    isSourceCode: false,
    isData: false,
    isDocumentation: false,
    isConfiguration: true
  },
  {
    language: 'JSON',
    category: 'configuration',
    extensions: ['json'],
    isSourceCode: false,
    isData: false,
    isDocumentation: false,
    isConfiguration: true
  },
  {
    language: 'XML',
    category: 'configuration',
    extensions: ['xml', 'svg'],
    multiLineCommentPairs: [['<!--', '-->']],
    isSourceCode: false,
    isData: false,
    isDocumentation: false,
    isConfiguration: true
  }
];

// Binary file extensions that should be flagged
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'webp', 'pdf', 'zip', 'tar', 'gz',
  'exe', 'dll', 'so', 'dylib', 'bin', 'pyc', 'pyo', 'pyd', 'db', 'sqlite',
  'woff', 'woff2', 'ttf', 'eot', 'wasm', 'parquet', 'feather'
]);

/**
 * Normalizes file path to retrieve clean extension.
 */
export function getFileExtension(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const filename = normalized.split('/').pop() || '';
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex <= 0) return '';
  return filename.slice(lastDotIndex + 1).toLowerCase();
}

/**
 * Detects the language and file category specification for a given path.
 */
export function detectLanguageSpec(path: string): LanguageSpec | null {
  const normalized = path.replace(/\\/g, '/');
  const filename = normalized.split('/').pop() || '';
  const ext = getFileExtension(path);

  // Check explicit filename matches (e.g. Dockerfile)
  if (filename.toLowerCase() === 'dockerfile') {
    return {
      language: 'Dockerfile',
      category: 'configuration',
      extensions: ['dockerfile'],
      singleLineComments: ['#'],
      isSourceCode: false,
      isData: false,
      isDocumentation: false,
      isConfiguration: true
    };
  }

  // Find matching language in registry
  for (const spec of LANGUAGE_REGISTRY) {
    if (spec.extensions.includes(ext)) {
      // Special classification: If JSON file is located in a dataset / data directory or has data indicators, classify as data
      if (spec.language === 'JSON') {
        const isDataJson = 
          normalized.includes('/data/') || 
          normalized.includes('/datasets/') || 
          normalized.includes('/records/') ||
          normalized.endsWith('.dataset.json') ||
          normalized.endsWith('.records.json');
        if (isDataJson) {
          return {
            ...spec,
            category: 'data',
            isData: true,
            isConfiguration: false
          };
        }
      }
      return spec;
    }
  }

  return null;
}

/**
 * Analyzes the lines of a file to classify lines into:
 * - Code lines (only for source files)
 * - Comment lines
 * - Blank lines
 * - Data lines (for data files such as CSV)
 * - Documentation/Configuration lines
 */
export function analyzeFileLines(lines: string[], spec: LanguageSpec | null): {
  codeLines: number;
  commentLines: number;
  blankLines: number;
  dataLines: number;
  configLines: number;
  documentationLines: number;
} {
  let blankLines = 0;
  let commentLines = 0;
  let codeLines = 0;
  let dataLines = 0;
  let configLines = 0;
  let documentationLines = 0;

  if (!spec) {
    for (const line of lines) {
      if (line.trim() === '') {
        blankLines++;
      } else {
        documentationLines++;
      }
    }
    return { codeLines: 0, commentLines: 0, blankLines, dataLines: 0, configLines: 0, documentationLines };
  }

  // If it's a data file (e.g. CSV, Jupyter notebook data)
  if (spec.isData) {
    for (const line of lines) {
      if (line.trim() === '') {
        blankLines++;
      } else {
        dataLines++;
      }
    }
    return { codeLines: 0, commentLines: 0, blankLines, dataLines, configLines: 0, documentationLines: 0 };
  }

  // If it's documentation (e.g. Markdown, RST, text)
  if (spec.isDocumentation) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') {
        blankLines++;
      } else if (spec.singleLineComments?.some(c => trimmed.startsWith(c))) {
        commentLines++;
      } else {
        documentationLines++;
      }
    }
    return { codeLines: 0, commentLines, blankLines, dataLines: 0, configLines: 0, documentationLines };
  }

  // If it's configuration (e.g. YAML, JSON config, Dockerfile, TOML, INI)
  if (spec.isConfiguration) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') {
        blankLines++;
      } else if (spec.singleLineComments?.some(c => trimmed.startsWith(c))) {
        commentLines++;
      } else {
        configLines++;
      }
    }
    return { codeLines: 0, commentLines, blankLines, dataLines: 0, configLines, documentationLines: 0 };
  }

  // Source-code language line analysis
  let insideMultiLineComment = false;
  let activeCloseDelimiter = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      blankLines++;
      continue;
    }

    if (insideMultiLineComment) {
      commentLines++;
      if (trimmed.includes(activeCloseDelimiter)) {
        insideMultiLineComment = false;
        activeCloseDelimiter = '';
      }
      continue;
    }

    // Check single-line comments
    let isSingleComment = false;
    if (spec.singleLineComments) {
      for (const token of spec.singleLineComments) {
        if (trimmed.startsWith(token)) {
          commentLines++;
          isSingleComment = true;
          break;
        }
      }
    }

    if (isSingleComment) continue;

    // Check start of multi-line comment
    let isMultiStart = false;
    if (spec.multiLineCommentPairs) {
      for (const [openToken, closeToken] of spec.multiLineCommentPairs) {
        if (trimmed.startsWith(openToken)) {
          commentLines++;
          isMultiStart = true;
          if (!trimmed.slice(openToken.length).includes(closeToken)) {
            insideMultiLineComment = true;
            activeCloseDelimiter = closeToken;
          }
          break;
        }
      }
    }

    if (isMultiStart) continue;

    // Line has real source code
    codeLines++;
  }

  return { codeLines, commentLines, blankLines, dataLines: 0, configLines: 0, documentationLines: 0 };
}

/**
 * Creates a comprehensive FileMetadata descriptor for an indexed file.
 */
export function createFileMetadata(params: {
  path: string;
  size: number;
  lines: string[];
  isIgnored?: boolean;
}): FileMetadata {
  const ext = getFileExtension(params.path);
  const isBinary = BINARY_EXTENSIONS.has(ext);
  const spec = detectLanguageSpec(params.path);
  const lineCount = params.lines.length;

  const { codeLines, commentLines, blankLines, dataLines, configLines, documentationLines } = analyzeFileLines(params.lines, spec);

  const detectedLanguage = spec?.language || (isBinary ? 'Binary' : 'Text');
  const fileType: FileCategory = isBinary ? 'binary' : (spec?.category || 'unknown');

  return {
    path: params.path,
    detectedLanguage,
    fileType,
    lineCount,
    byteSize: params.size,
    isSourceCode: spec?.isSourceCode ?? false,
    isData: spec?.isData ?? false,
    isDocumentation: spec?.isDocumentation ?? false,
    isConfiguration: spec?.isConfiguration ?? false,
    isBinary,
    isIgnored: params.isIgnored ?? false,
    codeLines,
    commentLines,
    blankLines,
    dataLines,
    configLines,
    documentationLines
  };
}
