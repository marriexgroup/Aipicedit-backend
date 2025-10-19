const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  accounttype: String,
  regdate: {
    type: Date,
    default: Date.now
  },
  accountbalance: Number,
  availableStorange:{
    type: Number
  },
  usedStorange:{
    type: Number
  }
});

// Instance method to update account balance
UserSchema.methods.updateAccountBalance = function(amount, operation = 'add') {
  if (operation === 'add') {
    this.accountbalance = (this.accountbalance || 0) + amount;
    this.accounttype = 'paid';
  } else if (operation === 'subtract') {
    this.accountbalance = Math.max(0, (this.accountbalance || 0) - amount);
  }
  return this.save();
};

// Static method to update account balance by user ID
UserSchema.statics.updateBalanceById = function(userId, amount, operation = 'add') {
  if (operation === 'add') {
    return this.findByIdAndUpdate(
      userId, 
      { $inc: { accountbalance: amount }, $set: { accounttype: 'paid' } }, 
      { new: true }
    );
  } else if (operation === 'subtract') {
    return this.findByIdAndUpdate(
      userId, 
      { $inc: { accountbalance: -amount } }, 
      { new: true }
    );
  }
  throw new Error('Invalid operation. Use "add" or "subtract"');
};

module.exports = mongoose.model('User', UserSchema);
