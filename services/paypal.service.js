const Payment = require('../models/payment.model');
const User = require('../models/user.model');

// Determine fetch implementation (native in Node 18+, fallback to node-fetch if needed)
const fetchApi = globalThis.fetch || require('node-fetch');

/**
 * Determine PayPal API Base URL strictly based on PAYPAL_ENVIRONMENT
 */
const getBaseUrl = () => {
  const env = (process.env.PAYPAL_ENVIRONMENT || '').toLowerCase();
  const isProduction = env === 'live' || env === 'production';
  return isProduction ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
};

/**
 * Access Token Cache
 */
let cachedAccessToken = null;
let tokenExpiresAt = 0;

/**
 * Generate or return cached OAuth 2.0 access token
 */
const getAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials missing. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.');
  }

  // Return cached token if valid (with 60-second safety buffer)
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const baseUrl = getBaseUrl();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetchApi(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    body: 'grant_type=client_credentials',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ PayPal Access Token Error:', data);
    throw new Error(data.error_description || data.error || 'Failed to authenticate with PayPal');
  }

  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);
  return cachedAccessToken;
};

/**
 * Calculate total amount from cart items
 */
const calculateTotalAmount = (cart) => {
  if (!cart || !cart.items || !Array.isArray(cart.items)) {
    return 0;
  }
  
  return cart.items.reduce((total, item) => {
    const itemPrice = parseFloat(item.price) || 0;
    const quantity = parseInt(item.quantity) || 1;
    return total + (itemPrice * quantity);
  }, 0);
};

/**
 * Create an order to start the transaction
 */
const createOrder = async (cart, userId) => {
  try {
    const totalAmount = calculateTotalAmount(cart);
    if (totalAmount < 1) {
      throw new Error('Minimum payment amount is $1.00');
    }
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    console.log('💰 Creating order with amount:', totalAmount);
    console.log('🌐 Frontend URL:', frontendUrl);
    console.log('🌐 PayPal Target Base URL:', getBaseUrl());

    const accessToken = await getAccessToken();
    const baseUrl = getBaseUrl();

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: totalAmount.toFixed(2)
        },
        description: 'PostGen Service Payment',
        custom_id: cart.orderId || `order_${Date.now()}`
      }],
      application_context: {
        return_url: `${frontendUrl}/payment/success`,
        cancel_url: `${frontendUrl}/payment/cancel`,
        brand_name: 'PostGen',
        user_action: 'PAY_NOW'
      }
    };

    const response = await fetchApi(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(orderPayload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ PayPal order creation API error response:', data);
      throw new Error(JSON.stringify(data));
    }

    console.log('✅ PayPal order created:', data.id);

    // Save payment record to database
    const payment = new Payment({
      userId,
      paypalOrderId: data.id,
      amount: totalAmount,
      currency: 'USD',
      status: 'pending',
      cart: cart,
      metadata: {
        paypalResponse: data
      }
    });
    
    await payment.save();
    
    return {
      jsonResponse: data,
      httpStatusCode: response.status,
    };
  } catch (error) {
    console.error('❌ PayPal order creation failed:');
    console.error('- Error:', error.message);
    throw new Error(`Failed to create order: ${error.message}`);
  }
};

/**
 * Capture payment for the created order
 */
const captureOrder = async (orderID) => {
  try {
    console.log('🔐 Capturing order:', orderID);

    const accessToken = await getAccessToken();
    const baseUrl = getBaseUrl();

    const response = await fetchApi(`${baseUrl}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'return=representation'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ PayPal order capture API error response:', data);
      throw new Error(JSON.stringify(data));
    }

    console.log('✅ PayPal order captured:', data.id);

    // Update payment record in database
    const payment = await Payment.findByPayPalOrderId(orderID);
    if (payment) {
      const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
      const captureId = capture ? capture.id : data.id;
      const captureStatus = capture ? capture.status : data.status;
      const captureTime = capture ? capture.create_time : new Date().toISOString();

      await payment.completePayment(captureId, {
        paypalCaptureResponse: data,
        captureStatus: captureStatus,
        captureTime: captureTime
      });
      
      // Increment user's account balance
      if (captureStatus === 'COMPLETED') {
        try {
          await User.updateBalanceById(payment.userId, payment.amount, 'add');
          console.log(`✅ Account balance increased by $${payment.amount} for user ${payment.userId}`);
        } catch (err) {
          console.error('❌ Failed to update user account balance:', err);
        }
      }
    }
    
    return {
      jsonResponse: data,
      httpStatusCode: response.status,
    };
  } catch (error) {
    console.error('❌ PayPal order capture failed:', error);
    throw new Error(`Failed to capture order: ${error.message}`);
  }
};

/**
 * Get order details
 */
const getOrder = async (orderID) => {
  try {
    const accessToken = await getAccessToken();
    const baseUrl = getBaseUrl();

    const response = await fetchApi(`${baseUrl}/v2/checkout/orders/${orderID}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }
    
    return {
      jsonResponse: data,
      httpStatusCode: response.status,
    };
  } catch (error) {
    console.error('❌ Get order failed:', error);
    throw new Error(`Failed to get order: ${error.message}`);
  }
};

/**
 * Validate PayPal webhook signature
 */
const validateWebhook = (headers, body) => {
  // Webhook signature validation placeholder
  return true;
};

module.exports = {
  createOrder,
  captureOrder,
  getOrder,
  calculateTotalAmount,
  validateWebhook,
  getBaseUrl,
};