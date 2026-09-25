import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import cors from 'cors';
const app = express();
app.use(cors({
  origin: 'https://exynox-team.github.io',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key']
}));

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

function isTransientDemandError(err: unknown): boolean {
  const str = err instanceof Error ? err.message : String(err);
  return (
    str.includes('503') ||
    str.includes('UNAVAILABLE') ||
    str.includes('high demand') ||
    str.includes('overloaded') ||
    str.includes('429') ||
    str.includes('RESOURCE_EXHAUSTED') ||
    str.includes('rate limit')
  );
}

function parseErrorStatusAndMessage(err: unknown, defaultStatus = 500): {
  status: number;
  code: string;
  category: 'unavailable' | 'auth' | 'rate_limit' | 'timeout' | 'network' | 'unknown';
  title: string;
  message: string;
} {
  const raw = err instanceof Error ? err.message : String(err);
  let statusCode = defaultStatus;

  try {
    const parsed = JSON.parse(raw);
    if (parsed.error && typeof parsed.error === 'object') {
      if (parsed.error.code) statusCode = Number(parsed.error.code);
    }
  } catch {
    // not JSON
  }

  const lower = raw.toLowerCase();

  if (statusCode === 503 || statusCode === 500 || statusCode === 502 || lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand') || lower.includes('overloaded')) {
    return {
      status: statusCode === 500 ? 500 : (statusCode === 502 ? 502 : 503),
      code: 'PROVIDER_UNAVAILABLE',
      category: 'unavailable',
      title: 'AI provider is temporarily unavailable',
      message: 'The selected model is experiencing high demand. Please try again in a moment or choose another provider/model.'
    };
  }

  if (statusCode === 401 || statusCode === 403 || lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('api_key_invalid')) {
    return {
      status: statusCode === 403 ? 403 : 401,
      code: statusCode === 403 ? 'PROVIDER_PERMISSION_ERROR' : 'PROVIDER_AUTH_ERROR',
      category: 'auth',
      title: 'Provider authorization problem',
      message: 'API key or provider authorization problem.'
    };
  }

  if (statusCode === 429 || lower.includes('429') || lower.includes('rate limit') || lower.includes('resource_exhausted')) {
    return {
      status: 429,
      code: 'PROVIDER_RATE_LIMITED',
      category: 'rate_limit',
      title: 'AI provider rate limit reached',
      message: 'Provider rate limit reached. Please try again later.'
    };
  }

  if (statusCode === 504 || lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimedout')) {
    return {
      status: 504,
      code: 'PROVIDER_TIMEOUT',
      category: 'timeout',
      title: 'AI provider did not respond in time',
      message: 'AI provider did not respond in time.'
    };
  }

  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('econnrefused') || lower.includes('network error')) {
    return {
      status: 502,
      code: 'NETWORK_ERROR',
      category: 'network',
      title: 'Unable to reach the AI provider',
      message: 'Unable to reach the AI provider.'
    };
  }

  return {
    status: statusCode,
    code: 'UNKNOWN_ERROR',
    category: 'unknown',
    title: 'AI provider request failed',
    message: 'AI provider request failed. Please try again.'
  };
}

