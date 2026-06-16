
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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



async function updateProfile(req, res) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }
  const userId = req.user.id;
  const { username, password, timezone } = req.body;

  if (!username) {
    return res.status(400).json({ message: "Username is required." });
  }

  const SALT_ROUNDS = 10;
  const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';

  try {
    const existingUser = await User.findOne({ username, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(409).json({ message: "Username already exists." });
    }

    const updateData = { username };
    if (timezone) {
      updateData.timezone = timezone;
    }
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const token = jwt.sign(
      { userId: updatedUser._id, username: updatedUser.username, role: updatedUser.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const userToReturn = {
      id: updatedUser._id,
      username: updatedUser.username,
      role: updatedUser.role,
      accounttype: updatedUser.accounttype,
      regdate: updatedUser.regdate,
      accountbalance: updatedUser.accountbalance,
      usedStorange: updatedUser.usedStorange,
      availableStorange: updatedUser.availableStorange,
      timezone: updatedUser.timezone
    };

    res.status(200).json({
      message: "Profile updated successfully.",
      user: userToReturn,
      token: token
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Error updating profile: " + error.message });
  }
}

module.exports = {
  getProfile,
  getSettings,
  updateUserStorage,
  updateProfile
};
