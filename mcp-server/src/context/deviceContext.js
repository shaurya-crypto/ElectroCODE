const store = require("../store/contextStore");

function getFormattedDeviceState(sessionId) {
  const state = store.getSnapshot(sessionId);
  if (!state) return null;
  
  const { device } = state;
  return {
    chip: device.chip || "Unknown",
    serial_port: device.serial_port || "Unknown",
    baud_rate: device.baud_rate || 115200,
    connected: device.connected
  };
}

module.exports = { getFormattedDeviceState };
