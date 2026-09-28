var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_cors = __toESM(require("cors"), 1);
var app = (0, import_express.default)();
app.use((0, import_cors.default)({
  origin: "https://exynox-team.github.io",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key"]
}));
import_dotenv.default.config();
var PORT = Number(process.env.PORT) || 3e3;
function parseErrorStatusAndMessage(err, defaultStatus = 500) {
  const raw = err instanceof Error ? err.message : String(err);
  let statusCode = defaultStatus;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.error && typeof parsed.error === "object") {
      if (parsed.error.code) statusCode = Number(parsed.error.code);
    }
  } catch {
  }
  const lower = raw.toLowerCase();
  if (statusCode === 503 || statusCode === 500 || statusCode === 502 || lower.includes("503") || lower.includes("unavailable") || lower.includes("high demand") || lower.includes("overloaded")) {
    return {
      status: statusCode === 500 ? 500 : statusCode === 502 ? 502 : 503,
      code: "PROVIDER_UNAVAILABLE",
      category: "unavailable",
      title: "AI provider is temporarily unavailable",
      message: "The selected model is experiencing high demand. Please try again in a moment or choose another provider/model."
    };
  }
  if (statusCode === 401 || statusCode === 403 || lower.includes("401") || lower.includes("403") || lower.includes("unauthorized") || lower.includes("forbidden") || lower.includes("api_key_invalid")) {
    return {
      status: statusCode === 403 ? 403 : 401,
      code: statusCode === 403 ? "PROVIDER_PERMISSION_ERROR" : "PROVIDER_AUTH_ERROR",
      category: "auth",
      title: "Provider authorization problem",
      message: "API key or provider authorization problem."
    };
  }
  if (statusCode === 429 || lower.includes("429") || lower.includes("rate limit") || lower.includes("resource_exhausted")) {
    return {
      status: 429,
      code: "PROVIDER_RATE_LIMITED",
      category: "rate_limit",
      title: "AI provider rate limit reached",
      message: "Provider rate limit reached. Please try again later."
    };
  }
  if (statusCode === 504 || lower.includes("timeout") || lower.includes("timed out") || lower.includes("etimedout")) {
    return {
      status: 504,
      code: "PROVIDER_TIMEOUT",
      category: "timeout",
      title: "AI provider did not respond in time",
      message: "AI provider did not respond in time."
    };
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("econnrefused") || lower.includes("network error")) {
    return {
      status: 502,
      code: "NETWORK_ERROR",
      category: "network",
      title: "Unable to reach the AI provider",
      message: "Unable to reach the AI provider."
    };
  }
  return {
    status: statusCode,
    code: "UNKNOWN_ERROR",
    category: "unknown",
    title: "AI provider request failed",
    message: "AI provider request failed. Please try again."
  };
}
function logProviderError(provider, model, status) {
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
  const app2 = (0, import_express.default)();
  app2.use(import_express.default.json({ limit: "10mb" }));
  app2.get("/api/llm/status", (_req, res) => {
    res.json({
      availableProviders: ["gemini", "openai", "claude"],
      hasServerGeminiKey: !!process.env.GEMINI_API_KEY,
      defaultProvider: "gemini",
      defaultModel: "gemini-3.1-flash-lite"
    });
  });
  app2.post("/api/llm/generate", async (req, res) => {
    try {
      const { provider, model, prompt, systemPrompt, messages, temperature, maxTokens, jsonMode } = req.body;
      const userApiKey = req.headers["x-api-key"];
      if (provider === "gemini") {
        const apiKey = userApiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return res.status(400).json({
            error: "Google Gemini API key is missing. Please provide a key in the AI Configuration menu or configure GEMINI_API_KEY."
          });
        }
        const ai = new import_genai.GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build"
            }
          }
        });
        let contents = prompt || "";
        if (messages && Array.isArray(messages) && messages.length > 0) {
          contents = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
        }
        const primaryModel = model || "gemini-3.1-flash-lite";
        try {
          const response = await ai.models.generateContent({
            model: primaryModel,
            contents,
            config: {
              systemInstruction: systemPrompt,
              temperature: typeof temperature === "number" ? temperature : 0.1,
              maxOutputTokens: maxTokens || 1024,
              responseMimeType: jsonMode ? "application/json" : void 0
            }
          });
          const resultText = response.text || "";
          return res.json({
            ok: true,
            text: resultText,
            provider: "gemini",
            model: primaryModel,
            finishReason: "stop",
            response: {
              text: resultText,
              provider: "gemini",
              model: primaryModel,
              finishReason: "stop"
            }
          });
        } catch (callErr) {
          console.error("GEMINI RAW ERROR:", callErr);
          const parsed = parseErrorStatusAndMessage(callErr, 503);
          logProviderError("gemini", primaryModel, parsed.status);
          return res.status(parsed.status).json({
            ok: false,
            error: parsed.message,
            code: parsed.code,
            title: parsed.title,
            category: parsed.category,
            status: parsed.status,
            provider: "gemini",
            model: primaryModel,
            retryable: parsed.status === 503 || parsed.status === 429
          });
        }
      }
      if (provider === "openai") {
        const apiKey = userApiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return res.status(400).json({
            error: "OpenAI API key is missing. Please activate an OpenAI API key (sk-...) in the AI Configuration menu."
          });
        }
        const openaiMessages = [];
        if (systemPrompt) {
          openaiMessages.push({ role: "system", content: systemPrompt });
        }
        if (messages && Array.isArray(messages) && messages.length > 0) {
          openaiMessages.push(...messages);
        } else if (prompt) {
          openaiMessages.push({ role: "user", content: prompt });
        }
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || "gpt-4o",
            messages: openaiMessages,
            temperature: typeof temperature === "number" ? temperature : 0.1,
            max_tokens: maxTokens || 1024,
            response_format: jsonMode ? { type: "json_object" } : void 0
          })
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const err = new Error(errData?.error?.message || `OpenAI API returned error status ${response.status}`);
          const parsed = parseErrorStatusAndMessage(err, response.status);
          logProviderError("openai", model || "gpt-4o", parsed.status);
          return res.status(parsed.status).json({
            ok: false,
            error: parsed.message,
            code: parsed.code,
            title: parsed.title,
            category: parsed.category,
            status: parsed.status,
            provider: "openai",
            model: model || "gpt-4o",
            retryable: parsed.status === 503 || parsed.status === 429
          });
        }
        const data = await response.json();
        const resultText = data.choices?.[0]?.message?.content || "";
        return res.json({
          ok: true,
          text: resultText,
          provider: "openai",
          model: model || "gpt-4o",
          finishReason: data.choices?.[0]?.finish_reason || "stop",
          response: {
            text: resultText,
            provider: "openai",
            model: model || "gpt-4o",
            finishReason: data.choices?.[0]?.finish_reason || "stop"
          },
          usage: {
            promptTokens: data.usage?.prompt_tokens,
            completionTokens: data.usage?.completion_tokens
          }
        });
      }
      if (provider === "claude") {
        const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return res.status(400).json({
            error: "Anthropic Claude API key is missing. Please activate an Anthropic API key in the AI Configuration menu."
          });
        }
        const claudeMessages = [];
        if (messages && Array.isArray(messages) && messages.length > 0) {
          for (const m of messages) {
            if (m.role === "system") continue;
            claudeMessages.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content });
          }
        } else if (prompt) {
          claudeMessages.push({ role: "user", content: prompt });
        }
        const sysPrompt = systemPrompt || messages?.find((m) => m.role === "system")?.content;
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: model || "claude-3-5-sonnet-20241022",
            messages: claudeMessages,
            system: sysPrompt,
            temperature: typeof temperature === "number" ? temperature : 0.1,
            max_tokens: maxTokens || 1024
          })
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const err = new Error(errData?.error?.message || `Anthropic Claude API returned error status ${response.status}`);
          const parsed = parseErrorStatusAndMessage(err, response.status);
          logProviderError("claude", model || "claude-3-5-sonnet-20241022", parsed.status);
          return res.status(parsed.status).json({
            ok: false,
            error: parsed.message,
            code: parsed.code,
            title: parsed.title,
            category: parsed.category,
            status: parsed.status,
            provider: "claude",
            model: model || "claude-3-5-sonnet-20241022",
            retryable: parsed.status === 503 || parsed.status === 429
          });
        }
        const data = await response.json();
        const resultText = Array.isArray(data.content) ? data.content.map((c) => c.text || "").join("") : data.content || "";
        return res.json({
          ok: true,
          text: resultText,
          provider: "claude",
          model: model || "claude-3-5-sonnet-20241022",
          finishReason: data.stop_reason || "stop",
          response: {
            text: resultText,
            provider: "claude",
            model: model || "claude-3-5-sonnet-20241022",
            finishReason: data.stop_reason || "stop"
          },
          usage: {
            promptTokens: data.usage?.input_tokens,
            completionTokens: data.usage?.output_tokens
          }
        });
      }
      return res.status(400).json({ error: `Unknown provider '${provider}'` });
    } catch (err) {
      const { provider, model } = req.body || {};
      const parsed = parseErrorStatusAndMessage(err);
      logProviderError(provider || "unknown", model || "default", parsed.status);
      return res.status(parsed.status).json({
        error: parsed.message,
        title: parsed.title,
        category: parsed.category,
        status: parsed.status,
        provider: provider || "unknown",
        model: model || "default",
        retryable: parsed.status === 503 || parsed.status === 429
      });
    }
  });
  const publicPath = import_path.default.join(process.cwd(), "public");
  app2.use(import_express.default.static(publicPath));
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa"
    });
    app2.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app2.use(import_express.default.static(distPath));
    app2.get("*", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`ExynoX server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
