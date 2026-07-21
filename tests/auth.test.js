require('dotenv').config({ path: '.env.test' }); // Ensure JWT_SECRET is loaded AT THE VERY TOP

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const authController = require('../controllers/auth.controller');
const { User, Role, connectDB } = require('../db');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Apply routes using the actual controllers
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.post('/api/auth/verify', authController.verifyEmail);
app.post('/api/auth/resend-verification', authController.resendVerification);
app.post('/api/auth/forgot-password', authController.forgotPassword);
app.post('/api/auth/reset-password', authController.resetPassword);

// Global error handler for the test app
app.use((err, req, res, next) => {
  console.error("Test app error handler:", err.message, err.code);
  if (err.code === 'USERNAME_EXISTS' || (err.code === 11000 && err.message.includes('username'))) {
    return res.status(409).json({ message: 'Username already exists.' });
  }
  if (err.message && err.message.toLowerCase().includes('role') && err.message.toLowerCase().includes('not found')) {
    return res.status(400).json({ message: err.message });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  process.env.MONGODB_URI = mongoUri; // Set URI for db.js to use
  await connectDB(); // Connect Mongoose using the function from db.js

  // Seed roles
  await Role.create({ name: 'user' });
  await Role.create({ name: 'admin' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear user collection before each test
  await User.deleteMany({});
});

const testUser = {
  username: 'testuser@example.com',
  password: 'testpassword',
  role: 'user',
};

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';

describe('Authentication Tests (/api/auth) with Mongoose', () => {
  test('should register a new user successfully and send verification email', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ username: testUser.username, password: testUser.password, role: testUser.role });

    expect(response.statusCode).toBe(201);
    expect(response.body.message).toContain('Registration successful');
    expect(response.body.token).toBeUndefined(); // Should not return JWT on register

    const responseUser = response.body.user;
    expect(responseUser.username).toBe(testUser.username);
    expect(responseUser.role).toBe(testUser.role);
    expect(responseUser.accounttype).toBe('trial');
    expect(responseUser.regdate).toBeDefined();

    // Verify user is in DB and is unverified
    const dbUser = await User.findById(responseUser.id);
    expect(dbUser).toBeDefined();
    expect(dbUser.username).toBe(testUser.username);
    expect(dbUser.isVerified).toBe(false);
    expect(dbUser.verificationToken).toBeDefined();
    expect(dbUser.verificationTokenExpires).toBeDefined();
  });

  test('should fail registration if username is not a valid email', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ username: 'invalidusername', password: testUser.password, role: testUser.role });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toContain('Username must be a valid email address');
  });

  test('should not register a user with an existing username', async () => {
    // First, register the user
    await request(app)
      .post('/api/auth/register')
      .send({ username: testUser.username, password: testUser.password, role: testUser.role });

    // Then, attempt to register the same user again
    const response = await request(app)
      .post('/api/auth/register')
      .send({ username: testUser.username, password: 'anotherpassword', role: testUser.role });

    expect(response.statusCode).toBe(409);
    expect(response.body.message).toBe('Username already exists.');
  });

  test('should not login an unverified user', async () => {
    // Register user first (isVerified will be false)
    await request(app)
      .post('/api/auth/register')
      .send({ username: testUser.username, password: testUser.password, role: testUser.role });

    // Attempt login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: testUser.username, password: testUser.password });

    expect(loginResponse.statusCode).toBe(403);
    expect(loginResponse.body.isVerified).toBe(false);
    expect(loginResponse.body.message).toContain('not verified');
  });

  test('should verify an email token successfully and allow login', async () => {
    // Register user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: testUser.username, password: testUser.password, role: testUser.role });
    
    // Retrieve user token from DB
    const user = await User.findById(regRes.body.user.id);
    const token = user.verificationToken;

    // Verify token
    const verifyRes = await request(app)
      .post('/api/auth/verify')
      .send({ token });

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body.message).toContain('verified successfully');

    // Confirm DB is updated
    const updatedUser = await User.findById(user._id);
    expect(updatedUser.isVerified).toBe(true);
    expect(updatedUser.verificationToken).toBeUndefined();

    // Login should now succeed
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: testUser.username, password: testUser.password });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.body.token).toBeDefined();

    const decodedToken = jwt.verify(loginResponse.body.token, JWT_SECRET);
    expect(decodedToken.username).toBe(testUser.username);
  });

  test('should resend a verification email link successfully', async () => {
    // Register user
    await request(app)
      .post('/api/auth/register')
      .send({ username: testUser.username, password: testUser.password, role: testUser.role });

    const userBefore = await User.findOne({ username: testUser.username });
    const originalToken = userBefore.verificationToken;

    // Resend link
    const resendRes = await request(app)
      .post('/api/auth/resend-verification')
      .send({ username: testUser.username });

    expect(resendRes.statusCode).toBe(200);

    const userAfter = await User.findOne({ username: testUser.username });
    expect(userAfter.verificationToken).not.toBe(originalToken); // Token should be regenerated
  });

  test('should login legacy users (whose isVerified field is undefined)', async () => {
    // Manually insert a legacy user without isVerified property
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    
    const legacyUser = new User({
      username: 'legacyuser@example.com',
      password: hashedPassword,
      role: 'user',
      accounttype: 'trial',
      accountbalance: 0,
      availableStorange: 0,
      usedStorange: 0
    });
    // Remove the default value of isVerified to simulate legacy state
    legacyUser.isVerified = undefined; 
    await legacyUser.save();

    // Attempt login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'legacyuser@example.com', password: testUser.password });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.body.token).toBeDefined();
  });

  test('should not login with incorrect password', async () => {
    // Register and verify user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: testUser.username, password: testUser.password, role: testUser.role });
    await User.findByIdAndUpdate(regRes.body.user.id, { isVerified: true });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: testUser.username, password: 'wrongpassword' });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Invalid credentials.');
  });

  describe('Password Reset Tests', () => {
    test('should initiate forgot password and generate reset token', async () => {
      // Register user
      await request(app)
        .post('/api/auth/register')
        .send({ username: testUser.username, password: testUser.password, role: testUser.role });

      // Request reset link
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ username: testUser.username });

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toContain('password reset link has been sent');

      // Check DB
      const user = await User.findOne({ username: testUser.username });
      expect(user.resetPasswordToken).toBeDefined();
      expect(user.resetPasswordExpires).toBeDefined();
    });

    test('should return 200 with generic message for non-existent email (security)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ username: 'nobody@example.com' });

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toContain('password reset link has been sent');
    });

    test('should reset password successfully with valid token', async () => {
      // Register user
      await request(app)
        .post('/api/auth/register')
        .send({ username: testUser.username, password: testUser.password, role: testUser.role });

      // Request reset
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ username: testUser.username });

      const user = await User.findOne({ username: testUser.username });
      const token = user.resetPasswordToken;

      // Perform reset
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, password: 'newsecretpassword' });

      expect(resetRes.statusCode).toBe(200);
      expect(resetRes.body.message).toContain('reset successfully');

      // Check DB values are cleared and password is changed
      const updatedUser = await User.findOne({ username: testUser.username });
      expect(updatedUser.resetPasswordToken).toBeUndefined();
      expect(updatedUser.resetPasswordExpires).toBeUndefined();

      // Verify login with new password succeeds (after marking as verified first, since register created it unverified)
      await User.findByIdAndUpdate(updatedUser._id, { isVerified: true });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: testUser.username, password: 'newsecretpassword' });

      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.body.token).toBeDefined();
    });

    test('should fail password reset if token is invalid or expired', async () => {
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'invalidtoken', password: 'newsecretpassword' });

      expect(resetRes.statusCode).toBe(400);
      expect(resetRes.body.message).toContain('invalid or has expired');
    });
  });
});
