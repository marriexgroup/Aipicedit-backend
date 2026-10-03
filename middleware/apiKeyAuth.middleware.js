const crypto = require('crypto');

/**
 * Middleware to authenticate requests using an x-api-key header.
 * Attaches a unique request_id (UUID) to req.requestId.
 * Validates against process.env.N8N_API_KEY.
 */
function apiKeyAuth(req, res, next) {
  // Ensure every request has a unique request_id
  if (!req.requestId) {
    req.requestId = crypto.randomUUID();
  }

  const configuredKey = (process.env.N8N_API_KEY || '123').trim();
  const providedKey = (req.headers['x-api-key'] || req.headers['X-API-KEY'] || '').trim();

  if (!configuredKey) {
    console.error(`[API_V1] [${req.requestId}] Server configuration error: N8N_API_KEY is not set in environment.`);
    return res.status(500).json({
      success: false,
      request_id: req.requestId,
      error: 'SERVER_CONFIGURATION_ERROR',
      message: 'Authentication service is not properly configured.'
    });
  }

  if (!providedKey) {
    return res.status(401).json({
      success: false,
      request_id: req.requestId,
      error: 'UNAUTHORIZED',
      message: "Missing API key. Please provide a valid 'x-api-key' header."
    });
  }

  // Constant-time comparison to prevent timing attacks
  const providedBuffer = Buffer.from(providedKey);
  const configuredBuffer = Buffer.from(configuredKey);

  const isValid = providedBuffer.length === configuredBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, configuredBuffer);

  if (!isValid) {
    return res.status(401).json({
      success: false,
      request_id: req.requestId,
      error: 'UNAUTHORIZED',
      message: "Invalid API key. Please verify your credentials."
    });
  }

  next();
}

module.exports = apiKeyAuth;
