require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { User, VoiceVideo, connectDB } = require('../db');

const mockUserPayload = { id: new mongoose.Types.ObjectId().toString(), role: 'user' };

// Mock auth.middleware to automatically authenticate our mock user payload
jest.mock('../auth.middleware', () => ({
  authenticateToken: (req, res, next) => {
    req.user = mockUserPayload;
    next();
  }
}));

// Mock dependencies of voiceVideo.controller.js to prevent external API calls
jest.mock('../services/geminiClient', () => ({
  getGeminiClient: jest.fn(),
  getGeminiApiKey: jest.fn().mockResolvedValue('fake-api-key')
}));
jest.mock('../services/s3.service', () => ({
  uploadBuffer: jest.fn().mockResolvedValue('https://s3.amazonaws.com/fake-bucket/video.mp4')
}));
jest.mock('@runware/sdk-js', () => {
  return {
    Runware: jest.fn().mockImplementation(() => {
      return {
        requestImages: jest.fn().mockResolvedValue([{ imageBase64Data: 'fakebase64' }])
      };
    })
  };
});

const voiceVideoGenRoutes = require('../routes/voiceVideoGen.routes');

const app = express();
app.use(express.json());
app.use('/api/voice-video', voiceVideoGenRoutes);

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  process.env.MONGODB_URI = mongoUri;
  await connectDB();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await VoiceVideo.deleteMany({});
});

describe('Voice Video Retry API Tests', () => {
  test('should successfully retry a failed job if user has sufficient balance', async () => {
    // 1. Create a user with positive balance
    const user = new User({
      _id: mockUserPayload.id,
      username: 'test@example.com',
      password: 'password123',
      role: 'user',
      accountbalance: 10.00,
      isVerified: true
    });
    await user.save();

    // 2. Create a failed voice video job for this user
    const failedJob = new VoiceVideo({
      userId: user._id,
      prompt: 'This is a test prompt',
      status: 'failed',
      errorMessage: 'Something went wrong',
      scenes: [
        {
          sceneIndex: 1,
          imagePrompt: 'Test scene',
          voiceoverText: 'Test text',
          duration: 5,
          imageUrl: 'https://s3.amazonaws.com/fake-bucket/scene1.png'
        }
      ]
    });
    await failedJob.save();

    // 3. Request retry
    const response = await request(app)
      .post(`/api/voice-video/retry/${failedJob._id}`)
      .send();

    expect(response.statusCode).toBe(202);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('pending');

    // 4. Verify DB was updated
    const updatedJob = await VoiceVideo.findById(failedJob._id);
    expect(updatedJob.status).toBe('pending');
    expect(updatedJob.errorMessage).toBeUndefined();
  });

  test('should fail if user has insufficient balance (< $0.50)', async () => {
    const user = new User({
      _id: mockUserPayload.id,
      username: 'test@example.com',
      password: 'password123',
      role: 'user',
      accountbalance: 0.10,
      isVerified: true
    });
    await user.save();

    const failedJob = new VoiceVideo({
      userId: user._id,
      prompt: 'This is a test prompt',
      status: 'failed',
      errorMessage: 'Something went wrong'
    });
    await failedJob.save();

    const response = await request(app)
      .post(`/api/voice-video/retry/${failedJob._id}`)
      .send();

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toContain('Insufficient account balance');
  });

  test('should fail if job status is not failed', async () => {
    const user = new User({
      _id: mockUserPayload.id,
      username: 'test@example.com',
      password: 'password123',
      role: 'user',
      accountbalance: 5.00,
      isVerified: true
    });
    await user.save();

    const completedJob = new VoiceVideo({
      userId: user._id,
      prompt: 'This is a test prompt',
      status: 'completed'
    });
    await completedJob.save();

    const response = await request(app)
      .post(`/api/voice-video/retry/${completedJob._id}`)
      .send();

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toContain('Only failed video jobs can be retried');
  });

  test('should fail if job belongs to another user', async () => {
    const user = new User({
      _id: mockUserPayload.id,
      username: 'test@example.com',
      password: 'password123',
      role: 'user',
      accountbalance: 5.00,
      isVerified: true
    });
    await user.save();

    const anotherUserId = new mongoose.Types.ObjectId();
    const failedJob = new VoiceVideo({
      userId: anotherUserId,
      prompt: 'This is a test prompt',
      status: 'failed',
      errorMessage: 'Another error'
    });
    await failedJob.save();

    const response = await request(app)
      .post(`/api/voice-video/retry/${failedJob._id}`)
      .send();

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toContain('You are not authorized');
  });
});
