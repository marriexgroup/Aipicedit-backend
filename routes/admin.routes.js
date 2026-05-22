const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../auth.middleware'); // For authenticateToken and authorizeRoles

// Public route to get all users with related generations and pages
router.get(
  '/public/users-details',
  adminController.getAllUsersDetailsPublic
);

// Admin dashboard route - requires admin authentication
router.get(
  '/dashboard',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles(['admin']),
  adminController.getDashboard
);

// Admin users route - requires admin authentication
router.get(
  '/users',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles(['admin']),
  adminController.getUsers
);

// Admin pages route - requires admin authentication
router.get(
  '/pages',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles(['admin']),
  adminController.getAllPages
);

// Admin assign page route - requires admin authentication
router.put(
  '/pages/assign/:pageId',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles(['admin']),
  adminController.assignPage
);

// Admin assigned posts route - requires admin authentication
router.get(
  '/assigned-posts',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles(['admin']),
  adminController.getAssignedPosts
);

module.exports = router;
