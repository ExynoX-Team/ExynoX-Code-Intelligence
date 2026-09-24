import JSZip from 'jszip';
import type { RepositoryFile, IndexingProgress } from '../../types/index.js';
import { 
  validateSafePath, 
  shouldIgnoreEntry, 
  isPythonFile, 
  getFileExtension,
  isReadableTextFile,
  REPOSITORY_LIMITS 
} from './security.js';
import { detectLanguageSpec } from '../indexing/languageDetector.js';
import { RepositoryWorkspace } from './repositoryWorkspace.js';

export type ProgressCallback = (progress: IndexingProgress) => void;

/**
 * Safely ingests and parses a ZIP archive containing a repository.
 */
export async function ingestZipRepository(
  file: File, 
  onProgress?: ProgressCallback
): Promise<RepositoryWorkspace> {
  const steps = [
    { id: 'recv', label: 'Repository archive received', status: 'pending' as const },
    { id: 'disc', label: 'Scanning archive structure', status: 'pending' as const },
    { id: 'read', label: 'Reading repository source files', status: 'pending' as const },
    { id: 'work', label: 'Building repository workspace', status: 'pending' as const }
  ];

  const updateProgress = (stage: IndexingProgress['stage'], stepIdx: number, message: string) => {
    if (!onProgress) return;
    const updatedSteps = steps.map((step, idx) => ({
      ...step,
      status: idx < stepIdx ? 'completed' as const : (idx === stepIdx ? 'in_progress' as const : 'pending' as const)
    }));
    onProgress({
      stage,
      message,
      currentStepIndex: stepIdx,
      steps: updatedSteps
    });
  };

  // Step 1: Validate file signature & unpack archive
  updateProgress('received', 0, 'Validating and unpacking ZIP archive...');

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (err) {
    throw new Error('Invalid or corrupted ZIP archive. Please ensure the file is a valid .zip archive.');
  }

  // Step 2: Discover and filter entries
  updateProgress('discovered', 1, 'Scanning repository files and directory structure...');

  const entries = Object.values(zip.files);
  if (entries.length === 0) {
    throw new Error('The uploaded ZIP archive is empty.');
  }

  if (entries.length > REPOSITORY_LIMITS.MAX_FILE_ENTRIES) {
    throw new Error(`Repository contains too many files (${entries.length}). Maximum allowed is ${REPOSITORY_LIMITS.MAX_FILE_ENTRIES}.`);
  }

  // Detect common root folder if the zip contains a top-level wrapper folder (e.g. repo-main/)
  let commonPrefix = '';
  const firstSlashIdx = entries[0].name.indexOf('/');
  if (firstSlashIdx !== -1) {
    const candidatePrefix = entries[0].name.slice(0, firstSlashIdx + 1);
    const allMatch = entries.every(e => e.name.startsWith(candidatePrefix));
    if (allMatch) {
      commonPrefix = candidatePrefix;
    }
  }

  const filesMap = new Map<string, RepositoryFile>();
  let totalExtractedBytes = 0;
  let ignoredCount = 0;

  // Step 3: Read source and metadata files
  updateProgress('reading_python', 2, 'Extracting repository files and normalizing lines...');

  for (const entry of entries) {
    // Skip directories
    if (entry.dir) continue;

    // Strip common wrapper prefix if present
    const rawPath = commonPrefix && entry.name.startsWith(commonPrefix)
      ? entry.name.slice(commonPrefix.length)
      : entry.name;

    // Path traversal safety check
    const pathCheck = validateSafePath(rawPath);
    if (!pathCheck.safe || !pathCheck.normalizedPath) {
      throw new Error(`Security validation failed: ${pathCheck.reason || 'Invalid archive path'}`);
    }

    const normalizedPath = pathCheck.normalizedPath;

    // Filter ignored directories & binaries
    if (shouldIgnoreEntry(normalizedPath)) {
      ignoredCount++;
      continue;
    }

    const extension = getFileExtension(normalizedPath);
    const isPy = isPythonFile(normalizedPath);

    // Filter non-source/non-config files
    if (!isPy && !isReadableTextFile(normalizedPath)) {
      ignoredCount++;
      continue;
    }

    // Read file content as text
    const rawContent = await entry.async('string');
    const byteSize = new Blob([rawContent]).size;

    if (byteSize > REPOSITORY_LIMITS.MAX_SINGLE_FILE_BYTES) {
      ignoredCount++;
      continue;
    }

    totalExtractedBytes += byteSize;
    if (totalExtractedBytes > REPOSITORY_LIMITS.MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error('Repository exceeds maximum size limit (50 MB) for this prototype.');
    }

    // Normalize newlines to '\n' so line splitting is strictly consistent across platforms
    const normalizedText = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n');
    const langSpec = detectLanguageSpec(normalizedPath);

    filesMap.set(normalizedPath, {
      path: normalizedPath,
      extension,
      size: byteSize,
      language: isPy ? 'python' : (langSpec ? langSpec.language.toLowerCase() : (extension || 'text')),
      isPython: isPy,
      lineCount: lines.length,
      sourceText: normalizedText,
      lines
    });
  }

  // Step 4: Build Workspace and finalize
  updateProgress('building_workspace', 3, 'Building workspace and analyzing repository files...');

  if (filesMap.size === 0) {
    throw new Error('No readable source, configuration, or documentation files found in this archive.');
  }

  const cleanRepoName = file.name.replace(/\.zip$/i, '') || 'repository';

  const workspace = new RepositoryWorkspace({
    repositoryName: cleanRepoName,
    sourceType: 'zip',
    files: filesMap,
    ignoredCount
  });

  // Build repository-wide index (stats, chunks, lexical, semantic, structural)
  await workspace.buildIndex(onProgress);

  return workspace;
}
