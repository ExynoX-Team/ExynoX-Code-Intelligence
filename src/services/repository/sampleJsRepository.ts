import type { RepositoryFile, IndexingProgress } from '../../types/index.js';
import { RepositoryWorkspace } from './repositoryWorkspace.js';
import type { ProgressCallback } from './zipIngestion.js';

export const SAMPLE_JS_FILES: Record<string, string> = {
  'package.json': `{
  "name": "nexus-api-gateway",
  "version": "2.4.0",
  "description": "Enterprise API gateway with JWT authentication, telemetry routing, and rate limiting",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5"
  }
}`,

  'src/index.js': `/**
 * Nexus API Gateway - Main Application Entrypoint
 * Orchestrates middleware, database connections, and route dispatch.
 */
import express from 'express';
import { loadGatewayConfig } from './config/gatewayConfig.js';
import { authenticateRequest, issueAccessToken } from './auth/authService.js';
import { TelemetryRouter } from './router/telemetryRouter.js';
import { AuditLogger } from './utils/auditLogger.js';

const app = express();
const config = loadGatewayConfig();
const logger = new AuditLogger('gateway-core');
const router = new TelemetryRouter();

export function initializeGateway(port = 3000) {
  logger.logEvent('SYSTEM_STARTUP', { port, env: config.environment });
  
  app.use(express.json());
  
  // Register routes
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const token = issueAccessToken(username, ['user', 'metrics']);
    return res.json({ token, status: 'authenticated' });
  });

  app.post('/api/telemetry', authenticateRequest, (req, res) => {
    const outcome = router.dispatchMetric(req.body);
    return res.json({ success: outcome });
  });

  return app.listen(port, () => {
    console.log(\`Nexus API Gateway listening on port \${port}\`);
  });
}

export function handleIncomingDeeplink(uri) {
  if (uri && uri.startsWith('gateway://metrics')) {
    return router.handleIncomingDeeplink(uri);
  }
  return false;
}

if (process.env.NODE_ENV !== 'test') {
  initializeGateway(config.port || 3000);
}
`,

  'src/config/gatewayConfig.js': `/**
 * Application configuration provider
 */
export function loadGatewayConfig() {
  return {
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    jwtSecret: process.env.JWT_SECRET || 'nexus_super_secret_dev_key_32bytes!',
    rateLimitPerMinute: 120,
    metricsBufferCapacity: 5000
  };
}

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || 'postgres://gateway_user:prism_secret@localhost:5432/gateway_db';
}
`,

  'src/auth/authService.js': `/**
 * Authentication and Token Verification Service
 */
import { AuditLogger } from '../utils/auditLogger.js';
import { loadGatewayConfig } from '../config/gatewayConfig.js';

const logger = new AuditLogger('auth-service');
const config = loadGatewayConfig();

export function validateToken(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }
  if (!token.startsWith('ey') && !token.startsWith('nexus_sec_')) {
    return false;
  }
  return token.length >= 24;
}

export function issueAccessToken(username, roles = ['user']) {
  logger.logEvent('TOKEN_ISSUED', { username, roles });
  return \`nexus_sec_\${Buffer.from(username).toString('base64')}_\${Date.now()}\`;
}

export function authenticateRequest(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.replace(/^Bearer\\s+/, '');
  const isValid = validateToken(token);

  if (!isValid) {
    logger.logEvent('AUTH_FAILURE', { tokenSnippet: token.slice(0, 8) });
    return res.status(403).json({ error: 'Invalid or expired credentials' });
  }

  req.user = { authenticated: true, token };
  return next();
}
`,

  'src/router/telemetryRouter.js': `/**
 * Telemetry and Metrics Dispatch Router
 */
import { MetricCollector } from './metricCollector.js';
import { AuditLogger } from '../utils/auditLogger.js';

export class TelemetryRouter {
  constructor() {
    this.collector = new MetricCollector();
    this.logger = new AuditLogger('telemetry-router');
  }

  dispatchMetric(payload) {
    if (!payload || !payload.metricName) {
      return false;
    }
    this.logger.logEvent('METRIC_RECEIVED', { name: payload.metricName });
    return this.collector.recordSample(payload.metricName, payload.value || 0);
  }

  handleIncomingDeeplink(uri) {
    this.logger.logEvent('DEEPLINK_ROUTED', { uri });
    return true;
  }

  getMetricsSummary() {
    return this.collector.getAggregatedSummary();
  }
}
`,

  'src/router/metricCollector.js': `/**
 * In-Memory Metric Aggregator and Statistical Collector
 */
export class MetricCollector {
  constructor() {
    this.samples = new Map();
  }

  recordSample(metricName, value) {
    if (!this.samples.has(metricName)) {
      this.samples.set(metricName, []);
    }
    const series = this.samples.get(metricName);
    series.push({ value, timestamp: Date.now() });
    return true;
  }

  calculateMean(metricName) {
    const series = this.samples.get(metricName);
    if (!series || series.length === 0) return 0;
    const sum = series.reduce((acc, item) => acc + item.value, 0);
    return sum / series.length;
  }

  getAggregatedSummary() {
    const summary = {};
    for (const [key, list] of this.samples.entries()) {
      summary[key] = {
        count: list.length,
        mean: this.calculateMean(key)
      };
    }
    return summary;
  }
}
`,

  'src/utils/auditLogger.js': `/**
 * Security Audit and Operational Telemetry Logger
 */
export class AuditLogger {
  constructor(context = 'general') {
    this.context = context;
    this.events = [];
  }

  logEvent(eventType, metadata = {}) {
    const record = {
      id: \`evt_\${Date.now()}_\${Math.random().toString(36).slice(2, 6)}\`,
      context: this.context,
      eventType,
      metadata,
      timestamp: new Date().toISOString()
    };
    this.events.push(record);
    return record;
  }

  getRecentLogs(limit = 10) {
    return this.events.slice(-limit);
  }
}
`,

  'README.md': `# Nexus API Gateway
High-throughput microservice gateway providing authentication, rate limiting, and telemetry aggregation.

## Architecture
- \`src/index.js\`: Core application startup and HTTP router initialization.
- \`src/auth/authService.js\`: Token verification (\`validateToken\`) and bearer middleware.
- \`src/router/telemetryRouter.js\`: Metrics routing and deeplink dispatching.
- \`src/router/metricCollector.js\`: Statistical aggregation.
- \`src/utils/auditLogger.js\`: Security event tracking.
`
};

