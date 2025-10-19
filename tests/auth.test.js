require('dotenv').config({ path: '.env.test' }); // Ensure JWT_SECRET is loaded AT THE VERY TOP

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const authController = require('../controllers/auth.controller');
// Ensure db.js now exports the Mongoose connection and models
// We will use the actual models for testing against the in-memory DB
const { User, Role, connectDB } = require('../db');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Apply routes using the actual controllers
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);

// Global error handler for the test app
app.use((err, req, res, next) => {
  console.error("Test app error handler:", err.message, err.code);
  if (err.code === 'USERNAME_EXISTS' || (err.code === 11000 && err.message.includes('username'))) {
    return res.status(409).json({ message: 'Username already exists.' });
  }
  if (err.message && err.message.toLowerCase().includes('role') && err.message.toLowerCase().includes('not found')) {
    return res.status(400).json({ message: err.message });
  }
  // Handle validation errors from Mongoose (e.g., missing fields)
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
  username: 'testuser',
  password: 'testpassword',
  role: 'user', // This should match a seeded role name
};

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';

describe('Authentication Tests (/api/auth) with Mongoose', () => {
  test('should register a new user successfully', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ username: testUser.username, password: testUser.password, role: testUser.role });

    expect(response.statusCode).toBe(201);
    expect(response.body.message).toBe('User registered successfully');
    expect(response.body.token).toBeDefined();

    const decodedToken = jwt.verify(response.body.token, JWT_SECRET);
    expect(decodedToken.username).toBe(testUser.username);
    expect(decodedToken.role).toBe(testUser.role);
    expect(decodedToken.userId).toBeDefined();

    const responseUser = response.body.user;
    expect(responseUser.id).toBe(decodedToken.userId);
    expect(responseUser.username).toBe(testUser.username);
    expect(responseUser.role).toBe(testUser.role);
    expect(responseUser.accounttype).toBe('trial'); // Default from service
    expect(responseUser.regdate).toBeDefined();
    expect(responseUser.accountbalance).toBe(2.00); // Default from service

    const dbUser = await User.findById(responseUser.id).populate('role');
    expect(dbUser).toBeDefined();
    expect(dbUser.username).toBe(testUser.username);
    expect(dbUser.role.name).toBe(testUser.role);
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

  test('should login an existing user successfully and return a token', async () => {
    // Register user first
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({ username: testUser.username, password: testUser.password, role: testUser.role });
    expect(registerResponse.statusCode).toBe(201); // Ensure registration was successful

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: testUser.username, password: testUser.password });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.body.token).toBeDefined();

    const decodedToken = jwt.verify(loginResponse.body.token, JWT_SECRET);
    expect(decodedToken.username).toBe(testUser.username);
    expect(decodedToken.role).toBe(testUser.role);
    expect(decodedToken.userId).toBe(registerResponse.body.user.id);

    const responseUser = loginResponse.body.user;
    expect(responseUser.username).toBe(testUser.username);
    expect(responseUser.role).toBe(testUser.role);
    expect(responseUser.id).toBe(registerResponse.body.user.id);
  });

  test('should not login with incorrect password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: testUser.username, password: testUser.password, role: testUser.role });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: testUser.username, password: 'wrongpassword' });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Invalid credentials.');
  });

  test('should not login a non-existent user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nouser', password: 'somepassword' });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Invalid credentials.');
  });

  test('should require username and password for registration (controller validation)', async () => {
    // This test now relies on controller validation which should still be in place
    // The service level error might be different (e.g. Mongoose validation)
    // but controller should catch it first if it's basic missing fields.
    const response = await request(app)
      .post('/api/auth/register')
      .send({ username: testUser.username /* password missing */ });
    expect(response.statusCode).toBe(400);
    // The exact message depends on controller's specific validation logic
    // For this example, we assume auth.controller.js has a check like:
    // if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });
    // If not, Mongoose validation error will be caught by the error handler.
    expect(response.body.message).toMatch(/username and password are required|validation failed/i);
  });

  test('should require username and password for login (controller validation)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: testUser.username /* password missing */ });
    expect(response.statusCode).toBe(400);
    expect(response.body.message).toMatch(/username and password are required|validation failed/i);
  });

  test('should not register with a non-existent role', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ username: "newroleuser", password: "password", role: "nonexistentrole" });
    expect(response.statusCode).toBe(400); // Service throws error if role not found
    expect(response.body.message).toContain("Role 'nonexistentrole' not found.");
  });
});
