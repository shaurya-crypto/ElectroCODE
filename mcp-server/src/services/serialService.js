const logger = require("../utils/logger");

class SerialService {
  constructor() {
    this.subscribers = [];
  }

  ingestData(sessionId, rawData) {
    if (!rawData) return;
    
    for (const sub of this.subscribers) {
      sub.onData(sessionId, rawData);
    }
  }

  subscribe(watcher) {
    this.subscribers.push(watcher);
    logger.debug("New watcher subscribed to SerialService.");
  }
}

module.exports = new SerialService();
