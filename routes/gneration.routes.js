const express = require('express');
const router = express.Router();
const { getGenerations, removeAllGenerationsByUser } = require('../controllers/generaion.controller');

// Route for user registration
router.get('/getbyuser/:userId', getGenerations);
router.delete('/generate-removeall/:userId', removeAllGenerationsByUser);
module.exports = router;