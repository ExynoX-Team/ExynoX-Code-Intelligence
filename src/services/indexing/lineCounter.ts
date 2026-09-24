/**
 * Repository-wide Line and Language Statistics Calculator
 * Samsung PRISM GenAI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 */

import type { FileMetadata, RepositoryWideStats, LanguageStats, FileCategory } from '../../types/retrieval.js';

/**
 * Calculates complete repository-wide statistics across all files.
 * Strictly separates source-code lines from data lines (CSV/datasets) and configuration/documentation lines.
 */
export function calculateRepositoryWideStats(
  files: FileMetadata[],
  ignoredCount = 0
): RepositoryWideStats {
  let totalLines = 0;
  let totalCodeLines = 0;
  let totalCommentLines = 0;
  let totalBlankLines = 0;
  let totalBytes = 0;
  let totalDataLines = 0;
  let totalConfigLines = 0;
  let totalDocumentationLines = 0;
  let totalPythonFiles = 0;

  const languageCounts: Record<string, number> = {};
  const languageLineCounts: Record<string, number> = {};
  const fileTypeCounts: Record<FileCategory, number> = {
    source: 0,
    data: 0,
    documentation: 0,
    configuration: 0,
    binary: 0,
    unknown: 0
  };

  const categoryLineCounts = {
    sourceCode: 0,
    data: 0,
    documentation: 0,
    configuration: 0,
    blank: 0
  };

  for (const file of files) {
    totalLines += file.lineCount;
    totalBytes += file.byteSize;
    totalBlankLines += file.blankLines;
    totalCodeLines += file.codeLines;
    totalCommentLines += file.commentLines;
    totalDataLines += (file.dataLines || 0);
    totalConfigLines += (file.configLines || 0);
    totalDocumentationLines += (file.documentationLines || 0);

    if (file.detectedLanguage.toLowerCase() === 'python') {
      totalPythonFiles++;
    }

    // Language aggregation
    languageCounts[file.detectedLanguage] = (languageCounts[file.detectedLanguage] || 0) + 1;
    languageLineCounts[file.detectedLanguage] = (languageLineCounts[file.detectedLanguage] || 0) + file.lineCount;

    // File type aggregation
    fileTypeCounts[file.fileType] = (fileTypeCounts[file.fileType] || 0) + 1;

    // Line breakdown by category
    if (file.isSourceCode) {
      categoryLineCounts.sourceCode += (file.codeLines + file.commentLines);
    } else if (file.isData) {
      categoryLineCounts.data += file.dataLines;
    } else if (file.isDocumentation) {
      categoryLineCounts.documentation += ((file.documentationLines || 0) + file.commentLines);
    } else if (file.isConfiguration) {
      categoryLineCounts.configuration += ((file.configLines || 0) + file.commentLines);
    }

    categoryLineCounts.blank += file.blankLines;
  }

  return {
    totalFiles: files.length,
    totalReadableFiles: files.filter(f => !f.isBinary).length,
    totalPythonFiles,
    totalLines,
    totalCodeLines,
    totalCommentLines,
    totalBlankLines,
    totalBytes,
    totalDataLines,
    totalConfigLines,
    totalDocumentationLines,
    ignoredFiles: ignoredCount,
    languageCounts,
    languageLineCounts,
    fileTypeCounts,
    categoryLineCounts,
    // Convenience fields
    codeLines: totalCodeLines,
    commentLines: totalCommentLines,
    blankLines: totalBlankLines,
    sourceFiles: fileTypeCounts.source || 0,
    configFiles: fileTypeCounts.configuration || 0,
    documentationFiles: fileTypeCounts.documentation || 0,
    dataFiles: fileTypeCounts.data || 0,
    binaryOrSkippedFiles: (fileTypeCounts.binary || 0) + ignoredCount,
    byLanguage: calculateLanguageStatistics(files)
  };
}

/**
 * Derives per-language statistics from repository metadata.
 */
export function calculateLanguageStatistics(files: FileMetadata[]): Record<string, LanguageStats> {
  const result: Record<string, LanguageStats> = {};

  for (const file of files) {
    const lang = file.detectedLanguage;
    if (!result[lang]) {
      result[lang] = {
        language: lang,
        fileCount: 0,
        totalLines: 0,
        codeLines: 0,
        commentLines: 0,
        blankLines: 0,
        dataLines: 0,
        configLines: 0,
        documentationLines: 0,
        byteSize: 0,
        isSourceCode: file.isSourceCode
      };
    }

    const stat = result[lang];
    stat.fileCount += 1;
    stat.totalLines += file.lineCount;
    stat.codeLines += file.codeLines;
    stat.commentLines += file.commentLines;
    stat.blankLines += file.blankLines;
    stat.dataLines += file.dataLines;
    stat.configLines = (stat.configLines || 0) + (file.configLines || 0);
    stat.documentationLines = (stat.documentationLines || 0) + (file.documentationLines || 0);
    stat.byteSize += file.byteSize;
  }

  return result;
}
