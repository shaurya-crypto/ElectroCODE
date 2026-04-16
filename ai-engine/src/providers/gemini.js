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
      contents: [{ role: "user", parts: [{ text: userPrompt }] }]
      // NO response_mime_type json — we accept natural Markdown
    })
  });

  if (!response.ok) {
    throw { status: response.status, message: await response.text() };
  }

  const json = await response.json();
  const rawText = json.candidates[0].content.parts[0].text;
  return parseMarkdownResponse(rawText);
}

module.exports = { generate };

function parseMarkdownResponse(text) {
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const codeBlocks = [];
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    codeBlocks.push({ language: match[1] || "python", code: match[2].trimEnd() });
  }

  const explanation = text.replace(codeBlockRegex, "").trim();

  if (codeBlocks.length > 0) {
    const primaryCode = codeBlocks.reduce((a, b) => a.code.length >= b.code.length ? a : b);
    return {
      type: "code_update",
      code: primaryCode.code,
      explanation: explanation || "Here are the code changes."
    };
  }

  return { type: "chat", payload: text };
}
