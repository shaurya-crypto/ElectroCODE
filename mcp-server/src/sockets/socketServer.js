const { WebSocketServer } = require("ws");
const fileWatcher = require("../watchers/fileWatcher");
const serialService = require("../services/serialService");
const store = require("../store/contextStore");
const sessionManager = require("../store/sessionManager");
const logger = require("../utils/logger");

function initializeSockets(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    // Spin up a new dedicated memory pool for this client tab
    const sessionId = sessionManager.createSession(ws, req);

    // Initial explicit handshake containing the sessionId
    ws.send(JSON.stringify({ type: "SESSION_ESTABLISHED", data: { sessionId } }));

    ws.on("message", (message) => {
      try {
        const payload = JSON.parse(message);
        const { type, data } = payload;

        // Vital: Update active session state
        switch (type) {
          case "PING":
            sessionManager.pingReceived(sessionId);
            ws.send(JSON.stringify({ type: "PONG" }));
            break;
            
          case "code_sync":
            fileWatcher.onCodeSync(sessionId, data);
            break;
          
          case "telemetry_tick":
            serialService.ingestData(sessionId, data.line);
            break;
            
          case "device_update":
            store.setDeviceDetails(sessionId, data);
            break;

          default:
            logger.debug(`Unknown websocket event: ${type}`);
        }
      } catch (err) {
        logger.error(`Error processing WS message: ${err.message}`);
      }
    });

    // Anomaly pushing tailored strictly to THIS specific session
    const anomalyListener = (targetSessionId, anomalyData) => {
      if (targetSessionId === sessionId) {
        ws.send(JSON.stringify({ type: "anomaly_detected", data: anomalyData.reason }));
      }
    };

    store.on("anomaly_detected", anomalyListener);

    ws.on("close", () => {
      sessionManager.destroySession(sessionId);
      store.off("anomaly_detected", anomalyListener);
    });
  });

  return wss;
}

module.exports = {
  initializeSockets
};
