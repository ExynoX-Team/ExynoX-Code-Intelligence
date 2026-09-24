/**
 * Configuration & Environment Extractor
 * Extracts config keys, values, environment variables, ports, database URLs from config and source files.
 * Zero hardcoded repository logic.
 */

import type { ConfigEntryNode } from './types.js';

export class ConfigExtractor {
  /**
   * Extracts configuration settings from a configuration file.
   */
  static extractConfigEntries(
    filePath: string,
    lines: string[],
    language: string
  ): ConfigEntryNode[] {
    const entries: ConfigEntryNode[] = [];
    const lowerPath = filePath.toLowerCase();
    const isYaml = lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml');
    const isEnv = lowerPath.includes('.env');
    const isJson = lowerPath.endsWith('.json');
    const isDockerfile = lowerPath.endsWith('dockerfile');

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const lineText = lines[i];
      const trimmed = lineText.trim();

      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

      // 1. YAML / TOML: key: value or key:
      if (isYaml) {
        const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
        if (match) {
          const key = match[1];
          const val = match[2].trim().replace(/^['"]|['"]$/g, '');
          entries.push({
            id: `cfg_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${key}_${lineNum}`,
            key,
            value: val || '(section)',
            filePath,
            line: lineNum,
            snippet: trimmed,
            isEnvVar: false
          });
        }
      }

      // 2. .env: KEY=VALUE or export KEY=VALUE
      if (isEnv) {
        const match = trimmed.match(/^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (match) {
          const key = match[1];
          const val = match[2].trim().replace(/^['"]|['"]$/g, '');
          entries.push({
            id: `cfg_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${key}_${lineNum}`,
            key,
            value: val,
            filePath,
            line: lineNum,
            snippet: trimmed,
            isEnvVar: true
          });
        }
      }

      // 3. Dockerfile: ENV KEY=VALUE or EXPOSE 3000
      if (isDockerfile) {
        const envMatch = trimmed.match(/^ENV\s+([A-Z0-9_]+)\s*=\s*(.*)$/i) || trimmed.match(/^ENV\s+([A-Z0-9_]+)\s+(.*)$/i);
        if (envMatch) {
          entries.push({
            id: `cfg_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${envMatch[1]}_${lineNum}`,
            key: envMatch[1],
            value: envMatch[2].trim(),
            filePath,
            line: lineNum,
            snippet: trimmed,
            isEnvVar: true
          });
        }
        const exposeMatch = trimmed.match(/^EXPOSE\s+([0-9]+)/i);
        if (exposeMatch) {
          entries.push({
            id: `cfg_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_port_${lineNum}`,
            key: 'port',
            value: exposeMatch[1],
            filePath,
            line: lineNum,
            snippet: trimmed,
            isEnvVar: false
          });
        }
      }

      // 4. JSON: "port": 3000 or "database": { ... }
      if (isJson) {
        const jsonMatch = trimmed.match(/^"([A-Za-z0-9_.-]+)"\s*:\s*(.*)$/);
        if (jsonMatch) {
          const key = jsonMatch[1];
          const val = jsonMatch[2].replace(/[,}]$/g, '').trim().replace(/^["']|["']$/g, '');
          entries.push({
            id: `cfg_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${key}_${lineNum}`,
            key,
            value: val,
            filePath,
            line: lineNum,
            snippet: trimmed,
            isEnvVar: false
          });
        }
      }
    }

    return entries;
  }

  /**
   * Extracts environment variable accesses in source code (e.g. process.env.PORT, os.getenv("DB_URL")).
   */
  static extractEnvVarReferences(
    filePath: string,
    lines: string[]
  ): ConfigEntryNode[] {
    const entries: ConfigEntryNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const lineText = lines[i];

      // Node: process.env.KEY
      const nodeMatch = lineText.match(/process\.env\.([A-Za-z0-9_]+)/g);
      if (nodeMatch) {
        for (const m of nodeMatch) {
          const key = m.replace('process.env.', '');
          entries.push({
            id: `cfg_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${key}_${lineNum}`,
            key,
            value: `Accessed in ${filePath}:${lineNum}`,
            filePath,
            line: lineNum,
            snippet: lineText.trim(),
            isEnvVar: true
          });
        }
      }

      // Python: os.environ.get('KEY') or os.getenv('KEY')
      const pyMatch = lineText.match(/os\.(?:environ\.get|getenv)\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g);
      if (pyMatch) {
        for (const m of pyMatch) {
          const keyMatch = m.match(/['"]([A-Za-z0-9_]+)['"]/);
          if (keyMatch) {
            entries.push({
              id: `cfg_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${keyMatch[1]}_${lineNum}`,
              key: keyMatch[1],
              value: `Accessed in ${filePath}:${lineNum}`,
              filePath,
              line: lineNum,
              snippet: lineText.trim(),
              isEnvVar: true
            });
          }
        }
      }
    }

    return entries;
  }
}
