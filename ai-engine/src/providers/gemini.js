const { buildSystemPrompt } = require("./systemPrompt");

async function generate(config, userPrompt, context, mode, activeFile, referencedFiles) {
  const modelVer = config.model || "gemini-1.5-flash";
  const systemText = buildSystemPrompt(context, mode, activeFile, referencedFiles);

  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelVer + ":generateContent?key=" + config.apiKey;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: { text: systemText } },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { response_mime_type: "application/json" }
    })
  });

  if (!response.ok) {
    throw { status: response.status, message: await response.text() };
  }

  const json = await response.json();
  const rawText = json.candidates[0].content.parts[0].text;
  return JSON.parse(rawText);
}

module.exports = { generate };
