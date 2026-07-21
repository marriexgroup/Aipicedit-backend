const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../db'); // Adjusted to import User and Role from db.js
require('dotenv').config();

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';

/**
 * Registers a new user.
 * Hashes the password and stores the user in the database using Mongoose.
 * @param {string} username
 * @param {string} password
 * @param {string} roleName - Defaults to 'user'
 * @returns {Promise<Object>} The new user object (without password) and a token
 * @throws {Error} If username already exists or role not found or other DB error
 */
async function registerUser(username, password, roleName = 'user') {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(username)) {
    const error = new Error('Username must be a valid email address.');
    error.code = 'INVALID_EMAIL';
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Generate verification token
  const crypto = require('crypto');
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  try {
    // Create and save a new User document
    const newUser = new User({
      username,
      password: hashedPassword,
      role: roleName,
      accounttype: 'trial', // Default value
      accountbalance: 0, // Default value
      availableStorange: 0,
      usedStorange: 0,
      isVerified: false,
      verificationToken,
      verificationTokenExpires
    });
    await newUser.save();

    // Send verification email
    const mailService = require('./mail.service');
    await mailService.sendVerificationEmail(username, username, verificationToken);

    // Prepare user object for response (excluding password)
    const userToReturn = {
      id: newUser._id,
      username: newUser.username,
      role: roleName,
      accounttype: newUser.accounttype,
      regdate: newUser.regdate,
      accountbalance: newUser.accountbalance,
      usedStorange: newUser.usedStorange,
      availableStorange: newUser.availableStorange,
      isVerified: false
    };

    // Do NOT generate token here, user must verify email first
    return { user: userToReturn };

  } catch (dbError) {
    // Check for Mongoose duplicate key error (code 11000)
    if (dbError.code === 11000 && dbError.keyPattern && dbError.keyPattern.username) {
      const error = new Error('Username already exists.');
      error.code = 'USERNAME_EXISTS'; // Custom code for easier checking
      throw error;
    }
    // For other DB errors, re-throw them
    throw dbError;
  }
}

/**
 * Logs in an existing user.
 * Compares the provided password with the stored hash using Mongoose.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<Object|null>} User object (with populated role name) and JWT, or null if login fails
 */
async function loginUser(username, password) {
  // Find a User by username and populate the 'role' field to get role details
  const user = await User.findOne({ username });

  if (!user) {
    return null; // User not found
  }

  // Enforce email verification (if isVerified is explicitly false)
  if (user.isVerified === false) {
    const error = new Error('Email address is not verified. Please check your inbox or resend the verification link.');
    error.code = 'EMAIL_NOT_VERIFIED';
    throw error;
  }

  const isPasswordMatch = await bcrypt.compare(password, user.password);

  if (isPasswordMatch) {
    let roleName = 'user';
    if (user.role) {
      if (typeof user.role === 'string') {
        roleName = user.role;
      } else if (user.role.name) {
        roleName = user.role.name;
      }
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: roleName },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Prepare user object for response (excluding password)
    const userToReturn = {
      id: user._id,
      username: user.username,
      role: roleName,
      accounttype: user.accounttype,
      regdate: user.regdate,
      accountbalance: user.accountbalance,
      usedStorange: user.usedStorange,
      availableStorange: user.availableStorange
    };
    return { user: userToReturn, token };
  } else {
    return null; // Passwords don't match
  }
}

/**
 * Initiates the password reset flow.
 * Generates a reset token, saves it, and sends the reset email.
 * @param {string} username - The user's email/username
 */
async function forgotPassword(username) {
  const user = await User.findOne({ username });
  if (!user) {
    // For security, don't throw an error to prevent user enumeration
    return { message: 'If the email is registered, a password reset link has been sent.' };
  }

  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  await user.save();

  const mailService = require('./mail.service');
  await mailService.sendPasswordResetEmail(user.username, user.username, token);

  return { message: 'If the email is registered, a password reset link has been sent.' };
}

/**
 * Resets the user's password using the reset token.
 * @param {string} token - The password reset token
 * @param {string} newPassword - The new password
 */
async function resetPassword(token, newPassword) {
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    const error = new Error('Password reset token is invalid or has expired.');
    error.code = 'INVALID_RESET_TOKEN';
    throw error;
  }

  // Hash new password
  user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return { message: 'Password has been reset successfully.' };
}

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
};
