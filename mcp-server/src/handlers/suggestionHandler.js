function formatResponseToEditorDiff(jsonPayload) {
  // If the payload is already strict JSON format coming from our AI Engine:
  if (jsonPayload && jsonPayload.type === 'code_update') {
    return {
      type: 'code_update',
      code: jsonPayload.code || '',
      explanation: jsonPayload.explanation || 'Updated code.'
    };
  }

  // Legacy fallback if the string parser accidentally leaks through (or Ollama fails formatting)
  let text = typeof jsonPayload === 'string' ? jsonPayload : JSON.stringify(jsonPayload);
  return {
    type: "legacy_insert",
    payload: text
  };
}

module.exports = { formatResponseToEditorDiff };
