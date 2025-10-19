const mongoose = require('mongoose');
const { Schema } = mongoose;

// Sub-schema for the content/fact
const ContentSchema = new Schema({
  fact: { type: String, required: true },
  description: { type: String, required: true },
  highlights: { type: [String], required: true },
  _id: { type: Schema.Types.ObjectId, required: true }
});

// Sub-schema for individual posts
const PostSchema = new Schema({
  generationId: { 
    type: Schema.Types.ObjectId, 
    required: true,
    ref: 'Generation' // Reference to the original generation if needed
  },
  imageUrl: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v) {
        return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/.test(v);
      },
      message: props => `${props.value} is not a valid URL!`
    }
  },
  content: { 
    type: ContentSchema,
    required: true 
  },
  generationDate: { 
    type: Date, 
    required: true 
  },
  scheduleDate: { 
    type: Date, 
    required: true 
  },
  scheduleTime: { 
    type: String, 
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ // HH:MM format
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

// Pre-save hook to combine date and time into scheduledDateTime
ScheduledPostsSchema.pre('save', function(next) {
  this.posts.forEach(post => {
    const [hours, minutes] = post.scheduleTime.split(':');
    const scheduledDate = new Date(post.scheduleDate);
    scheduledDate.setHours(hours);
    scheduledDate.setMinutes(minutes);
    post.scheduledDateTime = scheduledDate;
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