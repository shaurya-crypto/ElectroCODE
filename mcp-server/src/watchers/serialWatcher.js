const store = require("../store/contextStore");
const { detectAnomaly, extractStructuredTelemetry } = require("../utils/parser");
const logger = require("../utils/logger");

class SerialWatcher {
  /**
   * Called by serialService mapped linearly to a sessionId
   */
  onData(sessionId, logLine) {
    if (!logLine) return; // Ignore completely empty ticks

    // 1. Structure the parsing
    const structured = extractStructuredTelemetry(logLine);
    
    // 2. Persist to Circular Arrays
    store.appendTelemetry(sessionId, { raw: logLine, structured });
    
    // 3. Scan for crashes
    const anomaly = detectAnomaly(logLine);
    if (anomaly) {
      logger.warn(`Anomaly automatically detected [${sessionId}]: ${anomaly.type}`);
      store.setAnomalyFlag(sessionId, anomaly);
    }
  }
}

module.exports = new SerialWatcher();
