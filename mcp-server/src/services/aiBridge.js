const logger = require("../utils/logger");
const aiClient = require("../../../ai-engine/src/aiClient");

/**
 * Handles LLM prompt mapping depending strictly on the `mode` schema
 */
async function generate(payload) {
  const { userPrompt, context, activeFile, referencedFiles, mode, apiConfig } = payload;
  logger.info(`Calling AI Engine using Mode: [${mode.toUpperCase()}]`);

  // Routes request into the modular AI Engine 
  // It handles local .env validation, fallbacks, tokens, and multi-providers!
  const response = await aiClient.generate({ 
    userPrompt, 
    context, 
    activeFile,
    referencedFiles,
    mode, 
    configOverride: apiConfig 
  });
  
  if (response.error) {
    if (response.error.type === "RATE_LIMIT") {
      throw { status: 429, message: response.error.message };  
    }
    throw new Error(`AI Engine Failure: ${response.error.message}`);
  }

  return response;
}

module.exports = {
  generate
};
