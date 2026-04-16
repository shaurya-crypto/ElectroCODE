const { buildSystemPrompt } = require("./systemPrompt");

async function generate(config, userPrompt, context, mode, activeFile, referencedFiles) {
  const baseURL = config.baseUrl || "http://localhost:11434";
  const modelVer = config.model || "llama3.1";
  const systemText = buildSystemPrompt(context, mode, activeFile, referencedFiles);

  const response = await fetch(baseURL + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelVer,
      stream: false,
      // NO format: "json" — we accept natural Markdown
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
  const rawText = json.message.content;
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
