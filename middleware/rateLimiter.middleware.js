const crypto = require('crypto');

/**
 * In-memory sliding window rate limiter middleware.
 * Prevents endpoint abuse and protects against unexpected AI-generation costs.
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000; // default 1 minute
  const maxRequests = options.maxRequests || parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 20; // default 20 per minute

  // Map of clientKey -> Array of timestamps (ms)
  const clients = new Map();

  // Periodic cleanup every 5 minutes to prevent memory leak
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of clients.entries()) {
      const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
      if (validTimestamps.length === 0) {
        clients.delete(key);
      } else {
        clients.set(key, validTimestamps);
      }
    }
  }, 5 * 60 * 1000);

  // Unref the interval so it doesn't prevent Node from shutting down
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return function rateLimiter(req, res, next) {
    // Generate request_id if not already present
    if (!req.requestId) {
      req.requestId = crypto.randomUUID();
    }

    // Identify client by API key header or client IP
    const apiKey = req.headers['x-api-key'] || req.headers['X-API-KEY'] || '';
    const clientKey = apiKey
      ? crypto.createHash('sha256').update(apiKey).digest('hex')
      : req.ip || req.connection.remoteAddress || 'unknown-client';

    const now = Date.now();
    const timestamps = clients.get(clientKey) || [];

    // Filter out timestamps outside the sliding window
    const validTimestamps = timestamps.filter(ts => now - ts < windowMs);

    // Calculate rate limit headers
    const remaining = Math.max(0, maxRequests - validTimestamps.length);
    const resetTimeSeconds = Math.ceil(windowMs / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining > 0 ? remaining - 1 : 0);
    res.setHeader('X-RateLimit-Reset', resetTimeSeconds);

    if (validTimestamps.length >= maxRequests) {
      const oldestTimestamp = validTimestamps[0];
      const retryAfterSeconds = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
      res.setHeader('Retry-After', Math.max(1, retryAfterSeconds));

      console.warn(`[API_V1] [${req.requestId}] Rate limit exceeded for clientKey ${clientKey.slice(0, 8)}... (${validTimestamps.length}/${maxRequests})`);

      return res.status(429).json({
        success: false,
        request_id: req.requestId,
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Limit is ${maxRequests} requests per ${windowMs / 1000} seconds. Please retry after ${Math.max(1, retryAfterSeconds)} seconds.`
      });
    }

    validTimestamps.push(now);
    clients.set(clientKey, validTimestamps);

    next();
  };
}

module.exports = createRateLimiter;
