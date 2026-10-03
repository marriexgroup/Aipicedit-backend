const express = require('express');
const router = express.Router();

const apiKeyAuth = require('../middleware/apiKeyAuth.middleware');
const createRateLimiter = require('../middleware/rateLimiter.middleware');
const requestLogger = require('../middleware/requestLogger.middleware');
const { generateSocialPostController } = require('../controllers/socialPost.controller');

// Apply safe request logging to all /api/v1 routes
router.use(requestLogger);

// Rate limiter: 20 requests/min default (configurable via RATE_LIMIT_MAX_REQUESTS / RATE_LIMIT_WINDOW_MS)
const rateLimiter = createRateLimiter();

/**
 * @route   POST /api/v1/generate-social-post
 * @desc    Generate social media post copy (title, description, hashtags) and an AI image in S3
 * @access  Protected (x-api-key)
 */
router.post(
  '/generate-social-post',
  rateLimiter,
  apiKeyAuth,
  generateSocialPostController
);

module.exports = router;
