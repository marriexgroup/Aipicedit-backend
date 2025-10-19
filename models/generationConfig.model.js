const mongoose = require('mongoose');

const GenerationConfigSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    pageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Page',
        required: true
    },
    pageName: {
        type: String,
        required: true
    },
    mode: {
        type: String,
        enum: ['auto', 'manual'],
        required: true
    },
    templateSelectMode: {
        type: String,
        enum: ['auto', 'manual'],
        required: true
    },
    templateName: {
        type: Number,
        default: 1
    },
    factCount: {
        type: Number,
        required: true,
        min: 1,
        max: 25
    },
    numberOfWordsToBeHighlighted: {
        type: Number,
        required: true,
        min: 1,
        max: 20
    },
    prompt: {
        type: String,
        required: true
    },
    colors: {
        main: {
            type: String,
            required: true
        },
        child: [{
            type: String,
            required: true
        }]
    },
    noTextOverlay: {
        type: Boolean,
        default: false
    },
    includePageProfileImage: {
        type: Boolean,
        default: false
    },
    uploadedData: [{
        rowData: {
            fact: {
                type: String,
                required: true
            },
            description: {
                type: String,
                required: true
            }
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    model:{
        type: String,
        required: false
    }
});

// Update the updatedAt field before saving
GenerationConfigSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('GenerationConfig', GenerationConfigSchema);
