/**
 * ExynoX Code Intelligence — Indexing Cost & Resource Metrics
 * Samsung PRISM Gen AI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 *
 * Negative Constraint:
 * Do NOT pretend we can calculate monetary cloud cost unless an actual provider cost is available.
 * Instead measure reproducible indexing-cost proxies.
 * Label clearly as: "Indexing Cost / Resource Metrics".
 */

import type { IndexingResourceMetrics } from '../types.js';
import type { RepositoryWorkspace } from '../../services/repository/repositoryWorkspace.js';

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Extracts real, reproducible resource metrics and indexing proxies from a RepositoryWorkspace.
 */
export function extractIndexingMetrics(
  workspace: RepositoryWorkspace,
  indexingDurationMs: number = 0
): IndexingResourceMetrics {
  const lineStats = workspace.repositoryIndex?.lineStats;
  const struct = workspace.structuralIndex;
  const chunks = workspace.repositoryIndex?.chunks || [];
  const vectorStore = workspace.repositoryIndex?.vectorStore;

  const totalFiles = workspace.files.size;
  const sourceFiles = lineStats?.fileTypeCounts?.source || workspace.pythonFiles.length;
  const totalLines = lineStats?.totalLines || 0;
  const totalBytes = lineStats?.totalBytes || 0;
  const totalCharacters = totalBytes; // UTF-8 byte representation proxy

  const stats = struct?.getStats();
  const totalChunks = chunks.length;
  const totalFunctions = stats?.totalFunctions || 0;
  const totalClasses = stats?.totalClasses || 0;
  const totalMethods = stats?.totalMethods || 0;
  const totalCallRelationships = stats?.totalCalls || 0;
  const totalImportRelationships = stats?.totalImports || 0;
  const totalSymbols = totalFunctions + totalClasses + totalMethods + (stats?.totalAssignments || 0);

  // AST nodes count proxy: structural entities + call sites + imports + expressions
  const totalAstNodes = totalSymbols + totalCallRelationships + totalImportRelationships;

  // Semantic vectors generated: chunks with embeddings
  const semanticVectorsGenerated = vectorStore?.size() || totalChunks;

  // Safe memory footprint approximation:
  // (Files text bytes) + (chunks text & metadata ~ 1.5x) + (vectors: 64 floats * 4 bytes = 256 bytes per chunk) + (AST graph ~ 200 bytes per node)
  const estimatedMemoryBytes = 
    totalBytes + 
    (totalChunks * 512) + 
    (semanticVectorsGenerated * 256) + 
    (totalAstNodes * 128);

  return {
    label: "Indexing Cost / Resource Metrics",
    totalFiles,
    sourceFiles,
    totalLines,
    totalCharacters,
    totalChunks,
    totalAstNodes,
    totalSymbols,
    totalFunctions,
    totalClasses,
    totalMethods,
    totalCallRelationships,
    totalImportRelationships,
    semanticVectorsGenerated,
    approximateIndexMemoryBytes: estimatedMemoryBytes,
    approximateIndexMemoryFormatted: formatBytes(estimatedMemoryBytes),
    indexingDurationMs: Number(indexingDurationMs.toFixed(2))
  };
}
