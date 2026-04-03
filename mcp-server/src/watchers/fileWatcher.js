const store = require("../store/contextStore");
const logger = require("../utils/logger");

class FileWatcher {
  onCodeSync(sessionId, data) {
    const { filePath, content, cursorLine, cursorChar, selectedText, selection } = data;
    
    store.setEditorState(sessionId, {
      active_file: filePath,
      code_buffer: content,
      cursor_position: { line: cursorLine, column: cursorChar },
      selection: selection || { startLine: 0, startColumn: 0, endLine: 0, endColumn: 0 },
      highlighted_code: selectedText
    });
  }
}

module.exports = new FileWatcher();
