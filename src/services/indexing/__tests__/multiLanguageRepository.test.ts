import { describe, it, expect } from 'vitest';
import { RepositoryWorkspace } from '../../repository/repositoryWorkspace.js';
import { calculateRepositoryWideStats } from '../lineCounter.js';
import { buildRepositoryChunks } from '../chunker.js';
import { InvertedLexicalIndex } from '../../retrieval/lexicalIndex.js';
import { routeStructuralQuery } from '../../structural/queryRouter.js';
import type { RepositoryFile } from '../../../types/index.js';

function makeFile(path: string, content: string, language: string): RepositoryFile {
  const lines = content.split('\n');
  const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')) : '';
  const isPython = ext.toLowerCase() === '.py' || language.toLowerCase() === 'python';
  return {
    path,
    extension: ext,
    size: Buffer.byteLength(content),
    language,
    isPython,
    lineCount: lines.length,
    sourceText: content,
    lines
  };
}

function createWorkspace(name: string, files: RepositoryFile[], sourceType: 'zip' | 'github' = 'zip'): RepositoryWorkspace {
  const fileMap = new Map<string, RepositoryFile>();
  for (const f of files) {
    fileMap.set(f.path, f);
  }
  return new RepositoryWorkspace({
    repositoryName: name,
    sourceType,
    files: fileMap,
    ignoredCount: 0
  });
}

