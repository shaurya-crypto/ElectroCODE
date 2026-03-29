const fs = require("fs");
const path = require("path");
const os = require("os");
const dotenv = require("dotenv");

function loadConfig() {
  const LOCAL_APP_DATA = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  const envPath = path.join(LOCAL_APP_DATA, "ElectroAI", ".env");
  
  if (!fs.existsSync(envPath)) {
    return {
      provider: "ollama",
      apiKey: "",
      model: "llama3.1",
      baseUrl: "http://localhost:11434"
    };
  }

  // Live reload: read directly from disk bypassing Node's cache
  const env = dotenv.parse(fs.readFileSync(envPath));
  
  return {
    provider: env.ACTIVE_PROVIDER || "ollama",
    apiKey: env.API_KEY || "",
    model: env.MODEL || "",
    baseUrl: env.BASE_URL || "" // Used primarily by ollama
  };
}

module.exports = { loadConfig };
