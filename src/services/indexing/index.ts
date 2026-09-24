import type { Repository } from '../../types/index.js';

export * from './languageDetector.js';
export * from './lineCounter.js';
export * from './chunker.js';
export * from './repositoryIndex.js';

export interface IndexingStatus {
  status: 'idle' | 'indexing' | 'completed' | 'failed';
  processedFiles: number;
  totalFiles: number;
  progressPercentage: number;
}

export interface IIndexingService {
  indexRepository(repo: Repository): Promise<IndexingStatus>;
  getStatus(): IndexingStatus;
}

/**
 * IndexingService
 * Coordinates chunking, tokenization, and vector store ingestion.
 */
export class IndexingService implements IIndexingService {
  private currentStatus: IndexingStatus = {
    status: 'idle',
    processedFiles: 0,
    totalFiles: 0,
    progressPercentage: 0
  };

  async indexRepository(repo: Repository): Promise<IndexingStatus> {
    return this.currentStatus;
  }

  getStatus(): IndexingStatus {
    return this.currentStatus;
  }
}

export const indexingService = new IndexingService();