export function loadSampleJavaScriptRepository(
  onProgress?: ProgressCallback
): RepositoryWorkspace {
  const fileEntries: [string, RepositoryFile][] = [];

  const updateProgress = (
    stage: IndexingProgress['stage'],
    message: string,
    currentStepIndex: number
  ) => {
    if (!onProgress) return;
    onProgress({
      stage,
      message,
      currentStepIndex,
      steps: [
        { id: '1', label: 'Loading JavaScript repository files', status: currentStepIndex > 0 ? 'completed' : 'in_progress' },
        { id: '2', label: 'Parsing AST and module relationships', status: currentStepIndex > 1 ? 'completed' : currentStepIndex === 1 ? 'in_progress' : 'pending' },
        { id: '3', label: 'Building BM25 and vector retrieval index', status: currentStepIndex > 2 ? 'completed' : currentStepIndex === 2 ? 'in_progress' : 'pending' },
        { id: '4', label: 'Repository intelligence ready', status: currentStepIndex >= 3 ? 'completed' : 'pending' }
      ]
    });
  };

  updateProgress('received', 'Loading JavaScript sample files...', 0);

  for (const [path, sourceText] of Object.entries(SAMPLE_JS_FILES)) {
    const lines = sourceText.split('\n');
    const ext = path.split('.').pop() || '';
    const isJs = ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs';

    fileEntries.push([
      path,
      {
        path,
        extension: ext,
        size: new Blob([sourceText]).size,
        language: isJs ? 'javascript' : (ext === 'json' ? 'json' : 'markdown'),
        isPython: false,
        lineCount: lines.length,
        sourceText,
        lines
      }
    ]);
  }

  updateProgress('reading_python', 'Building JavaScript AST & caller graph...', 1);

  const filesMap = new Map(fileEntries);

  const workspace = new RepositoryWorkspace({
    repositoryName: 'nexus-api-gateway (JavaScript Sample)',
    sourceType: 'sample',
    sourceUrl: 'embedded://nexus-api-gateway',
    files: filesMap,
    ignoredCount: 0
  });

  updateProgress('building_workspace', 'Indexing lexical BM25 & semantic vectors...', 2);
  updateProgress('ready', 'JavaScript repository intelligence ready', 3);

  return workspace;
}
