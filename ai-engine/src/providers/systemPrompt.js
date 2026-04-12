function buildSystemPrompt(contextJSON, mode, activeFile, referencedFiles = []) {
  let modeInstructions = "";

  if (mode === "debug") {
    modeInstructions = `You are a strict code repairing system. Focus specifically on debugging the tracebacks inside the context.`;
  } else if (mode === "explain") {
    modeInstructions = `You are an IoT embedded explanations engine. Explain concepts clearly. Do not return changes unless needed.`;
  } else {
    modeInstructions = `You are a pure Code Generator for embedded Py devices. Complete the code inside the smart buffer seamlessly.`;
  }

  const activeFileContext = activeFile ? `
### CURRENT_WORKING_FILE: ${activeFile.name}
${activeFile.content}
` : "";

  const refContext = referencedFiles.length > 0 ? `
### REFERENCED_CONTEXT:
${referencedFiles.map(f => `FILE: ${f.name}\nCONTENT:\n${f.content}`).join("\n\n---\n\n")}
` : "";

  return `${modeInstructions}

### RULES FOR RESPONSE FORMAT:
Never output markdown backticks \`\`\` around your entire response.
You MUST output raw parseable JSON. Choose one of the following schemas based on the user's intent:

SCHEMA 1 - FOR GENERAL CHAT, GREETINGS, OR PURE EXPLANATIONS:
{
  "type": "chat",
  "payload": "Your helpful response, explanation, or greeting in markdown formatting."
}

SCHEMA 2 - FOR HARDWARE COMMANDS, CODING, OR REFACTORING:
{
  "type": "code_update",
  "code": "The FULL, COMPLETE, and ERROR-FREE source code here. Do not leave blank.",
  "explanation": "A short summary explaining the code changes you made."
}

IMPORTANT FOR SCHEMA 2: If the user asks for code, do not be lazy. You MUST put the full script in the \`code\` field. Give full code, not incomplete code.

${activeFileContext}
${refContext}

Here is the strict telemetry and structured context from the user's IDE:
${JSON.stringify(contextJSON)}
`;
}

module.exports = { buildSystemPrompt };
