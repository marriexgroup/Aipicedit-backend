const mongoose = require('mongoose');

const VoiceVideoSceneSchema = new mongoose.Schema({
  sceneIndex: { type: Number, required: true },
  imagePrompt: { type: String, required: true },
  voiceoverText: { type: String, required: true },
  duration: { type: Number, required: true },
  imageUrl: { type: String },
  audioUrl: { type: String },
});

const VoiceVideoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  prompt: {
    type: String,
    required: true,
  },
  title: {
    type: String,
  },
  scenes: [VoiceVideoSceneSchema],
  status: {
    type: String,
    enum: ['pending', 'scenes_generated', 'images_generating', 'voices_generating', 'video_merging', 'completed', 'failed'],
    default: 'pending',
  },
  videoUrl: {
    type: String,
  },
  errorMessage: {
    type: String,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('VoiceVideo', VoiceVideoSchema);
