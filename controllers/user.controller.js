
const { User } = require('../db');

// Controller function to get user profile
async function getProfile(req, res) {
  // req.user is populated by the authenticateToken middleware
  if (!req.user) {
    // This should ideally not happen if authenticateToken is working correctly
    return res.status(401).json({ message: "Not authorized" });
  }
  // Send back relevant user information. Avoid sending sensitive data.
  res.json({
    message: `Welcome to your profile, ${req.user.username}!`,
    user: {
      id: req.user.userId,
      username: req.user.username,
      role: req.user.role
    }
  });
}

// Controller function to get user settings (placeholder)
async function getSettings(req, res) {
  // req.user is populated by the authenticateToken middleware
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }
  res.json({
    message: 'User settings page.',
    user: {
      id: req.user.userId,
      username: req.user.username,
      role: req.user.role
    }
  });
}

async function updateUserStorage(req, res) {
  const { packageValue, userId } = req.body;
  if (!packageValue || !userId) {
    return res.status(401).json({ message: "Package value and user ID are required." });
  }

  try {

    const user = await await User.findByIdAndUpdate(userId, {
      $inc: {
        availableStorange: +(packageValue * 960)
      }
    }, { new: true });

    if (user) {
      res.status(200).json({
        message: 'User storage settings updated successfully.',
      });
    }
  } catch (error) {
    return res.status(500).json({ message: "Error updating user storage settings.", error: error.message });
  }
}

module.exports = {
  getProfile,
  getSettings,
  updateUserStorage
};
