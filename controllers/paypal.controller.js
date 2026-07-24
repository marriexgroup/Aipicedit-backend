const paypalService = require('../services/paypal.service');
const Payment = require('../models/payment.model');
const User = require('../models/user.model');

/**
 * Create a PayPal order
 * @route POST /api/paypal/orders
 * @access Private
 */
const createOrder = async (req, res) => {
  try {
    const { cart } = req.body;
    const userId = req.user?.id; // Get user ID from authenticated request
    console.log('>>>>>>>>>>>>FE BODY: ',  req.body);
    console.log('🔍 PayPal createOrder - User ID:', userId);
    console.log('🔍 PayPal createOrder - Request user:', req.user);
    
    if (!userId) {
      console.error('❌ No user ID found in request. User object:', req.user);
      return res.status(401).json({ 
        success: false, 
        message: 'User authentication required. Please log in again.' 
      });
    }
    
    if (!cart) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cart information is required' 
      });
    }

    const { jsonResponse, httpStatusCode } = await paypalService.createOrder(cart, userId);
    
    res.status(httpStatusCode).json({
      success: true,
      data: jsonResponse
    });
  } catch (error) {
    console.error('Failed to create PayPal order:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create order' 
    });
  }
};

/**
 * Capture a PayPal order payment
 * @route POST /api/paypal/orders/:orderID/capture
 * @access Public
 */
const captureOrder = async (req, res) => {
  try {
    const { orderID } = req.params;
    
    if (!orderID) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order ID is required' 
      });
    }

    const { jsonResponse, httpStatusCode } = await paypalService.captureOrder(orderID);
    
    res.status(httpStatusCode).json({
      success: true,
      data: jsonResponse
    });
  } catch (error) {
    console.error('Failed to capture PayPal order:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to capture order' 
    });
  }
};

/**
 * Get PayPal order details
 * @route GET /api/paypal/orders/:orderID
 * @access Public
 */
const getOrder = async (req, res) => {
  try {
    const { orderID } = req.params;
    
    if (!orderID) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order ID is required' 
      });
    }

    const { jsonResponse, httpStatusCode } = await paypalService.getOrder(orderID);
    
    res.status(httpStatusCode).json({
      success: true,
      data: jsonResponse
    });
  } catch (error) {
    console.error('Failed to get PayPal order:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to get order' 
    });
  }
};

/**
 * Handle PayPal webhook events
 * @route POST /api/paypal/webhook
 * @access Public
 */
const handleWebhook = async (req, res) => {
  try {
    const { headers, body } = req;
    
    // Validate webhook signature (implement proper validation in production)
    const isValid = paypalService.validateWebhook(headers, body);
    
    if (!isValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid webhook signature' 
      });
    }

    const eventType = body.event_type;
    const resource = body.resource;

    console.log('PayPal webhook received:', eventType);

    // Handle different webhook events
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        // Payment was successfully captured
        console.log('Payment completed:', resource.id);
        
        // Find the payment record and increment user's account balance
        try {
          const payment = await Payment.findByPayPalPaymentId(resource.id);
          if (payment && payment.status === 'completed') {
            await User.updateBalanceById(payment.userId, payment.amount, 'add');
            console.log(`✅ Webhook: Account balance increased by $${payment.amount} for user ${payment.userId}`);
          }
        } catch (error) {
          console.error('❌ Webhook: Failed to update user account balance:', error);
        }
        break;
        
      case 'PAYMENT.CAPTURE.DENIED':
        // Payment was denied
        console.log('Payment denied:', resource.id);
        // Handle failed payment
        break;
        
      case 'PAYMENT.CAPTURE.PENDING':
        // Payment is pending
        console.log('Payment pending:', resource.id);
        // Handle pending payment
        break;
        
      default:
        console.log('Unhandled webhook event:', eventType);
    }

    res.status(200).json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Failed to process PayPal webhook:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process webhook' 
    });
  }
};

/**
 * Get PayPal configuration for frontend
 * @route GET /api/paypal/config
 * @access Public
 */
const getConfig = async (req, res) => {
  try {
    const paypalEnv = (process.env.PAYPAL_ENVIRONMENT || '').toLowerCase();
    const isLive = paypalEnv === 'live' || paypalEnv === 'production';
    const config = {
      clientId: process.env.PAYPAL_CLIENT_ID,
      environment: isLive ? 'live' : 'sandbox',
      currency: 'USD',
      intent: 'capture'
    };
    
    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Failed to get PayPal config:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get configuration' 
    });
  }
};

/**
 * Get user payment history
 * @route GET /api/paypal/payments
 * @access Private
 */
const getUserPayments = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    console.log('🔍 PayPal getUserPayments - User ID:', userId);
    console.log('🔍 PayPal getUserPayments - Request user:', req.user);
    
    if (!userId) {
      console.error('❌ No user ID found in request. User object:', req.user);
      return res.status(401).json({ 
        success: false, 
        message: 'User authentication required. Please log in again.' 
      });
    }

    const payments = await Payment.findByUserId(userId);
    
    res.status(200).json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Failed to get user payments:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to get payments' 
    });
  }
};

/**
 * Get payment details by payment ID
 * @route GET /api/paypal/payments/:paymentId
 * @access Private
 */
const getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User authentication required' 
      });
    }

    const payment = await Payment.findOne({ _id: paymentId, userId });
    
    if (!payment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Failed to get payment details:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to get payment details' 
    });
  }
};

module.exports = {
  createOrder,
  captureOrder,
  getOrder,
  handleWebhook,
  getConfig,
  getUserPayments,
  getPaymentDetails,
};
