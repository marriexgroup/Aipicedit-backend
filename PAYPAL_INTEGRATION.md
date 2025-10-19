# PayPal Integration Guide

This document provides a comprehensive guide for the PayPal payment integration in the PostGen backend.

## Overview

The PayPal integration allows users to make payments for PostGen services using PayPal's secure payment system. The integration includes:

- Order creation and payment capture
- Webhook handling for payment status updates
- Payment history tracking
- User authentication and authorization

## Setup

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```env
# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret

# Frontend URL for redirects
FRONTEND_URL=http://localhost:3000

# Environment (development/production)
NODE_ENV=development
```

### 2. PayPal Account Setup

1. Create a PayPal Developer account at [developer.paypal.com](https://developer.paypal.com)
2. Create a new app to get your Client ID and Client Secret
3. For development, use the Sandbox environment
4. For production, use the Live environment

### 3. Install Dependencies

The PayPal SDK is already included in `package.json`:

```bash
npm install
```

## API Endpoints

### Public Endpoints

#### GET `/api/paypal/config`
Get PayPal configuration for frontend integration.

**Response:**
```json
{
  "success": true,
  "data": {
    "clientId": "your_client_id",
    "environment": "sandbox",
    "currency": "USD",
    "intent": "capture"
  }
}
```

#### POST `/api/paypal/orders/:orderID/capture`
Capture a PayPal order payment (called by PayPal after user approval).

**Parameters:**
- `orderID` (string): PayPal order ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "capture_id",
    "status": "COMPLETED",
    "amount": {
      "currency_code": "USD",
      "value": "100.00"
    }
  }
}
```

#### GET `/api/paypal/orders/:orderID`
Get PayPal order details.

**Parameters:**
- `orderID` (string): PayPal order ID

#### POST `/api/paypal/webhook`
Handle PayPal webhook events.

**Body:**
```json
{
  "event_type": "PAYMENT.CAPTURE.COMPLETED",
  "resource": {
    "id": "capture_id",
    "status": "COMPLETED"
  }
}
```

### Authenticated Endpoints

#### POST `/api/paypal/orders`
Create a new PayPal order.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Body:**
```json
{
  "cart": {
    "items": [
      {
        "id": "service_1",
        "name": "Image Generation",
        "price": 50.00,
        "quantity": 2
      }
    ],
    "orderId": "custom_order_123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "paypal_order_id",
    "status": "CREATED",
    "links": [
      {
        "href": "https://www.sandbox.paypal.com/checkoutnow?token=...",
        "rel": "approve",
        "method": "GET"
      }
    ]
  }
}
```

#### GET `/api/paypal/payments`
Get user's payment history.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "payment_id",
      "userId": "user_id",
      "paypalOrderId": "paypal_order_id",
      "paypalPaymentId": "paypal_payment_id",
      "amount": 100.00,
      "currency": "USD",
      "status": "completed",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### GET `/api/paypal/payments/:paymentId`
Get specific payment details.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Parameters:**
- `paymentId` (string): Payment ID

## Database Schema

### Payment Model

```javascript
{
  userId: ObjectId,           // Reference to User
  paypalOrderId: String,      // PayPal order ID
  paypalPaymentId: String,    // PayPal payment ID (after capture)
  amount: Number,             // Payment amount
  currency: String,           // Currency code (default: USD)
  status: String,             // pending, completed, failed, cancelled
  paymentMethod: String,      // Payment method (default: paypal)
  description: String,        // Payment description
  cart: Mixed,                // Cart information
  metadata: Mixed,            // Additional payment metadata
  createdAt: Date,            // Creation timestamp
  updatedAt: Date             // Last update timestamp
}
```

## Frontend Integration

### 1. Get PayPal Configuration

```javascript
const response = await fetch('/api/paypal/config');
const config = await response.json();
```

### 2. Create Order

```javascript
const createOrder = async (cart) => {
  const response = await fetch('/api/paypal/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ cart })
  });
  
  const result = await response.json();
  return result.data;
};
```

### 3. Redirect to PayPal

```javascript
const order = await createOrder(cart);
const approveLink = order.links.find(link => link.rel === 'approve');
window.location.href = approveLink.href;
```

### 4. Handle Return from PayPal

```javascript
// On your success page
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

if (token) {
  const response = await fetch(`/api/paypal/orders/${token}/capture`, {
    method: 'POST'
  });
  
  const result = await response.json();
  if (result.success) {
    // Payment completed successfully
    console.log('Payment completed:', result.data);
  }
}
```

## Webhook Handling

The webhook endpoint handles various PayPal events:

- `PAYMENT.CAPTURE.COMPLETED`: Payment successfully captured
- `PAYMENT.CAPTURE.DENIED`: Payment was denied
- `PAYMENT.CAPTURE.PENDING`: Payment is pending

### Webhook Setup

1. In your PayPal Developer Dashboard, create a webhook
2. Set the webhook URL to: `https://your-domain.com/api/paypal/webhook`
3. Select the events you want to receive

## Error Handling

The integration includes comprehensive error handling:

- PayPal API errors are caught and formatted
- Database errors are handled gracefully
- Authentication errors return appropriate status codes
- Validation errors provide clear messages

## Security Considerations

1. **Environment Variables**: Never commit PayPal credentials to version control
2. **Webhook Validation**: Implement proper webhook signature validation in production
3. **Authentication**: All sensitive endpoints require JWT authentication
4. **HTTPS**: Use HTTPS in production for all PayPal communications
5. **Input Validation**: All inputs are validated before processing

## Testing

### Sandbox Testing

1. Use PayPal Sandbox accounts for testing
2. Create test buyer and seller accounts
3. Test the complete payment flow
4. Verify webhook handling

### Production Checklist

- [ ] Switch to Live environment
- [ ] Update PayPal credentials
- [ ] Configure production webhook URL
- [ ] Test with real PayPal accounts
- [ ] Monitor webhook events
- [ ] Set up error monitoring

## Troubleshooting

### Common Issues

1. **Invalid Client ID/Secret**: Verify your PayPal credentials
2. **Webhook Not Receiving Events**: Check webhook URL and event selection
3. **Authentication Errors**: Ensure JWT token is valid and not expired
4. **Database Errors**: Check MongoDB connection and schema

### Debug Mode

Enable debug logging by setting the PayPal client logging level:

```javascript
logging: {
  logLevel: LogLevel.Debug,
  logRequest: {
    logBody: true,
  },
  logResponse: {
    logHeaders: true,
  },
}
```

## Support

For PayPal-specific issues, refer to:
- [PayPal Developer Documentation](https://developer.paypal.com/docs/)
- [PayPal API Reference](https://developer.paypal.com/docs/api/)
- [PayPal Support](https://developer.paypal.com/support/)

For application-specific issues, check the server logs and database records.
