const codeContext = require("./codeContext");
const sensorContext = require("./sensorContext");
const deviceContext = require("./deviceContext");
const { prioritizeAndValidate } = require("./contextValidator");

function composeContextPayload(sessionId) {
  const codeState = codeContext.getFormattedCodeState(sessionId);
  const sensorState = sensorContext.getFormattedSensorState(sessionId);
  const deviceState = deviceContext.getFormattedDeviceState(sessionId);

  if (!codeState || !sensorState || !deviceState) {
    throw new Error(`Cannot compose context for unknown sessionId: ${sessionId}`);
  }

  // Categorize smartly
  const rawPayload = {
    // ALWAYS RETAINED
    critical: {
      hardware_constraints: deviceState,
      fault_isolation: sensorState.status === "CRITICAL" ? sensorState.latest_anomaly : null
    },
    // RETAINED UNLESS OVERFLOW
    important: {
      active_workspace: codeState
    },
    // DROPPED IF HUGE
    optional: {
      telemetry_history: sensorState.recent_logs,
      structured_data: sensorState.structured_sensors
    },
    // Used universally backcompat
    environment: {
      device: deviceState,
      workspace: codeState,
      telemetry: sensorState
    },
    meta: { timestamp: Date.now(), sessionId }
  };

  return prioritizeAndValidate(rawPayload);
}

module.exports = { composeContextPayload };
