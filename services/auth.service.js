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
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    // Create and save a new User document
    const newUser = new User({
      username,
      password: hashedPassword,
      role: roleName, // Assign ObjectId of the role
      accounttype: 'trial', // Default value
      accountbalance: 2.00, // Default value
      availableStorange:2000,
      usedStorange:0
      // regdate is defaulted by schema
    });
    await newUser.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser._id, username: newUser.username, role: roleName }, // Use roleName directly
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Prepare user object for response (excluding password)
    const userToReturn = {
      id: newUser._id,
      username: newUser.username,
      role: roleName,
      accounttype: newUser.accounttype,
      regdate: newUser.regdate,
      accountbalance: newUser.accountbalance,
      usedStorange:newUser.usedStorange,
      availableStorange:newUser.availableStorange
    };

    return { user: userToReturn, token };

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
      { expiresIn: '1h' }
    );

    // Prepare user object for response (excluding password)
    const userToReturn = {
      id: user._id,
      username: user.username,
      role: roleName,
      accounttype: user.accounttype,
      regdate: user.regdate,
      accountbalance: user.accountbalance,
      usedStorange:user.usedStorange,
      availableStorange:user.availableStorange
    };
    return { user: userToReturn, token };
  } else {
    return null; // Passwords don't match
  }
}

module.exports = {
  registerUser,
  loginUser,
};
