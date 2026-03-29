const logger = require("../utils/logger");

/**
 * Intercepts LLM calls downstream. If the API key is exhausted (429),
 * it elegantly maps it back to the React toast UI instead of crashing Node!
 */
function externalAPIRateLimiter(err, req, res, next) {
  // If this error object actually comes from an LLM request
  if (err && err.status === 429) {
    logger.warn(`API Quota Exceeded for Session [${req.body?.sessionId || 'Unknown'}]`);
    return res.status(429).json({
      success: false,
      error: "API limit reached. Please check your external provider API quota or billing settings."
    });
  }
  
  // Hand off generic unknown crashes back to standard Express handlers
  next(err);
}

module.exports = externalAPIRateLimiter;
