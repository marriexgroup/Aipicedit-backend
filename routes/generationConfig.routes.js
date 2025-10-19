const express = require('express');
const router = express.Router();
const {
    saveGenerationConfig,
    getUserConfigurations,
    getConfigurationById,
    updateConfiguration,
    deleteConfiguration
} = require('../controllers/generationConfig.controller');

// Save a new generation configuration
// POST /api/generation-config/save
router.post('/save', saveGenerationConfig);

// Get all configurations for a user
// GET /api/generation-config/user/:userId
router.get('/user/:userId', getUserConfigurations);

// Get a specific configuration by ID
// GET /api/generation-config/:configId?userId=:userId
router.get('/:configId', getConfigurationById);

// Update a configuration
// PUT /api/generation-config/:configId
router.put('/:configId', updateConfiguration);

// Delete a configuration (soft delete)
// DELETE /api/generation-config/:configId?userId=:userId
router.delete('/:configId', deleteConfiguration);

module.exports = router;
