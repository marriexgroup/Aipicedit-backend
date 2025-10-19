const mongoose = require('mongoose');

const VideoPartSchema = new mongoose.Schema({
  partNumber: {
    type: Number,
    required: true
  },
  prompt: {
    type: String,
    required: true
  },
  operationId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  videoUrl: {
    type: String,
    default: null
  },
  error: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
});

const LongVideoGenerationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Page',
    default: null
  },
  originalPrompt: {
    type: String,
    required: true
  },
  totalDuration: {
    type: Number,
    required: true
  },
  totalParts: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  videoParts: [VideoPartSchema],
  progress: {
    completed: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    }
  },
  metadata: {
    totalCost: {
      type: Number,
      required: true
    },
    startTime: {
      type: Date,
      default: Date.now
    },
    endTime: {
      type: Date,
      default: null
    },
    estimatedCompletionTime: {
      type: Date,
      default: null
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
LongVideoGenerationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Calculate progress percentage
LongVideoGenerationSchema.methods.calculateProgress = function() {
  const total = this.totalParts;
  const completed = this.videoParts.filter(part => part.status === 'completed').length;
  const failed = this.videoParts.filter(part => part.status === 'failed').length;
  
  this.progress.completed = completed;
  this.progress.failed = failed;
  this.progress.percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return this.progress;
};

// Check if generation is complete
LongVideoGenerationSchema.methods.isComplete = function() {
  return this.progress.completed === this.totalParts;
};

// Get all completed video URLs
LongVideoGenerationSchema.methods.getVideoUrls = function() {
  return this.videoParts
    .filter(part => part.status === 'completed' && part.videoUrl)
    .sort((a, b) => a.partNumber - b.partNumber)
    .map(part => part.videoUrl);
};

module.exports = mongoose.model('LongVideoGeneration', LongVideoGenerationSchema);
