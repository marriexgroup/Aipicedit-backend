const { User } = require('../db');
const authService = require('../services/auth.service'); // We'll create this service soon

// Controller function for user registration
async function register(req, res, next) {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const { user } = await authService.registerUser(username, password, role);
    // Send back the registration success message (without login token).
    res.status(201).json({
      message: 'Registration successful! A verification email has been sent to your email address. Please verify your email before logging in.',
      user: user
    });
  } catch (error) {
    if (error.code === 'INVALID_EMAIL') {
      return res.status(400).json({ message: error.message });
    }
    if (error.message.toLowerCase().includes('username already exists') || (error.code === 'USERNAME_EXISTS')) {
      return res.status(409).json({ message: error.message || 'Username already exists.' });
    }
    console.error('Registration controller error:', error);
    next(error); // Pass to global error handler
  }
}

// Controller function for user login
async function login(req, res, next) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const result = await authService.loginUser(username, password);
    if (result) {
      res.json({ message: 'Login successful', user: result.user, token: result.token });
    } else {
      res.status(401).json({ message: 'Invalid credentials.' });
    }
  } catch (error) {
    if (error.code === 'EMAIL_NOT_VERIFIED') {
      return res.status(403).json({ message: error.message, isVerified: false });
    }
    console.error('Login controller error:', error);
    next(error); // Pass to global error handler
  }
}

// Controller function to verify email token
async function verifyEmail(req, res, next) {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Verification token is required.' });
  }

  try {
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token.' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Verify email controller error:', error);
    next(error);
  }
}

// Controller function to resend verification email
async function resendVerification(req, res, next) {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Email address is required.' });
  }

  try {
    const user = await User.findOne({ username });

    if (!user) {
      // For security, don't reveal if the user exists
      return res.status(200).json({ message: 'If the email is registered, a new verification link has been sent.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'This email is already verified.' });
    }

    // Generate new token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    user.verificationToken = token;
    user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    const mailService = require('../services/mail.service');
    await mailService.sendVerificationEmail(user.username, user.username, token);

    res.status(200).json({ message: 'If the email is registered, a new verification link has been sent.' });
  } catch (error) {
    console.error('Resend verification controller error:', error);
    next(error);
  }
}

const getAuthUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required in parameters." });
    }
    const user = await User.find({ _id: userId });
    const userToReturn = {
      id: user[0]._id,
      username: user[0].username,
      role: user[0].roleName,
      accounttype: user[0].accounttype,
      regdate: user[0].regdate,
      accountbalance: user[0].accountbalance,
      usedStorange:user[0].usedStorange,
      availableStorange:user[0].availableStorange,
      timezone: user[0].timezone || 'UTC'
    };
    res.status(200).json({ data: userToReturn });
  } catch (error) {
    res.status(500).json({ message: "Error fetching pages: " + error.message });
  }
};

async function forgotPassword(req, res, next) {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Email address is required.' });
  }

  try {
    const result = await authService.forgotPassword(username);
    res.status(200).json(result);
  } catch (error) {
    console.error('Forgot password controller error:', error);
    next(error);
  }
}

async function resetPassword(req, res, next) {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ message: 'Token and new password are required.' });
  }

  try {
    const result = await authService.resetPassword(token, password);
    res.status(200).json(result);
  } catch (error) {
    if (error.code === 'INVALID_RESET_TOKEN') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Reset password controller error:', error);
    next(error);
  }
}

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  getAuthUser
};
