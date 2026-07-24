const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  paypalOrderId: {
    type: String,
    required: true,
    unique: true
  },
  paypalPaymentId: {
    type: String,
    unique: true,
    sparse: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    default: 'paypal'
  },
  description: {
    type: String,
    default: 'PostGen Service Payment'
  },
  cart: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });

// Update the updatedAt field before saving
paymentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to find payment by PayPal order ID
paymentSchema.statics.findByPayPalOrderId = function(orderId) {
  return this.findOne({ paypalOrderId: orderId });
};

// Static method to find payment by PayPal payment ID
paymentSchema.statics.findByPayPalPaymentId = function(paymentId) {
  return this.findOne({ paypalPaymentId: paymentId });
};

// Static method to find payments by user ID
paymentSchema.statics.findByUserId = function(userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

// Instance method to update payment status
paymentSchema.methods.updateStatus = function(status) {
  this.status = status;
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to complete payment
paymentSchema.methods.completePayment = function(paymentId, metadata = {}) {
  this.paypalPaymentId = paymentId;
  this.status = 'completed';
  this.metadata = { ...this.metadata, ...metadata };
  this.updatedAt = new Date();
  return this.save();
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
