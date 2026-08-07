const mongoose = require('mongoose');

const ConfigsSchema = new mongoose.Schema({
  templateConfigs: {
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 }
  },
  pricingConfigs:{
    imageCostPerRunwareNonPaid: { type: Number, required: true },
    imageCostPerGeminiNonPaid: { type: Number, required: true, min: 1 },
    imageCostPerRunwarePaid: { type: Number, required: true },
    imageCostPerGeminiPaid: { type: Number, required: true, min: 1 },
    videoCostPerSecond: { type: Number, required: true, min: 1 }
  },
  activeGeminiKey: { type: String, enum: ['key1', 'key2'], default: 'key1' }
}, { timestamps: true });

module.exports = mongoose.model('Configs', ConfigsSchema);
