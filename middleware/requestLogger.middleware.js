const crypto = require('crypto');

/**
 * Sanitizes an object by masking sensitive keys (passwords, tokens, api keys).
 */
function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const sensitiveKeys = [
    'x-api-key', 'authorization', 'cookie', 'password',
    'token', 'secret', 'apikey', 'api_key', 'key',
    'access_token', 'refresh_token', 'client_secret'
  ];

  const sanitized = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = sensitiveKeys.some(s => key.toLowerCase().includes(s));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Safe request logger middleware.
 * Logs method, path, request_id, IP, and duration while strictly redacting all credentials.
 */
function requestLogger(req, res, next) {
  if (!req.requestId) {
    req.requestId = crypto.randomUUID();
  }

  const startTime = Date.now();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  const safeBody = sanitize(req.body);
  console.log(`[API_V1] [${new Date().toISOString()}] [${req.requestId}] Incoming ${req.method} ${req.originalUrl || req.url} | IP: ${clientIp} | Payload: ${JSON.stringify(safeBody)}`);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[API_V1] [${new Date().toISOString()}] [${req.requestId}] Completed ${req.method} ${req.originalUrl || req.url} | Status: ${res.statusCode} | Duration: ${duration}ms`);
  });

  next();
}

module.exports = requestLogger;