describe('Multi-Language Repository Ingestion & Retrieval (Zero Python & Mixed)', () => {
  describe('1. Pure TypeScript Repository (Zero Python files)', () => {
    const tsFiles: RepositoryFile[] = [
      makeFile(
        'src/userService.ts',
        `// User Service Module
import { User, Role } from './types.js';

/**
 * Manages user accounts and permissions
 */
export class UserService {
  private users: Map<string, User> = new Map();

  constructor() {
    // initialize empty user store
  }

  public registerUser(name: string, role: Role): User {
    const id = 'usr_' + Math.random().toString(36).substr(2, 9);
    const user: User = { id, name, role, active: true };
    this.users.set(id, user);
    return user;
  }

  public getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  public listActiveUsers(): User[] {
    return Array.from(this.users.values()).filter(u => u.active);
  }
}
`,
        'typescript'
      ),
      makeFile(
        'src/types.ts',
        `export type Role = 'admin' | 'member' | 'guest';

export interface User {
  id: string;
  name: string;
  role: Role;
  active: boolean;
}
`,
        'typescript'
      ),
      makeFile(
        'package.json',
        `{
  "name": "user-service",
  "version": "1.0.0",
  "dependencies": {}
}
`,
        'json'
      ),
      makeFile(
        'README.md',
        `# User Service
TypeScript microservice for authentication and user management.
`,
        'markdown'
      )
    ];

    it('ingests repository cleanly without throwing "No Python files found"', async () => {
      const workspace = createWorkspace('user-service-repo', tsFiles, 'zip');
      await workspace.buildIndex();

      expect(workspace.pythonAnalysisAvailable).toBe(false);
      expect(workspace.structuralIndex).toBeDefined();
      expect(workspace.structuralIndex.getStats().pythonAnalysisAvailable).toBe(false);
      expect(workspace.structuralIndex.getStats().filesAnalyzed).toBe(2);

      const summary = workspace.toRepositorySummary();
      expect(summary.name).toBe('user-service-repo');
      expect(summary.fileCount).toBe(4);
      expect(summary.pythonFileCount).toBe(0);
      expect(summary.primaryLanguage).toBe('typescript');
      expect(summary.repositoryWideStats).toBeDefined();
      expect(summary.repositoryWideStats?.totalFiles).toBe(4);
      expect(summary.repositoryWideStats?.totalLines).toBeGreaterThan(0);
      expect(summary.repositoryWideStats?.totalCodeLines).toBeGreaterThan(0);
    });

    it('indexes non-Python chunks and enables lexical and hybrid retrieval', async () => {
      const workspace = createWorkspace('user-service-repo', tsFiles, 'zip');
      await workspace.buildIndex();

      // Check chunks
      const chunks = workspace.repositoryIndex.getAllChunks();
      expect(chunks.length).toBeGreaterThan(0);

      // Verify lexical search
      const lexical = new InvertedLexicalIndex();
      lexical.indexChunks(chunks);
      const searchRes = lexical.search('registerUser', 5);
      expect(searchRes.length).toBeGreaterThan(0);
      expect(searchRes[0].chunk.filePath).toBe('src/userService.ts');

      // Verify hybrid retriever works gracefully with zero Python AST
      const hybridFindings = await workspace.repositoryIndex.search('registerUser active users', { topK: 5 });
      expect(hybridFindings.length).toBeGreaterThan(0);
      expect(hybridFindings[0].filePath).toBe('src/userService.ts');
      expect(hybridFindings[0].hybridScore?.structuralBoost).toBe(0);
    });

    it('returns handled: false for AST structural query router', async () => {
      const workspace = createWorkspace('user-service-repo', tsFiles, 'zip');
      await workspace.buildIndex();

      const outcome = routeStructuralQuery(
        'where is registerUser defined?',
        workspace.structuralIndex,
        workspace
      );
      expect(outcome.handled).toBe(true);
      expect(outcome.findings.length).toBeGreaterThan(0);
    });
  });

  describe('2. Pure JavaScript + JSON + CSS Repository', () => {
    const jsFiles: RepositoryFile[] = [
      makeFile(
        'index.js',
        `// Express application entry
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

function startServer() {
  app.listen(PORT, () => {
    console.log('Listening on port ' + PORT);
  });
}

module.exports = { app, startServer };
`,
        'javascript'
      ),
      makeFile(
        'styles/app.css',
        `/* Global Stylesheet */
body {
  margin: 0;
  padding: 0;
  background-color: #1a1a1a;
  color: #f5f5f5;
}
`,
        'css'
      ),
      makeFile(
        'config.json',
        `{
  "port": 3000,
  "env": "production"
}
`,
        'json'
      )
    ];

    it('correctly calculates line stats and language breakdown', async () => {
      const workspace = createWorkspace('node-app', jsFiles, 'github');
      await workspace.buildIndex();

      const summary = workspace.toRepositorySummary();
      expect(summary.fileCount).toBe(3);
      expect(summary.pythonFileCount).toBe(0);
      expect(summary.primaryLanguage).toBe('javascript');

      const byLang = summary.repositoryWideStats?.byLanguage;
      expect(byLang).toBeDefined();
      const hasJs = Object.keys(byLang || {}).some(k => k.toLowerCase() === 'javascript');
      const hasCss = Object.keys(byLang || {}).some(k => k.toLowerCase() === 'css');
      const hasJson = Object.keys(byLang || {}).some(k => k.toLowerCase() === 'json');
      expect(hasJs).toBe(true);
      expect(hasCss).toBe(true);
      expect(hasJson).toBe(true);

      const results = await workspace.repositoryIndex.search('startServer port listen', { topK: 3 });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].filePath).toBe('index.js');
    });
  });

  describe('3. Mixed Python + TypeScript + Markdown Repository', () => {
    const mixedFiles: RepositoryFile[] = [
      makeFile(
        'backend/main.py',
        `# Python API backend
from flask import Flask

app = Flask(__name__)

def create_app():
    return app

class Controller:
    def handle_request(self):
        return "ok"
`,
        'python'
      ),
      makeFile(
        'frontend/src/App.tsx',
        `// React UI Frontend
import React from 'react';

export const App = () => {
  return <div>Welcome to ExynoX</div>;
};
`,
        'typescript'
      ),
      makeFile(
        'docs/architecture.md',
        `# Architecture Overview
Fullstack app with Flask backend and React frontend.
`,
        'markdown'
      )
    ];

    it('enables Python AST for Python files while seamlessly indexing TypeScript and Markdown', async () => {
      const workspace = createWorkspace('fullstack-app', mixedFiles, 'zip');
      await workspace.buildIndex();

      expect(workspace.pythonAnalysisAvailable).toBe(true);
      expect(workspace.structuralIndex.getStats().pythonAnalysisAvailable).toBe(true);
      expect(workspace.structuralIndex.getStats().filesAnalyzed).toBe(2);
      expect(workspace.structuralIndex.getStats().totalFunctions).toBeGreaterThan(0);

      const summary = workspace.toRepositorySummary();
      expect(summary.fileCount).toBe(3);
      expect(summary.pythonFileCount).toBe(1);
      expect(summary.primaryLanguage).toBe('multi');

      // Python AST query works for Python files
      const outcome = routeStructuralQuery(
        'where is create_app defined?',
        workspace.structuralIndex,
        workspace
      );
      expect(outcome.handled).toBe(true);
      expect(outcome.findings.length).toBeGreaterThan(0);
      expect(outcome.findings[0].location.filePath).toBe('backend/main.py');

      // Hybrid query retrieves both Python and TypeScript files
      const tsResult = await workspace.repositoryIndex.search('Welcome to ExynoX React', { topK: 3 });
      expect(tsResult.length).toBeGreaterThan(0);
      expect(tsResult.some(r => r.filePath === 'frontend/src/App.tsx')).toBe(true);
    });
  });
});
