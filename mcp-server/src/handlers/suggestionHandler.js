/**
 * Formats AI response for the frontend editor.
 * Now handles both structured (code_update/chat) and raw Markdown responses.
 */
function formatResponseToEditorDiff(responsePayload) {
  // Structured response from our new Markdown parser
  if (responsePayload && responsePayload.type === 'code_update') {
    return {
      type: 'code_update',
      code: responsePayload.code || '',
      explanation: responsePayload.explanation || 'Updated code.'
    };
  }

  // Chat/conversational response
  if (responsePayload && responsePayload.type === 'chat') {
    return {
      type: 'chat',
      payload: responsePayload.payload || ''
    };
  }

  // Fallback: treat as plain text
  let text = typeof responsePayload === 'string' ? responsePayload : JSON.stringify(responsePayload);
  
  // Try to extract code blocks from raw text (safety net)
  const codeMatch = text.match(/```\w*\n([\s\S]*?)```/);
  if (codeMatch) {
    const explanation = text.replace(/```\w*\n[\s\S]*?```/g, '').trim();
    return {
      type: 'code_update',
      code: codeMatch[1].trimEnd(),
      explanation: explanation || 'Code generated.'
    };
  }

  return {
    type: "chat",
    payload: text
  };
}

module.exports = { formatResponseToEditorDiff };
