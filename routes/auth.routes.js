const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Route for user registration
router.post('/register', authController.register);

// Route for user login
router.post('/login', authController.login);
router.get('/user/:userId', authController.getAuthUser);

// Route for email verification
router.post('/verify', authController.verifyEmail);

// Route to resend email verification link
router.post('/resend-verification', authController.resendVerification);

// Route to request password reset
router.post('/forgot-password', authController.forgotPassword);

// Route to reset password
router.post('/reset-password', authController.resetPassword);

module.exports = router;
