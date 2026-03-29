const getTimestamp = () => new Date().toISOString();

const logger = {
  info: (msg, ...args) => console.log(`[${getTimestamp()}] [INFO] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[${getTimestamp()}] [WARN] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[${getTimestamp()}] [ERROR] ${msg}`, ...args),
  debug: (msg, ...args) => {
    if (process.env.DEBUG === 'true') {
      console.log(`[${getTimestamp()}] [DEBUG] ${msg}`, ...args);
    }
  }
};

module.exports = logger;
