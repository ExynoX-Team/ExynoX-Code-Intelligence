import type { BenchmarkDataset } from '../types.js';

export const jsGatewayBenchmarkDataset: BenchmarkDataset = {
  id: 'js-nexus-gateway-benchmark',
  name: 'Nexus API Gateway (JavaScript Suite)',
  description: 'Deterministic benchmark suite for JavaScript AST structural intelligence, module resolution, and cross-file callers.',
  version: '1.0.0',
  targetRepository: 'nexus-api-gateway',
  queries: [
    {
      id: 'js-q1-auth-validation',
      query: 'Where is token validation implemented in the gateway?',
      description: 'Identifies the validateToken function definition in authService.js',
      queryType: 'definition',
      expectedSymbols: ['validateToken'],
      expectedEvidence: [
        {
          file: 'src/auth/authService.js',
          startLine: 10,
          endLine: 25,
          symbol: 'validateToken'
        }
      ],
      expectedAnswerSubstring: 'validateToken'
    },
    {
      id: 'js-q2-gateway-init',
      query: 'Which function initializes the API gateway and binds routes?',
      description: 'Finds initializeGateway in src/index.js',
      queryType: 'definition',
      expectedSymbols: ['initializeGateway'],
      expectedEvidence: [
        {
          file: 'src/index.js',
          startLine: 14,
          endLine: 40,
          symbol: 'initializeGateway'
        }
      ],
      expectedAnswerSubstring: 'initializeGateway'
    },
    {
      id: 'js-q3-telemetry-router',
      query: 'Find the TelemetryRouter class definition and its metric dispatching method',
      description: 'Finds TelemetryRouter class and dispatchMetric method in telemetryRouter.js',
      queryType: 'definition',
      expectedSymbols: ['TelemetryRouter', 'dispatchMetric'],
      expectedEvidence: [
        {
          file: 'src/router/telemetryRouter.js',
          symbol: 'TelemetryRouter'
        }
      ],
      expectedAnswerSubstring: 'TelemetryRouter'
    },
    {
      id: 'js-q4-metric-aggregation',
      query: 'How does MetricCollector calculate the mean of recorded samples?',
      description: 'Finds calculateMean in metricCollector.js',
      queryType: 'definition',
      expectedSymbols: ['calculateMean'],
      expectedEvidence: [
        {
          file: 'src/router/metricCollector.js',
          symbol: 'calculateMean'
        }
      ],
      expectedAnswerSubstring: 'calculateMean'
    },
    {
      id: 'js-q5-caller-issue-token',
      query: 'Who calls issueAccessToken?',
      description: 'Identifies callers of issueAccessToken from src/index.js route handler',
      queryType: 'caller',
      expectedSymbols: ['issueAccessToken'],
      expectedEvidence: [
        {
          file: 'src/index.js',
          symbol: 'issueAccessToken'
        }
      ],
      expectedAnswerSubstring: 'src/index.js'
    }
  ]
};
