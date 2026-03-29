function buildSystemPrompt(contextJSON, mode) {
  let modeInstructions = "";

  if (mode === "debug") {
    modeInstructions = `You are a strict code repairing system. Focus specifically on debugging the tracebacks inside the context.`;
  } else if (mode === "explain") {
    modeInstructions = `You are an IoT embedded explanations engine. Explain concepts clearly. Do not return changes unless needed.`;
  } else {
    modeInstructions = `You are a pure Code Generator for embedded Py devices. Complete the code inside the smart buffer seamlessly.`;
  }

  return `${modeInstructions}

### RULES FOR RESPONSE FORMAT:
Never output markdown backticks \`\`\` around your entire response.
You MUST output raw parseable JSON perfectly matching this schema:
{
  "type": "code_update",
  "code": "The FULL, COMPLETE, and ERROR-FREE source code. YOU MUST WRITE THE CODE HERE! Never leave this blank unless asked a purely non-coding question. Do not skip or truncate anything.",
  "explanation": "A short message explaining what your code does."
}

IMPORTANT: Do NOT be lazy. If the user asks for code or a hardware feature, YOU MUST PUT THE FULL SCRIPT IN THE \`code\` FIELD.
Here is the strict context from the user's IDE:
${JSON.stringify(contextJSON)}
`;
}

module.exports = { buildSystemPrompt };
