const http = require("http");
const express = require("express");
const cors = require("cors");
const { PORT } = require("./config/constants");
const logger = require("./utils/logger");

// Ext routes
const { handleAiRequest } = require("./handlers/aiRequestHandler");

// App
const app = express();
app.use(cors());
app.use(express.json());

// Boot contexts
const { initializeSockets } = require("./sockets/socketServer");
const serialService = require("./services/serialService");
const serialWatcher = require("./watchers/serialWatcher");
const externalAPIRateLimiter = require("./middleware/rateLimiter");

// Watchers
serialService.subscribe(serialWatcher);

// API Mappings
// Because handleAiRequest catches itself, to test our rateLimiter error middleware,
// we ensure it's globally pushed after routes!
app.post("/api/v1/ai/generate", async (req, res, next) => {
  try {
    await handleAiRequest(req, res);
  } catch (err) {
    next(err); 
  }
});

// Use interceptor
app.use(externalAPIRateLimiter);

// Launch Node
const server = http.createServer(app);
initializeSockets(server);

server.listen(PORT, () => {
  logger.info(`⚡ MCP Server listening on http://localhost:${PORT}`);
});
