const express = require('express');
const router = express.Router();
const { generateVideo, checkVideoStatus } = require('../controllers/video.controller');

// Define the POST route for video generation
// POST /api/video/generate-video
router.post('/generate-video', generateVideo);
router.get('/status/:operationId/:type/:userId/:pageId', checkVideoStatus);

module.exports = router;
