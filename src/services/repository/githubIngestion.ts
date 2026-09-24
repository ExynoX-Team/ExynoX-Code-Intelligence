import JSZip from 'jszip';
import type { RepositoryFile, IndexingProgress } from '../../types/index.js';
import { 
  parseGitHubUrl, 
  validateSafePath, 
  shouldIgnoreEntry, 
  isPythonFile, 
  getFileExtension,
  isReadableTextFile,
  REPOSITORY_LIMITS 
} from './security.js';
import { detectLanguageSpec } from '../indexing/languageDetector.js';
import { RepositoryWorkspace } from './repositoryWorkspace.js';
import type { ProgressCallback } from './zipIngestion.js';

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

/**
 * Safely ingests a public GitHub repository.
 * Uses a resilient approach: attempts direct archive streaming,
 * and falls back to GitHub REST Trees API + raw content fetching.
 */
export async function ingestGitHubRepository(
  rawUrl: string,
  onProgress?: ProgressCallback
): Promise<RepositoryWorkspace> {
  const steps = [
    { id: 'url', label: 'Validating repository URL', status: 'pending' as const },
    { id: 'conn', label: 'Connecting to GitHub repository', status: 'pending' as const },
    { id: 'scan', label: 'Discovering repository structure', status: 'pending' as const },
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

  // Step 1: Validate URL
  updateProgress('received', 0, 'Validating GitHub repository URL...');
  const parsed = parseGitHubUrl(rawUrl);
  if (!parsed.valid || !parsed.owner || !parsed.repo) {
    throw new Error(parsed.error || 'Invalid GitHub repository URL.');
  }

  const { owner, repo } = parsed;
  const cleanRepoName = `${owner}/${repo}`;

  // Step 2: Connect to GitHub API
  updateProgress('discovered', 1, `Accessing repository ${cleanRepoName}...`);

  let repoData: { default_branch?: string; private?: boolean };
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.status === 404) {
      throw new Error("Couldn't access this GitHub repository. Make sure the repository is public and the URL is correct.");
    }

    if (res.status === 403) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (remaining === '0') {
        throw new Error('GitHub API rate limit reached. Please upload via ZIP archive or try again later.');
      }
      throw new Error("Couldn't access this GitHub repository. Make sure the repository is public and the URL is correct.");
    }

    if (!res.ok) {
      throw new Error(`GitHub responded with status ${res.status}. Please ensure the repository exists and is public.`);
    }

    repoData = await res.json();
    if (repoData.private) {
      throw new Error('Private repositories are not supported in this prototype. Please use a public repository.');
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Couldn't access")) {
      throw err;
    }
    throw new Error("Couldn't access this GitHub repository. Make sure the repository is public and the URL is correct.");
  }

  const defaultBranch = repoData.default_branch || 'main';

  // Strategy 1: Attempt to download archive zipball via fetch
  updateProgress('reading_python', 2, 'Fetching repository archive from GitHub...');

  let zipDownloaded = false;
  let zipBlob: Blob | null = null;

  try {
    const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${defaultBranch}`;
    const zipRes = await fetch(zipUrl, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });

    if (zipRes.ok) {
      zipBlob = await zipRes.blob();
      zipDownloaded = true;
    }
  } catch {
    // Fall back to Tree API
    zipDownloaded = false;
  }

  const filesMap = new Map<string, RepositoryFile>();
  let ignoredCount = 0;

  if (zipDownloaded && zipBlob) {
    // Unpack ZIP archive in-memory
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(zipBlob);
      const entries = Object.values(zip.files);

      // Detect prefix e.g. owner-repo-sha/
      let commonPrefix = '';
      const firstSlashIdx = entries[0]?.name.indexOf('/');
      if (firstSlashIdx !== -1) {
        commonPrefix = entries[0].name.slice(0, firstSlashIdx + 1);
      }

      let totalExtractedBytes = 0;

      for (const entry of entries) {
        if (entry.dir) continue;
        const rawPath = commonPrefix && entry.name.startsWith(commonPrefix)
          ? entry.name.slice(commonPrefix.length)
          : entry.name;

        const pathCheck = validateSafePath(rawPath);
        if (!pathCheck.safe || !pathCheck.normalizedPath) continue;
        const norm = pathCheck.normalizedPath;

        if (shouldIgnoreEntry(norm)) {
          ignoredCount++;
          continue;
        }

        const ext = getFileExtension(norm);
        const isPy = isPythonFile(norm);
        if (!isPy && !isReadableTextFile(norm)) {
          ignoredCount++;
          continue;
        }

        const text = await entry.async('string');
        const byteSize = new Blob([text]).size;
        totalExtractedBytes += byteSize;

        if (totalExtractedBytes > REPOSITORY_LIMITS.MAX_TOTAL_UNCOMPRESSED_BYTES) {
          throw new Error('Repository is too large for this prototype.');
        }

        const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalizedText.split('\n');
        const langSpec = detectLanguageSpec(norm);

        filesMap.set(norm, {
          path: norm,
          extension: ext,
          size: byteSize,
          language: isPy ? 'python' : (langSpec ? langSpec.language.toLowerCase() : (ext || 'text')),
          isPython: isPy,
          lineCount: lines.length,
          sourceText: normalizedText,
          lines
        });
      }
    } catch {
      zipDownloaded = false;
    }
  }

  // Strategy 2: If archive zipball was blocked, fetch through Git Trees + raw content
  if (!zipDownloaded || filesMap.size === 0) {
    updateProgress('reading_python', 2, `Fetching repository structure for branch '${defaultBranch}'...`);

    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`
    );

    if (!treeRes.ok) {
      throw new Error("Couldn't access this GitHub repository. Make sure the repository is public and the URL is correct.");
    }

    const treeData = await treeRes.json();
    const treeItems: GitHubTreeItem[] = treeData.tree || [];

    if (treeItems.length === 0) {
      throw new Error('This GitHub repository contains no files.');
    }

    const candidateFiles = treeItems.filter(item => {
      if (item.type !== 'blob') return false;
      const pathCheck = validateSafePath(item.path);
      if (!pathCheck.safe || !pathCheck.normalizedPath) return false;
      if (shouldIgnoreEntry(pathCheck.normalizedPath)) {
        ignoredCount++;
        return false;
      }
      const ext = getFileExtension(pathCheck.normalizedPath);
      const isPy = isPythonFile(pathCheck.normalizedPath);
      return isPy || isReadableTextFile(pathCheck.normalizedPath);
    });

    if (candidateFiles.length === 0) {
      throw new Error('No readable source, configuration, or documentation files found in this repository.');
    }

    // Limit candidate count to reasonable size for prototype
    const filesToFetch = candidateFiles.slice(0, 150);

    for (let i = 0; i < filesToFetch.length; i++) {
      const item = filesToFetch[i];
      try {
        const rawRes = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${item.path}`
        );

        if (!rawRes.ok) continue;

        const rawText = await rawRes.text();
        const ext = getFileExtension(item.path);
        const isPy = isPythonFile(item.path);
        const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalizedText.split('\n');
        const byteSize = new Blob([normalizedText]).size;
        const langSpec = detectLanguageSpec(item.path);

        filesMap.set(item.path, {
          path: item.path,
          extension: ext,
          size: byteSize,
          language: isPy ? 'python' : (langSpec ? langSpec.language.toLowerCase() : (ext || 'text')),
          isPython: isPy,
          lineCount: lines.length,
          sourceText: normalizedText,
          lines
        });
      } catch {
        // Skip inaccessible single file
      }
    }
  }

  // Step 4: Finalize workspace
  updateProgress('building_workspace', 3, 'Building workspace and analyzing repository files...');

  if (filesMap.size === 0) {
    throw new Error('No readable source, configuration, or documentation files could be retrieved from this repository.');
  }

  const workspace = new RepositoryWorkspace({
    repositoryName: cleanRepoName,
    sourceType: 'github',
    sourceUrl: rawUrl,
    files: filesMap,
    ignoredCount
  });

  // Build repository-wide index (stats, chunks, lexical, semantic, structural)
  await workspace.buildIndex(onProgress);

  return workspace;
}
