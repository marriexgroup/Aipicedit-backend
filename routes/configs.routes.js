const express = require('express');
const router = express.Router();
const { getConfigs, addConfigs, updateConfigs } = require('../controllers/configs.controller');

// Get current configs
router.get('/', getConfigs);

// Create or replace configs
router.post('/', addConfigs);

// Update configs
router.put('/', updateConfigs);

module.exports = router;


