/**
 * Security and sanitization utilities for repository ingestion.
 * All repository archives and URLs are treated as untrusted input.
 */

// Safety limits for Phase 1 prototype
export const REPOSITORY_LIMITS = {
  MAX_TOTAL_UNCOMPRESSED_BYTES: 50 * 1024 * 1024, // 50 MB
  MAX_SINGLE_FILE_BYTES: 5 * 1024 * 1024,          // 5 MB
  MAX_FILE_ENTRIES: 5000,                          // Maximum files allowed
  MAX_SEARCH_RESULTS: 50,                          // Lexical search limit
};

// Directories that must always be ignored
const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  '.github',
  'node_modules',
  '__pycache__',
  '.venv',
  'venv',
  'env',
  '.env',
  'dist',
  'build',
  'coverage',
  '.pytest_cache',
  '.mypy_cache',
  '.tox',
  '.idea',
  '.vscode',
  '.cache',
  'eggs',
  '.eggs'
]);

// Ignored binary and media file extensions
const IGNORED_EXTENSIONS = new Set([
  'pyc', 'pyo', 'pyd', 'so', 'dll', 'dylib', 'exe', 'bin',
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'webp', 'bmp', 'tiff',
  'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg',
  'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar', 'whl',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'db', 'sqlite', 'sqlite3', 'pdf', 'parquet', 'pickle', 'pkl'
]);

// Whitelist of readable text file extensions supported by ExynoX Code Intelligence
export const READABLE_TEXT_EXTENSIONS = new Set([
  'py', 'pyi', 'pyw',
  'ts', 'tsx', 'js', 'mjs', 'cjs', 'jsx',
  'java', 'c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'hh', 'cs', 'go', 'rs',
  'html', 'htm', 'css', 'scss', 'sass', 'sql', 'sh', 'bash', 'zsh',
  'json', 'yaml', 'yml', 'xml', 'svg', 'toml', 'ini', 'cfg', 'txt', 'md', 'markdown',
  'csv', 'tsv', 'ipynb', 'dockerfile'
]);

export function isReadableTextFile(pathOrFilename: string): boolean {
  const norm = pathOrFilename.replace(/\\/g, '/');
  const filename = norm.split('/').pop() || '';
  if (filename.toLowerCase() === 'dockerfile') return true;
  const ext = getFileExtension(filename);
  return READABLE_TEXT_EXTENSIONS.has(ext);
}

/**
 * Validates a file path against path traversal attacks.
 * Rejects paths with '..', leading slashes, null bytes, or Windows drive syntax.
 */
export function validateSafePath(rawPath: string): { safe: boolean; normalizedPath?: string; reason?: string } {
  if (!rawPath || typeof rawPath !== 'string') {
    return { safe: false, reason: 'Empty path' };
  }

  // Check for null bytes
  if (rawPath.indexOf('\0') !== -1) {
    return { safe: false, reason: 'Null byte detected in path' };
  }

  // Normalize forward and backward slashes
  const normalized = rawPath.replace(/\\/g, '/').trim();

  // Reject absolute paths
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    return { safe: false, reason: 'Absolute path is not allowed' };
  }

  // Split and inspect path segments
  const segments = normalized.split('/');
  for (const segment of segments) {
    if (segment === '..') {
      return { safe: false, reason: 'Path traversal (..) is strictly prohibited' };
    }
  }

  // Clean trailing and double slashes
  const cleaned = segments.filter(Boolean).join('/');
  if (!cleaned) {
    return { safe: false, reason: 'Path resolved to empty' };
  }

  return { safe: true, normalizedPath: cleaned };
}

/**
 * Checks if a path belongs to an ignored directory or file.
 */
export function shouldIgnoreEntry(normalizedPath: string): boolean {
  const parts = normalizedPath.split('/');

  // Check directory segments
  for (let i = 0; i < parts.length - 1; i++) {
    if (IGNORED_DIRECTORY_NAMES.has(parts[i].toLowerCase())) {
      return true;
    }
  }

  const fileName = parts[parts.length - 1];
  // Ignore OS files like .DS_Store or Thumbs.db
  if (fileName === '.DS_Store' || fileName === 'Thumbs.db' || fileName.startsWith('._')) {
    return true;
  }

  // Check extension
  const ext = getFileExtension(fileName);
  if (IGNORED_EXTENSIONS.has(ext)) {
    return true;
  }

  return false;
}

/**
 * Returns the lower-case file extension without dot.
 */
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return '';
  return fileName.slice(lastDot + 1).toLowerCase();
}

/**
 * Detects whether a file is a Python source file.
 */
export function isPythonFile(normalizedPath: string): boolean {
  return normalizedPath.endsWith('.py');
}

/**
 * Validates a GitHub repository URL format.
 * Accepts:
 *   https://github.com/owner/repo
 *   http://github.com/owner/repo
 *   github.com/owner/repo
 */
export function parseGitHubUrl(rawUrl: string): { valid: boolean; owner?: string; repo?: string; error?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Please enter a GitHub repository URL.' };
  }

  const trimmed = rawUrl.trim();
  // Match standard GitHub web URL format
  const pattern = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\/.*)?$/;
  const match = trimmed.match(pattern);

  if (!match) {
    return { 
      valid: false, 
      error: 'Invalid GitHub URL format. Example: https://github.com/owner/repository' 
    };
  }

  const owner = match[1];
  let repo = match[2];

  // Strip .git suffix if present
  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  if (!owner || !repo) {
    return { valid: false, error: 'Could not parse owner and repository from the URL.' };
  }

  return { valid: true, owner, repo };
}
