const { loadConfig } = require("./config");

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

async function requestTargetLLM(config, userPrompt, context, mode) {
  switch (config.provider.toLowerCase()) {
    case "anthropic":
      return anthropicProvider.generate(config, userPrompt, context, mode);
    case "openai":
      return openaiProvider.generate(config, userPrompt, context, mode);
    case "groq":
      return groqProvider.generate(config, userPrompt, context, mode);
    case "gemini":
      return geminiProvider.generate(config, userPrompt, context, mode);
    case "ollama":
    default:
      return ollamaProvider.generate(config, userPrompt, context, mode);
  }
}

/**
 * Main exposed function for the MCP Server
 */
async function generate({ userPrompt, context, mode, configOverride }) {
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
      requestTargetLLM(config, userPrompt, safeContext, mode),
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
