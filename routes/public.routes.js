const express = require('express');
const router = express.Router();
const publicController = require('../controllers/public.controller');

// Home route
router.get('/', publicController.getHome);

// About route
router.get('/about', publicController.getAbout);

module.exports = router;
