const { buildSystemPrompt } = require("./systemPrompt");

async function generate(config, userPrompt, context, mode) {
  // Explicit fallback logic the user demanded for ollama defaults
  const baseURL = config.baseUrl || "http://localhost:11434";
  const modelVer = config.model || "llama3.1";
  
  const systemText = buildSystemPrompt(context, mode);

  const response = await fetch(baseURL + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelVer,
      stream: false,
      format: "json", // Instructs Ollama strictly
      messages: [
        { role: "system", content: systemText },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    throw { status: response.status, message: await response.text() };
  }

  const json = await response.json();
  return JSON.parse(json.message.content);
}

module.exports = { generate };
