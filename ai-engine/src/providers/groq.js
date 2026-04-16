const { buildSystemPrompt } = require("./systemPrompt");

async function generate(config, userPrompt, context, mode, activeFile, referencedFiles) {
  const modelVer = config.model || "llama-3.1-8b-instant";
  const systemText = buildSystemPrompt(context, mode, activeFile, referencedFiles);

  // First attempt: with json_object response format
  let response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + config.apiKey
    },
    body: JSON.stringify({
      model: modelVer,
      response_format: { type: "json_object" }, 
      messages: [
        { role: "system", content: systemText },
        { role: "user", content: userPrompt }
      ]
    })
  });

  // If Groq's strict JSON mode fails (json_validate_failed), retry without it
  if (!response.ok) {
    const errText = await response.text();
    
    if (response.status === 400 && errText.includes("json_validate_failed")) {
      console.log("[AI-ENGINE] Groq json_object mode failed, retrying with manual parsing...");
      
      // Extract the failed generation and try to repair it
      try {
        const errObj = JSON.parse(errText);
        const rawGeneration = errObj.error?.failed_generation;
        if (rawGeneration) {
          const repaired = repairJSON(rawGeneration);
          if (repaired) return repaired;
        }
      } catch (_) {}

      // Fallback: retry without json_object constraint
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + config.apiKey
        },
        body: JSON.stringify({
          model: modelVer,
          messages: [
            { role: "system", content: systemText + "\n\nIMPORTANT: Output ONLY valid JSON. Escape all special characters in strings properly (use \\n for newlines, \\\" for quotes)." },
            { role: "user", content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        throw { status: response.status, message: await response.text() };
      }

      const json = await response.json();
      const rawText = json.choices[0].message.content;
      return parseWithRepair(rawText);
    }

    throw { status: response.status, message: errText };
  }

  const json = await response.json();
  const rawText = json.choices[0].message.content;
  return JSON.parse(rawText);
}

/**
 * Attempt to repair malformed JSON from LLM output.
 * Common issue: unescaped quotes/newlines inside the "code" field.
 */
function repairJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch (_) {}

  try {
    // Strategy: extract code and explanation fields manually
    // Look for "code": " ... " pattern and "explanation": " ... " pattern
    const codeMatch = raw.match(/"code"\s*:\s*"([\s\S]*?)"\s*,\s*"explanation"/);
    const explMatch = raw.match(/"explanation"\s*:\s*"([\s\S]*?)"\s*\}?\s*$/);
    const typeMatch = raw.match(/"type"\s*:\s*"(\w+)"/);

    if (typeMatch && typeMatch[1] === "chat") {
      const payloadMatch = raw.match(/"payload"\s*:\s*"([\s\S]*?)"\s*\}?\s*$/);
      return {
        type: "chat",
        payload: payloadMatch ? payloadMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : raw
      };
    }

    if (codeMatch && explMatch) {
      return {
        type: "code_update",
        code: codeMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\"),
        explanation: explMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
      };
    }
  } catch (_) {}

  return null;
}

/**
 * Parse LLM text output, with fallback repair for malformed JSON
 */
function parseWithRepair(rawText) {
  // Strip markdown fences if present
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const repaired = repairJSON(cleaned);
    if (repaired) return repaired;

    // Last resort: treat entire output as a chat response
    return { type: "chat", payload: rawText };
  }
}

module.exports = { generate };