function logProviderError(provider: string, model: string, status: number): void {
  if (status === 503) {
    console.error(`LLM provider unavailable: provider=${provider} status=503 model=${model}`);
  } else if (status === 401 || status === 403) {
    console.error(`LLM provider auth error: provider=${provider} status=${status} model=${model}`);
  } else if (status === 429) {
    console.error(`LLM provider rate limit: provider=${provider} status=429 model=${model}`);
  } else {
    console.error(`LLM provider error: provider=${provider} status=${status} model=${model}`);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // API Routes
  // 1. Health & LLM Status
  app.get('/api/llm/status', (_req, res) => {
    res.json({
      availableProviders: ['gemini', 'openai', 'claude'],
      hasServerGeminiKey: !!process.env.GEMINI_API_KEY,
      defaultProvider: 'gemini',
      defaultModel: 'gemini-3.8-flash'
    });
  });

  // 2. Generate LLM response securely
  app.post('/api/llm/generate', async (req, res) => {
    try {
      const { provider, model, prompt, systemPrompt, messages, temperature, maxTokens, jsonMode } = req.body;
      const userApiKey = req.headers['x-api-key'] as string | undefined;

      if (provider === 'gemini') {
        const apiKey = userApiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return res.status(400).json({ 
            error: 'Google Gemini API key is missing. Please provide a key in the AI Configuration menu or configure GEMINI_API_KEY.' 
          });
        }

        const ai = new GoogleGenAI({ 
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });
        let contents = prompt || '';
        if (messages && Array.isArray(messages) && messages.length > 0) {
          contents = messages.map((m: { role: string; content: string }) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
        }

        const primaryModel = model || 'gemini-3.8-flash';
        try {
          const response = await ai.models.generateContent({
            model: primaryModel,
            contents,
            config: {
              systemInstruction: systemPrompt,
              temperature: typeof temperature === 'number' ? temperature : 0.1,
              maxOutputTokens: maxTokens || 1024,
              responseMimeType: jsonMode ? 'application/json' : undefined
            }
          });

          const resultText = response.text || '';
          return res.json({
            ok: true,
            text: resultText,
            provider: 'gemini',
            model: primaryModel,
            finishReason: 'stop',
            response: {
              text: resultText,
              provider: 'gemini',
              model: primaryModel,
              finishReason: 'stop'
            }
          });
        } catch (callErr: unknown) {
          console.error('GEMINI RAW ERROR:', callErr);
          const parsed = parseErrorStatusAndMessage(callErr, 503);
          logProviderError('gemini', primaryModel, parsed.status);
          return res.status(parsed.status).json({
            ok: false,
            error: parsed.message,
            code: parsed.code,
            title: parsed.title,
            category: parsed.category,
            status: parsed.status,
            provider: 'gemini',
            model: primaryModel,
            retryable: parsed.status === 503 || parsed.status === 429
          });
        }
      }

      if (provider === 'openai') {
        const apiKey = userApiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return res.status(400).json({ 
            error: 'OpenAI API key is missing. Please activate an OpenAI API key (sk-...) in the AI Configuration menu.' 
          });
        }

        const openaiMessages: { role: string; content: string }[] = [];
        if (systemPrompt) {
          openaiMessages.push({ role: 'system', content: systemPrompt });
        }
        if (messages && Array.isArray(messages) && messages.length > 0) {
          openaiMessages.push(...messages);
        } else if (prompt) {
          openaiMessages.push({ role: 'user', content: prompt });
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || 'gpt-4o',
            messages: openaiMessages,
            temperature: typeof temperature === 'number' ? temperature : 0.1,
            max_tokens: maxTokens || 1024,
            response_format: jsonMode ? { type: 'json_object' } : undefined
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({} as Record<string, unknown>)) as { error?: { message?: string } };
          const err = new Error(errData?.error?.message || `OpenAI API returned error status ${response.status}`);
          const parsed = parseErrorStatusAndMessage(err, response.status);
          logProviderError('openai', model || 'gpt-4o', parsed.status);
          return res.status(parsed.status).json({
            ok: false,
            error: parsed.message,
            code: parsed.code,
            title: parsed.title,
            category: parsed.category,
            status: parsed.status,
            provider: 'openai',
            model: model || 'gpt-4o',
            retryable: parsed.status === 503 || parsed.status === 429
          });
        }

        const data = await response.json() as {
          choices?: { message?: { content?: string }; finish_reason?: string }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };

        const resultText = data.choices?.[0]?.message?.content || '';
        return res.json({
          ok: true,
          text: resultText,
          provider: 'openai',
          model: model || 'gpt-4o',
          finishReason: data.choices?.[0]?.finish_reason || 'stop',
          response: {
            text: resultText,
            provider: 'openai',
            model: model || 'gpt-4o',
            finishReason: data.choices?.[0]?.finish_reason || 'stop'
          },
          usage: {
            promptTokens: data.usage?.prompt_tokens,
            completionTokens: data.usage?.completion_tokens
          }
        });
      }

      if (provider === 'claude') {
        const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return res.status(400).json({ 
            error: 'Anthropic Claude API key is missing. Please activate an Anthropic API key in the AI Configuration menu.' 
          });
        }

        const claudeMessages: { role: 'user' | 'assistant'; content: string }[] = [];
        if (messages && Array.isArray(messages) && messages.length > 0) {
          for (const m of messages as { role: string; content: string }[]) {
            if (m.role === 'system') continue;
            claudeMessages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
          }
        } else if (prompt) {
          claudeMessages.push({ role: 'user', content: prompt });
        }

        const sysPrompt = systemPrompt || (messages as { role: string; content: string }[] | undefined)?.find(m => m.role === 'system')?.content;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: model || 'claude-3-5-sonnet-20241022',
            messages: claudeMessages,
            system: sysPrompt,
            temperature: typeof temperature === 'number' ? temperature : 0.1,
            max_tokens: maxTokens || 1024
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({} as Record<string, unknown>)) as { error?: { message?: string } };
          const err = new Error(errData?.error?.message || `Anthropic Claude API returned error status ${response.status}`);
          const parsed = parseErrorStatusAndMessage(err, response.status);
          logProviderError('claude', model || 'claude-3-5-sonnet-20241022', parsed.status);
          return res.status(parsed.status).json({
            ok: false,
            error: parsed.message,
            code: parsed.code,
            title: parsed.title,
            category: parsed.category,
            status: parsed.status,
            provider: 'claude',
            model: model || 'claude-3-5-sonnet-20241022',
            retryable: parsed.status === 503 || parsed.status === 429
          });
        }

        const data = await response.json() as {
          content?: { type: string; text?: string }[] | string;
          stop_reason?: string;
          usage?: { input_tokens?: number; output_tokens?: number };
        };

        const resultText = Array.isArray(data.content)
          ? data.content.map(c => c.text || '').join('')
          : (data.content || '');

        return res.json({
          ok: true,
          text: resultText,
          provider: 'claude',
          model: model || 'claude-3-5-sonnet-20241022',
          finishReason: data.stop_reason || 'stop',
          response: {
            text: resultText,
            provider: 'claude',
            model: model || 'claude-3-5-sonnet-20241022',
            finishReason: data.stop_reason || 'stop'
          },
          usage: {
            promptTokens: data.usage?.input_tokens,
            completionTokens: data.usage?.output_tokens
          }
        });
      }

      return res.status(400).json({ error: `Unknown provider '${provider}'` });
    } catch (err: unknown) {
      const { provider, model } = req.body || {};
      const parsed = parseErrorStatusAndMessage(err);
      logProviderError(provider || 'unknown', model || 'default', parsed.status);
      return res.status(parsed.status).json({
        error: parsed.message,
        title: parsed.title,
        category: parsed.category,
        status: parsed.status,
        provider: provider || 'unknown',
        model: model || 'default',
        retryable: parsed.status === 503 || parsed.status === 429
      });
    }
  });

  // Serve public static assets (including official logo /exynox-logo.png)
  const publicPath = path.join(process.cwd(), 'public');
  app.use(express.static(publicPath));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ExynoX server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
