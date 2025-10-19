const Configs = require('../models/configs.model');

async function getConfigs(req, res) {
  try {
    const doc = await Configs.findOne({});
    if (!doc) {
      return res.status(404).json({ message: 'Configs not found' });
    }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch configs' });
  }
}

async function addConfigs(req, res) {
  try {
    const { width, height, imageCostPerRunwareNonPaid, imageCostPerGeminiNonPaid, imageCostPerRunwarePaid, imageCostPerGeminiPaid, videoCostPerSecond } = req.body || {};
    if (typeof width !== 'number' || typeof height !== 'number' || width < 1 || height < 1) {
      return res.status(400).json({ message: 'width and height must be positive numbers' });
    }
    const update = { templateConfigs: { width, height }, pricingConfigs:{imageCostPerRunwareNonPaid, imageCostPerGeminiNonPaid, imageCostPerRunwarePaid, imageCostPerGeminiPaid, videoCostPerSecond} };
    const doc = await Configs.findOneAndUpdate(
      {},
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add configs' });
  }
}

async function updateConfigs(req, res) {
  try {
    const {
      width,
      height,
      imageCostPerRunwareNonPaid,
      imageCostPerGeminiNonPaid,
      imageCostPerRunwarePaid,
      imageCostPerGeminiPaid,
      videoCostPerSecond
    } = req.body || {};
    const current = await Configs.findOne({});
    if (!current) {
      return res.status(404).json({ message: 'Configs not found' });
    }
    const next = {
      templateConfigs: {
        width: width !== undefined ? width : current.templateConfigs.width,
        height: height !== undefined ? height : current.templateConfigs.height
      },
      pricingConfigs: {
        imageCostPerRunwareNonPaid:
          imageCostPerRunwareNonPaid !== undefined
            ? imageCostPerRunwareNonPaid
            : current.pricingConfigs.imageCostPerRunwareNonPaid,
        imageCostPerGeminiNonPaid:
          imageCostPerGeminiNonPaid !== undefined
            ? imageCostPerGeminiNonPaid
            : current.pricingConfigs.imageCostPerGeminiNonPaid,
        imageCostPerRunwarePaid:
          imageCostPerRunwarePaid !== undefined
            ? imageCostPerRunwarePaid
            : current.pricingConfigs.imageCostPerRunwarePaid,
        imageCostPerGeminiPaid:
          imageCostPerGeminiPaid !== undefined
            ? imageCostPerGeminiPaid
            : current.pricingConfigs.imageCostPerGeminiPaid,
        videoCostPerSecond:
          videoCostPerSecond !== undefined
            ? videoCostPerSecond
            : current.pricingConfigs.videoCostPerSecond
      }
    };
    const doc = await Configs.findOneAndUpdate({}, next, { new: true });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update configs' });
  }
}

module.exports = {
  getConfigs,
  addConfigs,
  updateConfigs
};


