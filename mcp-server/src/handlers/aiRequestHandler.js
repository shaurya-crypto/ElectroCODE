const projectContext = require("../context/projectContext");
const aiBridge = require("../services/aiBridge");
const suggestionHandler = require("./suggestionHandler");
const logger = require("../utils/logger");

async function handleAiRequest(req, res) {
  try {
    const userPrompt = req.body.prompt || "Please suggest code";
    const sessionId = req.body.sessionId;
    let explicitIntent = req.body.intent || "general_help";
    
    logger.info(`[AiRequestHandler] Incoming GenRequest for Session: ${sessionId}`);

    // Fetch unified bounds via prioritizing Validators
    const completeContextPayload = projectContext.composeContextPayload(sessionId);
    const sessionSnapshot = store.getSnapshot(sessionId);
    const workspacePath = req.body.workspacePath || "";

    // 🔍 NEW: Resolve explicit mentions like @main.py or @config.json
    const { resolveRefMentions } = require("../utils/contextResolver");
    const referencedFiles = resolveRefMentions(userPrompt, sessionSnapshot, workspacePath);

    // Smart Auto-Detector for "Mode"
    let mode = "code"; 
    
    if (completeContextPayload.critical?.fault_isolation) {
      const anomalyType = completeContextPayload.critical.fault_isolation.type;
      
      switch(anomalyType) {
        case "syntax": 
          mode = "debug"; break;
        case "runtime":
        case "hardware": 
          mode = "debug"; break;
        case "connection":
          mode = "explain"; break;
      }
    } 
    // Fallback UX logic
    else if (userPrompt.toLowerCase().startsWith("why") || userPrompt.toLowerCase().includes("explain")) {
      mode = "explain";
    }

    logger.debug(`Auto-Detected execution mode: ${mode}`);

    // Await AI Generation mapped cleanly
    const result = await aiBridge.generate({
      userPrompt,
      context: completeContextPayload,
      activeFile: {
        name: sessionSnapshot.editor.active_file || "untitled",
        content: sessionSnapshot.editor.code_buffer,
        cursor: sessionSnapshot.editor.cursor_position,
        selection: sessionSnapshot.editor.selection
      },
      referencedFiles,
      mode,
      apiConfig: req.body.apiConfig
    });

    // Translate LLM text to precise UX patches
    const finalDiff = suggestionHandler.formatResponseToEditorDiff(result.response_text);

    return res.status(200).json({
      success: true,
      data: finalDiff,
      meta: { timestamp: Date.now(), mode_used: mode }
    });

  } catch (e) {
    logger.error(`[AiRequestHandler] Error: ${e.message || JSON.stringify(e)}`);
    
    // Pass API limit errors back up to the Global RateLimiter fallback
    if (e.status === 429) {
      throw e;
    }
    
    return res.status(500).json({ error: e.message || "Context processing failed" });
  }
}

module.exports = {
  handleAiRequest
};
