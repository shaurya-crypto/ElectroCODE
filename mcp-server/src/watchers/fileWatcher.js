const store = require("../store/contextStore");
const logger = require("../utils/logger");

class FileWatcher {
  onCodeSync(sessionId, data) {
    const { filePath, content, cursorLine, cursorChar, selectedText } = data;
    
    store.setEditorState(sessionId, {
      active_file: filePath,
      code_buffer: content,
      cursor_position: { line: cursorLine, column: cursorChar },
      highlighted_code: selectedText
    });
  }
}

module.exports = new FileWatcher();
