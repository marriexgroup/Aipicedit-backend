const jwt = require('jsonwebtoken');
require('dotenv').config();
// Note: We are removing direct dependency on bcrypt and db from here,
// as that logic is now in services/auth.service.js

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  console.log('🔑 Authenticating user...', token ? token.substring(0, 20) + '...' : 'No token');
  if (token == null) return res.sendStatus(401); // if there isn't any token

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('JWT verification error:', err.message);
      return res.sendStatus(403); // if token is no longer valid or tampered
    }
    
    // Map userId to id for consistency
    req.user = {
      ...user,
      id: user.userId // Map userId to id
    };
    
    console.log('✅ User authenticated:', { id: req.user.id, username: req.user.username, role: req.user.role });
    next(); // move on to the next middleware or request handler
  });
}

// Middleware to authorize based on user roles
function authorizeRoles(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      // This case should ideally be caught by authenticateToken first
      return res.sendStatus(401);
    }

    const userRole = req.user.role;
    if (allowedRoles.includes(userRole)) {
      next(); // User has one of the allowed roles
    } else {
      res.sendStatus(403); // User does not have the required role
    }
  };
}

// The core logic for registration (hashing, db interaction) and login (db interaction, password compare)
// has been moved to 'services/auth.service.js'.
// The controller 'controllers/auth.controller.js' now uses this service.

module.exports = {
  authenticateToken,
  authorizeRoles,
  // We are no longer exporting registerUser and loginUser from here.
  // They are now part of auth.service.js and used by auth.controller.js
};
