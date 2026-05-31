const mongoose = require('mongoose');
const { Schema } = mongoose;

// Sub-schema for the content/fact
const ContentSchema = new Schema({
  fact: { type: String, required: false },
  description: { type: String, required: false },
  highlights: { type: [String], required: false },
  text: { type: String, required: false },
  _id: { type: Schema.Types.ObjectId, required: false }
});

// Sub-schema for individual posts
const PostSchema = new Schema({
  generationId: { 
    type: Schema.Types.ObjectId, 
    required: false,
    ref: 'Generation' // Reference to the original generation if needed
  },
  imageUrl: { 
    type: String, 
    required: true
  },
  content: { 
    type: ContentSchema,
    required: true 
  },
  generationDate: { 
    type: Date, 
    required: false 
  },
  // Canonical UTC timestamp sent from the frontend as a full ISO 8601 string.
  // This is timezone-safe: the frontend converts local time → UTC before sending.
  scheduledAt: {
    type: Date,
    required: false // optional for backward compat with old records
  },
  // Legacy fields kept for backward compatibility
  scheduleDate: { 
    type: Date, 
    required: false 
  },
  scheduleTime: { 
    type: String, 
    required: false,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ // HH:MM format
  },
  // timezone string from the user's browser (e.g. 'Asia/Colombo')
  timezone: {
    type: String,
    required: false
  },
  scheduledDateTime: { // Combined field for easier querying
    type: Date,
    required: true
  }
});

// Main ScheduledPosts schema
const ScheduledPostsSchema = new Schema({
  page: { 
    type: String, 
    required: true,
    
  },
  posts: { 
    type: [PostSchema], 
    required: true,
    validate: {
      validator: function(v) {
        return v.length > 0;
      },
      message: 'At least one post is required'
    }
  },
  status: {
    type: String,
    enum: ['scheduled', 'published', 'failed'],
    default: 'scheduled'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

// Pre-save hook: derive scheduledDateTime from the canonical scheduledAt UTC timestamp.
// Falls back to the legacy date+time strings only if scheduledAt is missing (old records).
ScheduledPostsSchema.pre('save', function(next) {
  this.posts.forEach(post => {
    if (post.scheduledAt) {
      // Primary path: scheduledAt is a proper UTC Date — use it directly.
      post.scheduledDateTime = new Date(post.scheduledAt);
    } else if (post.scheduleDate && post.scheduleTime) {
      // Legacy fallback: reconstruct from separate fields (timezone-imprecise).
      const [hours, minutes] = post.scheduleTime.split(':');
      const scheduledDate = new Date(post.scheduleDate);
      scheduledDate.setUTCHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      post.scheduledDateTime = scheduledDate;
    }
  });
  next();
});

// Index for querying scheduled posts efficiently
ScheduledPostsSchema.index({ 
  'posts.scheduledDateTime': 1,
  status: 1 
});

const ScheduledPosts = mongoose.model('Posts', ScheduledPostsSchema);

module.exports = ScheduledPosts;