const store = require("../store/contextStore");

function getFormattedSensorState(sessionId) {
  const state = store.getSnapshot(sessionId);
  if (!state) return null;
  
  const { telemetry } = state;
  return {
    recent_logs: telemetry.logs,
    structured_sensors: telemetry.structured_sensors,
    latest_anomaly: telemetry.latest_anomaly,
    status: telemetry.latest_anomaly ? "CRITICAL" : "OK"
  };
}

module.exports = { getFormattedSensorState };
