require("dotenv").config();

module.exports = {
  getEnvironment: () => process.env.NODE_ENV || "development",
  getAiApiKey: () => process.env.AI_API_KEY || "",
  getAiEngineUrl: () => process.env.AI_ENGINE_URL || "http://localhost:5000/api/generate",
};
