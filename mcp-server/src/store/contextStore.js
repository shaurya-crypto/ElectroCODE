const EventEmitter = require("events");
const { MAX_SERIAL_LOG_LINES } = require("../config/constants");

class ContextStore extends EventEmitter {
  constructor() {
    super();
    // Key: sessionId -> Value: { device, editor, telemetry }
    this.sessions = new Map();
  }

  initSession(sessionId) {
    this.sessions.set(sessionId, {
      device: {
        chip: null,
        serial_port: null,
        baud_rate: null,
        connected: false
      },
      editor: {
        active_file: null,
        code_buffer: "",
        cursor_position: { line: 0, column: 0 },
        highlighted_code: ""
      },
      telemetry: {
        logs: [], // Circular buffer style approach using array slicing
        latest_anomaly: null,
        structured_sensors: [] // Stores dict objects {sensor, value, unit}
      }
    });
  }

  destroySession(sessionId) {
    this.sessions.delete(sessionId);
  }

  _getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  // --- Device Mutations ---
  setDeviceDetails(sessionId, details) {
    const state = this._getSession(sessionId);
    if (!state) return;
    state.device = { ...state.device, ...details };
  }

  // --- Editor Mutations ---
  setEditorState(sessionId, editorDetails) {
    const state = this._getSession(sessionId);
    if (!state) return;
    state.editor = { ...state.editor, ...editorDetails };
  }

  // --- Telemetry Mutations ---
  appendTelemetry(sessionId, parsedLogObj) {
    const state = this._getSession(sessionId);
    if (!state) return;
    
    // Maintain maximum bounds to prevent RAM leaks
    state.telemetry.logs.push(parsedLogObj.raw);
    if (state.telemetry.logs.length > MAX_SERIAL_LOG_LINES) {
      state.telemetry.logs.shift(); // Quick circular buffer approach
    }

    if (parsedLogObj.structured) {
      state.telemetry.structured_sensors.push(parsedLogObj.structured);
      if (state.telemetry.structured_sensors.length > 50) {
        state.telemetry.structured_sensors.shift();
      }
    }

    this.emit("telemetry_tick", sessionId, parsedLogObj);
  }

  setAnomalyFlag(sessionId, anomalyData) {
    const state = this._getSession(sessionId);
    if (!state) return;
    state.telemetry.latest_anomaly = anomalyData;
    this.emit("anomaly_detected", sessionId, anomalyData);
  }

  // --- Global Access ---
  getSnapshot(sessionId) {
    const state = this._getSession(sessionId);
    if (!state) return null;
    return JSON.parse(JSON.stringify(state)); // Safe copy
  }
}

module.exports = new ContextStore();
