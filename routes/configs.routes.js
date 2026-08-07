const express = require('express');
const router = express.Router();
const { getConfigs, addConfigs, updateConfigs } = require('../controllers/configs.controller');
const authMiddleware = require('../auth.middleware');

// Get current configs (using optional token authentication to check if it's admin)
router.get('/', (req, res, next) => {
  if (req.headers['authorization']) {
    return authMiddleware.authenticateToken(req, res, next);
  }
  next();
}, getConfigs);

// Create or replace configs (requires admin)
router.post('/', authMiddleware.authenticateToken, authMiddleware.authorizeRoles(['admin']), addConfigs);

// Update configs (requires admin)
router.put('/', authMiddleware.authenticateToken, authMiddleware.authorizeRoles(['admin']), updateConfigs);

module.exports = router;


