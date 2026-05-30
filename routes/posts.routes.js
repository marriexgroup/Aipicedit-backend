const express = require('express');
const router = express.Router();
const { getScheduledPostsByUser, createScheduledPosts, getUserPosts } = require('../controllers/posts.controller');
const authMiddleware = require('../auth.middleware');

router.get('/getscheduledposts/:userId', getScheduledPostsByUser);
router.post('/createscheduledpost/:userId', createScheduledPosts);

// Route for regular users: get their own posts + posts on their assigned pages
router.get(
  '/userposts/:userId',
  authMiddleware.authenticateToken,
  getUserPosts
);

module.exports = router;