const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../auth.middleware'); // For authenticateToken

// Profile route - requires authentication
router.get('/profile', authMiddleware.authenticateToken, userController.getProfile);
router.put('/profile', authMiddleware.authenticateToken, userController.updateProfile);

// Settings route - requires authentication
router.get('/settings', authMiddleware.authenticateToken, userController.getSettings);
router.put('/update/stroange', userController.updateUserStorage);

module.exports = router;
