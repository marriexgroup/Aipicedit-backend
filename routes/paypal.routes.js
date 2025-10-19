const express = require('express');
const router = express.Router();
const paypalController = require('../controllers/paypal.controller');
const { authenticateToken } = require('../auth.middleware');

// PayPal configuration endpoint (public)
router.get('/config', paypalController.getConfig);

// PayPal order endpoints (authenticated)
router.post('/orders', authenticateToken, paypalController.createOrder);
router.post('/orders/:orderID/capture', paypalController.captureOrder); // Public for PayPal redirects
router.get('/orders/:orderID', paypalController.getOrder); // Public for order verification

// PayPal webhook endpoint (public)
router.post('/webhook', paypalController.handleWebhook);

// User payment endpoints (authenticated)
router.get('/payments', authenticateToken, paypalController.getUserPayments);
router.get('/payments/:paymentId', authenticateToken, paypalController.getPaymentDetails);

module.exports = router;
