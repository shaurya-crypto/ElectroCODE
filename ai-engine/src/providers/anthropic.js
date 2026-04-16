const { buildSystemPrompt } = require("./systemPrompt");

async function generate(config, userPrompt, context, mode, activeFile, referencedFiles) {
  const modelVer = config.model || "claude-3-5-sonnet-20241022";
  const systemText = buildSystemPrompt(context, mode, activeFile, referencedFiles);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: modelVer,
      max_tokens: 4096,
      system: systemText,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  if (!response.ok) {
    throw { status: response.status, message: await response.text() };
  }

  const json = await response.json();
  const rawText = json.content[0].text;
  return parseMarkdownResponse(rawText);
}

module.exports = { generate };

/**
 * Parse Markdown response from LLM.
 * Extracts code blocks and returns structured response.
 */
function parseMarkdownResponse(text) {
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const codeBlocks = [];
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    codeBlocks.push({ language: match[1] || "python", code: match[2].trimEnd() });
  }

  // Remove code blocks from text to get explanation
  const explanation = text.replace(codeBlockRegex, "").trim();

  if (codeBlocks.length > 0) {
    // Combine all code blocks (primary is the largest one)
    const primaryCode = codeBlocks.reduce((a, b) => a.code.length >= b.code.length ? a : b);
    return {
      type: "code_update",
      code: primaryCode.code,
      explanation: explanation || "Here are the code changes."
    };
  }

  // Pure conversational response — no code
  return { type: "chat", payload: text };
}
