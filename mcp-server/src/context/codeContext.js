const store = require("../store/contextStore");
const { chunkCodeSurroundingLine } = require("../utils/parser");

function getFormattedCodeState(sessionId) {
  const state = store.getSnapshot(sessionId);
  if (!state) return null;
  
  const { editor } = state;
  // Truncate surrounding area implicitly bounds token usage
  const smartBuffer = chunkCodeSurroundingLine(editor.code_buffer, editor.cursor_position.line, 75);

  return {
    active_file: editor.active_file || "untitled",
    cursor_position: editor.cursor_position,
    smart_buffer: smartBuffer,
    highlighted_code: editor.highlighted_code
  };
}

module.exports = { getFormattedCodeState };
