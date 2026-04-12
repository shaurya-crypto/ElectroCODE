module.exports = {
  PORT: process.env.PORT || 5000,
  WS_PORT: process.env.WS_PORT || 4001,
  MAX_SERIAL_LOG_LINES: 100,
  AI_API_TIMEOUT_MS: 15000,
  SUPPORTED_CHIPS: ["RP2040", "ESP32", "ATmega328P", "STM32F103"],
};
