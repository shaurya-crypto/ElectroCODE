const logger = require("./logger");

/**
 * Truncates logs
 */
function truncateLogs(logsArray, maxLines) {
  if (!Array.isArray(logsArray)) return [];
  if (logsArray.length <= maxLines) return logsArray;
  return logsArray.slice(logsArray.length - maxLines);
}

/**
 * Advanced Traceback / Anomaly detection
 * Maps to strict errorTypes: 'syntax', 'runtime', 'hardware', 'connection'
 */
function detectAnomaly(logLine) {
  if (typeof logLine !== 'string') return null;
  const lower = logLine.toLowerCase();
  
  // Syntax mappings
  if (lower.includes("syntaxerror")) {
    return { type: "syntax", reason: "Python SyntaxError Detected" };
  }
  // Hardware mappings
  if (lower.includes("guru meditation error") || lower.includes("core panic")) {
    return { type: "hardware", reason: "ESP32 Core Dump / Hardware Fault Detected" };
  }
  // Connection / OS Mappings
  if (lower.includes("oserror") || lower.includes("errno 110")) {
    return { type: "connection", reason: "OSError: I2C/SPI Device Not Found or Timeout" };
  }
  // Generic Runtime mappings
  if (lower.includes("traceback") || lower.match(/error\s*:/i)) {
    return { type: "runtime", reason: "Python Runtime Traceback Detected" };
  }
  
  return null;
}

/**
 * Smart Sensor Parsing: Transforms 'Temp: 24C' to { sensor: 'temp', value: 24, unit: 'C' }
 */
function extractStructuredTelemetry(logLine) {
  if (typeof logLine !== 'string') return null;
  
  // Very rough heuristic for explicit "Key: Value Unit" pairs on IoT sensors
  const regex = /([A-Za-z0-9_]+)\s*[:=]\s*([-+]?[0-9]*\.?[0-9]+)\s*([A-Za-z%]*)/;
  const match = logLine.match(regex);
  
  if (match) {
    return {
      sensor: match[1].trim().toLowerCase(),
      value: parseFloat(match[2]),
      unit: match[3]?.trim() || ""
    };
  }
  return null;
}

/**
 * Bounds chunking
 */
function chunkCodeSurroundingLine(codeBuffer, cursorLine, contextRadius = 50) {
  if (!codeBuffer) return "";
  const lines = codeBuffer.split('\n');
  const start = Math.max(0, cursorLine - contextRadius);
  const end = Math.min(lines.length - 1, cursorLine + contextRadius);
  
  const chunk = lines.slice(start, end).join('\n');
  
  if (start > 0 || end < lines.length - 1) {
    return `... [Code truncated] ...\n${chunk}\n... [End truncated] ...`;
  }
  return chunk;
}

module.exports = {
  truncateLogs,
  detectAnomaly,
  extractStructuredTelemetry,
  chunkCodeSurroundingLine
};
