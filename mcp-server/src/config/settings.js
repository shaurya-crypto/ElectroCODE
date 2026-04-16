// In production (Electron ASAR), there is no .env file.
// Config is passed via the request body from the Main process.
try {
  require("dotenv").config();
} catch (_) {
  // dotenv is optional in production
}

module.exports = {
  getEnvironment: () => process.env.NODE_ENV || "development",
  getAiApiKey: () => process.env.AI_API_KEY || "",
  getAiEngineUrl: () => process.env.AI_ENGINE_URL || "http://localhost:4000/api/generate",
};
