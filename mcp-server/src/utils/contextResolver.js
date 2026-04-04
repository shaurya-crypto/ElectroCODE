const fs = require("fs");
const path = require("path");
const logger = require("./logger");

/**
 * Parses the prompt for @mentions and resolves them to file content from the store or disk.
 * @param {string} prompt - The user prompt
 * @param {object} sessionState - The current session state from ContextStore
 * @param {string} workspacePath - The current opened folder path on disk
 */
function resolveRefMentions(prompt, sessionState, workspacePath) {
  if (!prompt) return [];

  // Regex to find @filename.ext (supporting dots, underscores, dashes)
  const mentionRegex = /@([a-zA-Z0-9._\-\/]+)/g;
  const matches = [...prompt.matchAll(mentionRegex)];
  const resolvedFiles = [];
  const handledNames = new Set();

  for (const match of matches) {
    const fileName = match[1];
    if (handledNames.has(fileName)) continue;
    handledNames.add(fileName);

    let resolvedContent = null;
    let resolvedPath = null;

    // Special Case: @terminal
    if (fileName.toLowerCase() === "terminal") {
      const logs = sessionState.telemetry.logs || [];
      resolvedContent = logs.length > 0 ? logs.join("\n") : "Terminal is empty.";
      resolvedPath = "SERIAL_TERMINAL_LOGS";
    }
    // 1. Check Attached Files in Store
    else if (sessionState.editor.attached_files && sessionState.editor.attached_files[fileName]) {
      const attached = sessionState.editor.attached_files;
      resolvedContent = attached[fileName].content;
      resolvedPath = attached[fileName].filePath;
    } 
    // 2. Check if it matches the current active file name
    else if (sessionState.editor.active_file === fileName || path.basename(sessionState.editor.active_file || "") === fileName) {
       resolvedContent = sessionState.editor.code_buffer;
       resolvedPath = sessionState.editor.active_file;
    }
    // 3. Try to resolve from disk if workspacePath is provided
    else if (workspacePath) {
      try {
        // Simple exact match or base name match in the root
        const fullPath = path.isAbsolute(fileName) ? fileName : path.join(workspacePath, fileName);
        if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
           resolvedContent = fs.readFileSync(fullPath, "utf-8");
           resolvedPath = fullPath;
        }
      } catch (err) {
        logger.debug(`Could not resolve @mention ${fileName} from disk: ${err.message}`);
      }
    }

    if (resolvedContent !== null) {
      resolvedFiles.push({
        name: fileName,
        path: resolvedPath,
        content: resolvedContent
      });
    }
  }

  return resolvedFiles;
}

module.exports = { resolveRefMentions };
