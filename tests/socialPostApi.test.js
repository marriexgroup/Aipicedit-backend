const express = require('express');
const supertest = require('supertest');
const fetch = require('node-fetch');
require('dotenv').config({ path: 'd:/aruna project/upstream project/Aipicedit-backend/.env' });

const apiV1Routes = require('../routes/apiV1.routes');

const app = express();
app.use(express.json());
app.use('/api/v1', apiV1Routes);

const validApiKey = process.env.N8N_API_KEY;

async function runTests() {
  console.log('==========================================');
  console.log('Starting Social Post API Integration Tests');
  console.log('==========================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Test 1: Missing API Key
  try {
    const res = await supertest(app)
      .post('/api/v1/generate-social-post')
      .send({ topic: 'Test Topic' });

    assert(res.status === 401, 'Rejects request without x-api-key header with 401');
    assert(res.body.success === false, 'Response has success: false');
    assert(res.body.error === 'UNAUTHORIZED', 'Response error code is UNAUTHORIZED');
    assert(typeof res.body.request_id === 'string' && res.body.request_id.length > 0, 'Includes unique request_id');
  } catch (err) {
    console.error('Test 1 error:', err);
    failed++;
  }

  // Test 2: Invalid API Key
  try {
    const res = await supertest(app)
      .post('/api/v1/generate-social-post')
      .set('x-api-key', 'invalid_random_key_12345')
      .send({ topic: 'Test Topic' });

    assert(res.status === 401, 'Rejects invalid x-api-key with 401');
    assert(res.body.error === 'UNAUTHORIZED', 'Response error code is UNAUTHORIZED');
  } catch (err) {
    console.error('Test 2 error:', err);
    failed++;
  }

  // Test 3: Validation Error - Missing topic
  try {
    const res = await supertest(app)
      .post('/api/v1/generate-social-post')
      .set('x-api-key', validApiKey)
      .send({});

    assert(res.status === 400, 'Rejects request with missing topic with 400');
    assert(res.body.error === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');
    assert(res.body.message.includes('topic'), 'Error message mentions topic');
  } catch (err) {
    console.error('Test 3 error:', err);
    failed++;
  }

  // Test 4: Validation Error - Topic too short
  try {
    const res = await supertest(app)
      .post('/api/v1/generate-social-post')
      .set('x-api-key', validApiKey)
      .send({ topic: 'ab' });

    assert(res.status === 400, 'Rejects topic under 3 characters with 400');
    assert(res.body.error === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');
  } catch (err) {
    console.error('Test 4 error:', err);
    failed++;
  }

  // Test 5: End-to-End Generation Test (Gemini + Runware + S3)
  console.log('\n--- Running End-to-End Live Generation Test (Gemini + Runware + S3) ---');
  try {
    const startTime = Date.now();
    const res = await supertest(app)
      .post('/api/v1/generate-social-post')
      .set('x-api-key', validApiKey)
      .send({
        topic: 'AI photo editing for small businesses',
        platform: 'facebook',
        language: 'english'
      });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`End-to-End request completed in ${duration}s with status: ${res.status}`);

    assert(res.status === 200, 'Returns 200 OK on successful generation');
    assert(res.body.success === true, 'Response body has success: true');
    assert(typeof res.body.request_id === 'string' && res.body.request_id.length > 0, `request_id is present (${res.body.request_id})`);
    assert(typeof res.body.title === 'string' && res.body.title.length > 0, `title is generated: "${res.body.title}"`);
    assert(typeof res.body.description === 'string' && res.body.description.length > 0, `description is generated (length: ${res.body.description?.length} chars)`);
    assert(Array.isArray(res.body.hashtags) && res.body.hashtags.length > 0, `hashtags is an array with ${res.body.hashtags?.length} tags: [${res.body.hashtags?.join(', ')}]`);
    assert(res.body.hashtags.every(h => h.startsWith('#')), 'All hashtags start with #');
    assert(typeof res.body.image_url === 'string' && res.body.image_url.startsWith('https://'), `image_url is valid HTTPS URL: ${res.body.image_url}`);

    // Verify public accessibility of image_url without credentials
    if (res.body.image_url) {
      console.log('\n--- Verifying Public Image Accessibility ---');
      const imgRes = await fetch(res.body.image_url);
      assert(imgRes.status === 200, `Public GET on image_url returns 200 OK (Status: ${imgRes.status})`);
      const contentType = imgRes.headers.get('content-type');
      assert(contentType && contentType.includes('image'), `Content-Type is image format (${contentType})`);
    }
  } catch (err) {
    console.error('Test 5 error:', err);
    failed++;
  }

  console.log('\n==========================================');
  console.log(`Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('==========================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
