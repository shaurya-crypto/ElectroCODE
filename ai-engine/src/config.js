const fs = require("fs");
const path = require("path");
const os = require("os");
const dotenv = require("dotenv");

function loadConfig() {
  const isWin = process.platform === "win32";
  const userDataPath = isWin 
    ? path.join(process.env.APPDATA || "", "ElectroAI")
    : path.join(os.homedir(), ".config", "ElectroAI");
    
  const settingsPath = path.join(userDataPath, "config", "settings.json");
  
  if (!fs.existsSync(settingsPath)) {
    // Check old .env for migration or defaults
    const oldEnvPath = path.join(userDataPath, ".env");
    if (fs.existsSync(oldEnvPath)) {
       // Manual parse or just return defaults for now
    }

    return {
      provider: "ollama",
      apiKey: "",
      model: "llama3.1",
      baseUrl: "http://localhost:11434"
    };
  }

  try {
    const content = fs.readFileSync(settingsPath, "utf-8");
    const json = JSON.parse(content);
    
    return {
      provider: json.provider || "ollama",
      apiKey: json.apiKey || "", // Note: might be encrypted "enc:..."
      model: json.model || "",
      baseUrl: json.baseUrl || ""
    };
  } catch (e) {
    return {
      provider: "ollama",
      apiKey: "",
      model: "llama3.1",
      baseUrl: "http://localhost:11434"
    };
  }
}

module.exports = { loadConfig };
