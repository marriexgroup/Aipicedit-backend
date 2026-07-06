const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth.middleware');
const {
  generateVoiceVideo,
  getVoiceVideoStatus,
  getAllVoiceVideos
} = require('../controllers/voiceVideo.controller');

// Generate video based on story text prompt
router.post('/generate', authenticateToken, generateVoiceVideo);

// Check generation status
router.get('/status/:videoId', authenticateToken, getVoiceVideoStatus);

// Fetch user history
router.get('/history', authenticateToken, getAllVoiceVideos);

module.exports = router;
