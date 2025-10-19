const mongoose = require('mongoose');

const ContentItemSchema = new mongoose.Schema({
    fact: { type: String, required: true },
    description: { type: String, required: true },
    highlights: [{ type: String, required: true }],
});

const GenerationSchema = new mongoose.Schema({
    content: [ContentItemSchema],
    images: [{ type: String }],
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    generationDate: {
        type: Date,
        default: Date.now
    },
    cost: {
        type: Number,
        required: true
    },
    pageName:{ type: String, required: true },
    isVideo: {
        type: Boolean,
        default: false
    },
    pageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Page',
        required: true
    },
    videoUrl: { type: String, required: false },
    videoType: { type: String, required: false },
});

module.exports = mongoose.model('Generation', GenerationSchema);
