const { Runware } = require("@runware/sdk-js");
const Configs = require('../models/configs.model');
const retryHelper = require('./retryHelper');
const { generateImageOverlay } = require("../controllers/imageOverlay.contoller");
const { generateImageOverlay02 } = require("./imageOverlays/overlay02.service");
const { generateImageOverlay03 } = require("./imageOverlays/overlay03.service");
const { generateImageOverlay04 } = require("./imageOverlays/overlay04.service");
const { generateImageOverlay05 } = require("./imageOverlays/overlay05.service");
const { generateImageOverlay06 } = require("./imageOverlays/overlay06.service");
const { generateImageOverlay07 } = require("./imageOverlays/overlay07.service");
const { generateImageOverlay08 } = require("./imageOverlays/overlay08.service");
const { generateImageOverlay09 } = require("./imageOverlays/overlay09.service");
const { generateImageOverlay10 } = require("./imageOverlays/overlay10.service");
const { generateImageOverlay11 } = require("./imageOverlays/overlay11.service");
const { generateImageOverlay12 } = require("./imageOverlays/overlay12.service");
const { generateImageOverlay13 } = require("./imageOverlays/overlay13.service");
const { generateImageOverlay14 } = require("./imageOverlays/overlay14.service");
const { generateImageOverlay15 } = require("./imageOverlays/overlay15.service");
const { generateImageOverlay16 } = require("./imageOverlays/overlay16.service");
const { generateImageOverlay17 } = require("./imageOverlays/overlay17.service");
const { generateImageOverlay18 } = require("./imageOverlays/overlay18.service");
const { generateImageOverlay19 } = require("./imageOverlays/overlay19.service");
const { generateImageOverlay20 } = require("./imageOverlays/overlay20.service");
const { generateImageOverlay21 } = require("./imageOverlays/overlay21.service");
const { generateImageOverlay22 } = require("./imageOverlays/overlay22.service");
const { generateImageOverlay23 } = require("./imageOverlays/overlay23.service");
const { generateImageOverlay24 } = require("./imageOverlays/overlay24.service");
const { generateImageOverlay25 } = require("./imageOverlays/overlay25.service");
const { generateImageOverlay26 } = require("./imageOverlays/overlay26.service");
const { generateImageOverlay27 } = require("./imageOverlays/overlay27.service");
const { generateImageOverlay28 } = require("./imageOverlays/overlay28.service");
const { generateImageOverlay29 } = require("./imageOverlays/overlay29.service");

const runware = new Runware({ apiKey: process.env.RUNWARE_API_KEY });

async function generateImage(fact, pageName, colors, noTextOverlay, templateNo, templateSelectMode,includePageProfileImage,pageProfileImageUrl ) {

  const prompt = `Description: ${fact.description} Fact:${fact.fact}, Generate an image based on this description and fact with hyper-realistic natural look (3:4 aspect ratio).`;

  const response = await retryHelper(async () => {
    const generatedImage = await runware.requestImages({
      positivePrompt: prompt,
      negativePrompt: "",
      width: 768,
      height: 960,
      model: "rundiffusion:130@100",
      numberResults: 1,
      outputType: "base64Data",
      outputFormat: "PNG",
    });
    return generatedImage[0].imageBase64Data;
  }

  );

  const overlayFunctions = [
    generateImageOverlay,
    generateImageOverlay02,
    generateImageOverlay03,
    generateImageOverlay04,
    generateImageOverlay05,
    generateImageOverlay06,
    generateImageOverlay07,
    generateImageOverlay08,
    generateImageOverlay09,
    generateImageOverlay10,
    generateImageOverlay11,
    generateImageOverlay12,
    generateImageOverlay13,
    generateImageOverlay14,
    generateImageOverlay15,
    generateImageOverlay16,
    generateImageOverlay17,
    generateImageOverlay18,
    generateImageOverlay19,
    generateImageOverlay20,
    generateImageOverlay21,
    generateImageOverlay22,
    generateImageOverlay23,
    generateImageOverlay24,
    generateImageOverlay25,
    generateImageOverlay26,
    generateImageOverlay27,
    generateImageOverlay28,
    generateImageOverlay29,

  ];

  function getRandomOverlayFunction() {
    const randomIndex = Math.floor(Math.random() * overlayFunctions.length);
    return overlayFunctions[randomIndex];
  }

  let randomOverlay;
  if (templateSelectMode == "auto") {
    randomOverlay = getRandomOverlayFunction();
  } else {
    randomOverlay = overlayFunctions[templateNo - 1];
  }
  // Load template size from single Configs document (fallback to 768x960)
  let templateWidth = 768;
  let templateHeight = 960;
  try {
    const cfg = await Configs.findOne({});
    if (cfg && cfg.templateConfigs) {
      if (typeof cfg.templateConfigs.width === 'number' && cfg.templateConfigs.width > 0) {
        templateWidth = cfg.templateConfigs.width;
      }
      if (typeof cfg.templateConfigs.height === 'number' && cfg.templateConfigs.height > 0) {
        templateHeight = cfg.templateConfigs.height;
      }
    }
  } catch (e) {
    console.log('Error with config fech:',e);
  }

  const editedImageBase64 = await randomOverlay({
    base64Data: response,
    content: { fact: fact.fact, highlights: fact.highlights, description: fact.description },
    pageName,
    colors,
    noTextOverlay,
    includePageProfileImage,
    pageProfileImageUrl,
    templateWidth,
    templateHeight
  });

  if (editedImageBase64) {
    console.log('Image Generated form Runware and edited ✅');
  }
  // Assuming response.data.image contains base64 or buffer
  return editedImageBase64;
}

module.exports = { generateImage };
