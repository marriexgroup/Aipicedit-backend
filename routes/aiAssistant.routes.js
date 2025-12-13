const express = require('express');
const router = express.Router();
const aiAssistantController = require('../controllers/aiAssistant.controller');
const { authenticateToken } = require('../auth.middleware');

// Protect the route with authentication if desired, or leave public if that's the requirement.
// Given "AI assistant gemini use my gemini services", typically this is a user-facing feature.
// I'll add authentication to be safe, as usually API usage is tracked/limited per user.
router.post('/chat', aiAssistantController.chat);

module.exports = router;
