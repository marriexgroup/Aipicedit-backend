const express = require('express');
const router = express.Router();
const { 
    generateLongVideo, 
    getLongVideoStatus, 
    getLongVideoUrls, 
    cancelLongVideo,
    getAllVideos
} = require('../controllers/longvideo.controller');

// Long video generation routes
router.post('/generate-long-video', generateLongVideo);
router.get('/status/:userId/:videoId', getLongVideoStatus);
router.get('/urls/:userId/:videoId', getLongVideoUrls);
router.post('/cancel/:userId/:videoId', cancelLongVideo);
router.get('/all/:userId', getAllVideos);

module.exports = router;
