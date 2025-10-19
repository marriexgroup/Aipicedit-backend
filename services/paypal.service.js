const checkoutNodeJssdk = require('@paypal/checkout-server-sdk');
const Payment = require('../models/payment.model');
const User = require('../models/user.model');

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, FRONTEND_URL, NODE_ENV, PAYPAL_ENVIRONMENT } = process.env;

// Validate required environment variables
if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  throw new Error('PayPal credentials not found. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.');
}

if (!FRONTEND_URL) {
  throw new Error('FRONTEND_URL environment variable is required for PayPal integration.');
}

console.log('🔧 PayPal Environment Configuration:');
console.log('- NODE_ENV:', NODE_ENV);
console.log('- PAYPAL_ENVIRONMENT:', PAYPAL_ENVIRONMENT);
console.log('- Client ID exists:', !!PAYPAL_CLIENT_ID);

// Determine environment
const isProduction = PAYPAL_ENVIRONMENT === 'live' || 
                    (NODE_ENV === 'production' && PAYPAL_ENVIRONMENT !== 'sandbox');

console.log('- IS_PRODUCTION:', isProduction);

/**
 * Returns PayPal HTTP client instance with environment that has access
 * credentials context. Use this instance to invoke PayPal APIs.
 */
function client() {
  if (isProduction) {
    console.log('🚀 Using LIVE PayPal environment');
    return new checkoutNodeJssdk.core.PayPalHttpClient(
      new checkoutNodeJssdk.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
    );
  } else {
    console.log('🧪 Using SANDBOX PayPal environment');
    return new checkoutNodeJssdk.core.PayPalHttpClient(
      new checkoutNodeJssdk.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
    );
  }
}

/**
 * Create an order to start the transaction
 */
const createOrder = async (cart, userId) => {
  try {
    const totalAmount = calculateTotalAmount(cart);
    
    console.log('💰 Creating order with amount:', totalAmount);
    console.log('🌐 Frontend URL:', FRONTEND_URL);

    const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
    request.prefer("return=minimal");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: "USD",
          value: totalAmount.toFixed(2)
        },
        description: "PostGen Service Payment",
        custom_id: cart.orderId || `order_${Date.now()}`
      }],
      application_context: {
        return_url: `${FRONTEND_URL}/payment/success`,
        cancel_url: `${FRONTEND_URL}/payment/cancel`,
        brand_name: "PostGen",
        user_action: "PAY_NOW"
      }
    });

    const paypalClient = client();
    const response = await paypalClient.execute(request);
    
    console.log('✅ PayPal order created:', response.result.id);

    // Save payment record to database
    const payment = new Payment({
      userId,
      paypalOrderId: response.result.id,
      amount: totalAmount,
      currency: 'USD',
      status: 'pending',
      cart: cart,
      metadata: {
        paypalResponse: response.result
      }
    });
    
    await payment.save();
    
    return {
      jsonResponse: response.result,
      httpStatusCode: response.statusCode,
    };
  } catch (error) {
    console.error('❌ PayPal order creation failed:');
    console.error('- Error:', error.message);
    console.error('- Stack:', error.stack);
    
    if (error.statusCode) {
      console.error('- Status Code:', error.statusCode);
      console.error('- Headers:', error.headers);
      console.error('- Details:', error.details);
    }
    
    throw new Error(`Failed to create order: ${error.message}`);
  }
};

/**
 * Capture payment for the created order
 */
const captureOrder = async (orderID) => {
  try {
    console.log('🔐 Capturing order:', orderID);

    const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(orderID);
    request.prefer("return=minimal");

    const paypalClient = client();
    const response = await paypalClient.execute(request);
    
    console.log('✅ PayPal order captured:', response.result.id);

    // Update payment record in database
    const payment = await Payment.findByPayPalOrderId(orderID);
    if (payment) {
      const capture = response.result.purchase_units[0].payments.captures[0];
      await payment.completePayment(capture.id, {
        paypalCaptureResponse: response.result,
        captureStatus: capture.status,
        captureTime: capture.create_time
      });
      
      // Increment user's account balance
      if (capture.status === 'COMPLETED') {
        try {
          await User.updateBalanceById(payment.userId, payment.amount, 'add');
          console.log(`✅ Account balance increased by $${payment.amount} for user ${payment.userId}`);
        } catch (error) {
          console.error('❌ Failed to update user account balance:', error);
        }
      }
    }
    
    return {
      jsonResponse: response.result,
      httpStatusCode: response.statusCode,
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
    const request = new checkoutNodeJssdk.orders.OrdersGetRequest(orderID);
    const paypalClient = client();
    const response = await paypalClient.execute(request);
    
    return {
      jsonResponse: response.result,
      httpStatusCode: response.statusCode,
    };
  } catch (error) {
    console.error('❌ Get order failed:', error);
    throw new Error(`Failed to get order: ${error.message}`);
  }
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
 * Validate PayPal webhook signature
 */
const validateWebhook = (headers, body) => {
  // Implement proper webhook validation in production
  return true;
};

module.exports = {
  createOrder,
  captureOrder,
  getOrder,
  calculateTotalAmount,
  validateWebhook,
};