const socialPostService = require('../services/socialPost.service');

/**
 * Controller for handling POST /api/v1/generate-social-post
 */
async function generateSocialPostController(req, res) {
  const requestId = req.requestId;

  try {
    const { topic, platform, language } = req.body || {};

    // 1. Validation
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({
        success: false,
        request_id: requestId,
        error: 'VALIDATION_ERROR',
        message: "The 'topic' field is required and must be a non-empty string."
      });
    }

    const trimmedTopic = topic.trim();
    if (trimmedTopic.length < 3 || trimmedTopic.length > 1000) {
      return res.status(400).json({
        success: false,
        request_id: requestId,
        error: 'VALIDATION_ERROR',
        message: "The 'topic' field must be between 3 and 1000 characters."
      });
    }

    const targetPlatform = (typeof platform === 'string' && platform.trim())
      ? platform.trim().toLowerCase()
      : 'facebook';

    const targetLanguage = (typeof language === 'string' && language.trim())
      ? language.trim().toLowerCase()
      : 'english';

    // 2. Generation via Service
    const result = await socialPostService.generateSocialPost({
      topic: trimmedTopic,
      platform: targetPlatform,
      language: targetLanguage,
      requestId
    });

    // 3. Response
    return res.status(200).json({
      success: true,
      request_id: requestId,
      title: result.title,
      description: result.description,
      hashtags: result.hashtags,
      image_url: result.image_url
    });

  } catch (error) {
    console.error(`[API_V1] [${requestId}] Error generating social post:`, error.message);

    return res.status(500).json({
      success: false,
      request_id: requestId,
      error: 'GENERATION_FAILED',
      message: 'Unable to generate social post. Please verify your parameters or try again later.'
    });
  }
}

module.exports = {
  generateSocialPostController
};
