const { loadConfig } = require("./config");
const https = require("https");
const http = require("http");

if (!global.fetchPolyfilled) {
  global.fetch = function (url, options = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const reqModule = parsedUrl.protocol === "http:" ? http : https;

      const req = reqModule.request(
        url,
        {
          method: options.method || "GET",
          headers: options.headers || {},
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              text: async () => body,
              json: async () => JSON.parse(body),
            });
          });
        }
      );

      req.on("error", reject);

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  };
  global.fetchPolyfilled = true;
}
// Load raw HTTP drivers
const anthropicProvider = require("./providers/anthropic");
const openaiProvider = require("./providers/openai");
const ollamaProvider = require("./providers/ollama");
const groqProvider = require("./providers/groq");
const geminiProvider = require("./providers/gemini");

const TIMEOUT_MS = 30000; // 25s for complex code generation tasks
const MAX_TOKENS = 12000;

function trimContextLen(contextJSON) {
  if (!contextJSON) return {};
  let len = JSON.stringify(contextJSON).length;
  if (len > MAX_TOKENS) {
     if (contextJSON.optional) {
        delete contextJSON.optional;
     }
  }
  return contextJSON;
}

async function requestTargetLLM(config, userPrompt, context, mode, activeFile, referencedFiles) {
  switch (config.provider.toLowerCase()) {
    case "anthropic":
      return anthropicProvider.generate(config, userPrompt, context, mode, activeFile, referencedFiles);
    case "openai":
      return openaiProvider.generate(config, userPrompt, context, mode, activeFile, referencedFiles);
    case "groq":
      return groqProvider.generate(config, userPrompt, context, mode, activeFile, referencedFiles);
    case "gemini":
      return geminiProvider.generate(config, userPrompt, context, mode, activeFile, referencedFiles);
    case "ollama":
    default:
      return ollamaProvider.generate(config, userPrompt, context, mode, activeFile, referencedFiles);
  }
}

/**
 * Main exposed function for the MCP Server
 */
async function generate({ userPrompt, context, mode, activeFile, referencedFiles, configOverride }) {
  // 1. Load config instantly off-disk
  const diskConfig = loadConfig();
  
  // Merge live UI React config with Disk Config as ultimate fallback
  const config = Object.assign({}, diskConfig, configOverride);

  // Guard API existence
  if (config.provider !== "ollama" && !config.apiKey) {
    return {
      error: {
        type: "INVALID_KEY",
        message: `Missing API Key for provider: ${config.provider}`
      }
    };
  }

  const safeContext = trimContextLen(context);

  // Debug: Confirm exactly what we are sending to the network
  console.log(`[AI-ENGINE] Dispatching to ${config.provider} (Model: ${config.model || 'DEFAULT'})`);

  try {
    const rawResult = await Promise.race([
      requestTargetLLM(config, userPrompt, safeContext, mode, activeFile, referencedFiles),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), TIMEOUT_MS))
    ]);

    console.log(`[AI-ENGINE] Response type: ${rawResult.type}, has code: ${!!(rawResult.code && rawResult.code.length > 0)}`);

    return {
      success: true,
      response_text: rawResult  // Pass the full object — NOT just the explanation string
    };
  } catch (err) {
    // Normalization Wrapper
    if (err.message === "Timeout") {
      return { error: { type: "TIMEOUT", message: "API Provider took too long to respond. Try another model" } };
    }
    if (err.status === 429) {
      return { error: { type: "RATE_LIMIT", message: "Quota Exhausted." } };
    }
    console.error("[AI-ENGINE] Raw error:", err);
    return { error: { type: "RUNTIME", message: err.message || JSON.stringify(err) } };
  }
}

module.exports = { generate };
