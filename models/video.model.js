const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
  operationIds: [{
    type: String,
    unique: true
  }],
  videoUrls: [{ type: String }],
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  numberOfVideos: {
    type: Number,
    default: 1,
  },
  status: {
    type: String,
  },
  errors: [{
    operationId: String,
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
});

module.exports = mongoose.model('Video', VideoSchema);