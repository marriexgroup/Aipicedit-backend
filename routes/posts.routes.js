const express = require('express');
const router = express.Router();
const {  getScheduledPostsByUser, createScheduledPosts } = require('../controllers/posts.controller');

router.get('/getscheduledposts/:userId', getScheduledPostsByUser);
router.post('/createscheduledpost/:userId', createScheduledPosts);

module.exports = router;