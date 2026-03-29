const store = require("./contextStore");
const logger = require("../utils/logger");

class SessionManager {
  constructor() {
    this.sessions = new Map(); // Tracks lastPing timestamps
    
    // Auto-sweep zombies every 30 seconds
    setInterval(() => this.sweepZombies(), 30000);
  }

  createSession(ws, req) {
    // Generate a quick random ID for the connection
    const sessionId = Math.random().toString(36).substring(2, 9);
    
    // Init state inside the store
    store.initSession(sessionId);
    
    this.sessions.set(sessionId, {
      ws,
      lastPing: Date.now()
    });
    
    logger.info(`Session Initialized: [${sessionId}]`);
    return sessionId;
  }

  pingReceived(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastPing = Date.now();
    }
  }

  destroySession(sessionId) {
    if (this.sessions.has(sessionId)) {
      this.sessions.delete(sessionId);
      store.destroySession(sessionId);
      logger.info(`Session Terminated & Cleaned: [${sessionId}]`);
    }
  }

  sweepZombies() {
    const now = Date.now();
    const timeoutThreshold = 60000; // 60 seconds of silence = dead

    for (const [sessionId, sessionData] of this.sessions.entries()) {
      if (now - sessionData.lastPing > timeoutThreshold) {
        logger.warn(`Zombie session detected (No PING for 60s). Purging [${sessionId}]`);
        // Terminate the socket connection
        try {
          sessionData.ws.terminate();
        } catch(e) {}
        this.destroySession(sessionId);
      }
    }
  }
}

module.exports = new SessionManager();