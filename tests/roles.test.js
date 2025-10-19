const request = require('supertest');
const express = require('express');
const authService = require('../services/auth.service');
const authMiddleware = require('../auth.middleware');
const publicController = require('../controllers/public.controller');
const userController = require('../controllers/user.controller');
const adminController = require('../controllers/admin.controller');
const db = require('../db');
require('dotenv').config({ path: '.env.test' });

jest.mock('../db');

const app = express();
app.use(express.json());

let mockUsers = {};
let mockRoles = { 'user': 1, 'admin': 2 };
let nextUserId = 1;

// Define routes for testing
app.get('/', publicController.getHome);
app.get('/about', publicController.getAbout);
app.get('/api/user/profile', authMiddleware.authenticateToken, userController.getProfile);
app.get('/api/user/settings', authMiddleware.authenticateToken, userController.getSettings);
app.get('/api/admin/dashboard', authMiddleware.authenticateToken, authMiddleware.authorizeRoles(['admin']), adminController.getDashboard);
app.get('/api/admin/users', authMiddleware.authenticateToken, authMiddleware.authorizeRoles(['admin']), adminController.getUsers);

// Global error handler for the test app
app.use((err, req, res, next) => {
  console.error("Test app error handler (roles):", err.message);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

describe('Role-Based Access Control Tests', () => {
  let userToken, adminToken;
  const testUser = { username: 'testroleuser', password: 'password', role: 'user' };
  const testAdmin = { username: 'testroleadmin', password: 'password', role: 'admin' };

  // Define the mock implementation at a scope accessible by beforeAll
  db.query.mockImplementation(async (text, params) => {
    if (text.startsWith('SELECT id FROM roles WHERE name = ?')) { // MySQL placeholder
      const roleName = params[0];
      const role = mockRoles[roleName];
      return { rows: role ? [{ id: role }] : [] };
    }
    if (text.startsWith('INSERT INTO users')) { // MySQL placeholder in service
      const username = params[0];
      if (mockUsers[username]) {
        const error = new Error(`Duplicate entry '${username}' for key 'users.username'`);
        error.code = 'ER_DUP_ENTRY';
        error.errno = 1062;
        throw error;
      }
      const currentUserId = nextUserId;
      mockUsers[username] = { id: currentUserId, username, password: params[1], role_id: params[2] };
      nextUserId++;
      return { insertId: currentUserId, affectedRows: 1, rows: [] }; // MySQL OkPacket sim by db.js
    }
    if (text.startsWith('SELECT users.*, roles.name as role_name FROM users JOIN roles ON users.role_id = roles.id WHERE username = ?')) { // MySQL placeholder
      const username = params[0];
      const user = mockUsers[username];
      if (user) {
        const roleName = Object.keys(mockRoles).find(key => mockRoles[key] === user.role_id);
        return { rows: [{ ...user, role_name: roleName }] };
      }
      return { rows: [] };
    }
    console.warn(`Mock DB (roles.test.js): Unhandled query: ${text}`);
    return { rows: [] };
  });

  beforeAll(async () => {
    // Reset state here for beforeAll, as beforeEach won't have run yet for its context
    mockUsers = {};
    nextUserId = 1;
    db.query.mockClear(); // Clear any calls from previous test files if Jest runs them in same context (unlikely for separate files)

    await authService.registerUser(testUser.username, testUser.password, testUser.role);
    const userLogin = await authService.loginUser(testUser.username, testUser.password);
    userToken = userLogin.token;

    await authService.registerUser(testAdmin.username, testAdmin.password, testAdmin.role);
    const adminLogin = await authService.loginUser(testAdmin.username, testAdmin.password);
    adminToken = adminLogin.token;
  });

  test('Public route / should be accessible without token', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.text).toBe('Hello World from Express! This is a public route.');
  });

  test('Public route /about should be accessible without token', async () => {
    const response = await request(app).get('/about');
    expect(response.statusCode).toBe(200);
    expect(response.text).toBe('This is the public About page.');
  });

  test('User route /api/user/profile should be accessible with user token', async () => {
    const response = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${userToken}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.user.username).toBe(testUser.username);
  });

  test('User route /api/user/settings should be accessible with user token', async () => {
    const response = await request(app)
      .get('/api/user/settings')
      .set('Authorization', `Bearer ${userToken}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.user.username).toBe(testUser.username);
  });

  test('User route /api/user/profile should NOT be accessible without token', async () => {
    const response = await request(app).get('/api/user/profile');
    expect(response.statusCode).toBe(401);
  });

  test('Admin route /api/admin/dashboard should be accessible with admin token', async () => {
    const response = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.user.username).toBe(testAdmin.username);
  });

  test('Admin route /api/admin/users should be accessible with admin token', async () => {
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.user.username).toBe(testAdmin.username);
  });

  test('Admin route /api/admin/dashboard should NOT be accessible with user token', async () => {
    const response = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${userToken}`);
    expect(response.statusCode).toBe(403);
  });

  test('Admin route /api/admin/dashboard should NOT be accessible without token', async () => {
    const response = await request(app).get('/api/admin/dashboard');
    expect(response.statusCode).toBe(401);
  });
});

afterAll(async () => {
  // any cleanup
});
