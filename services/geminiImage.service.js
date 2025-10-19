const { GoogleGenAI } = require("@google/genai");
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
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateImage(fact, pageName, colors, noTextOverlay, templateNo, templateSelectMode, includePageProfileImage, pageProfileImageUrl, enhancedPrompt) {
  const prompt = `Description: ${fact.description} Fact:${fact.fact}, Generate an image based on this description and fact with hyper-realistic natural look (9:16 aspect ratio). consider  consider ${enhancedPrompt}`;

  const response = await retryHelper(async () => {
    const generatedImage = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: [prompt],
      // generationConfig: {
      //   aspectRatio:'9:16' // Specify the desired aspect ratio here
      // }
    });
    console.log('Gemini Image Generation response:', generatedImage);
    
    // Extract the image data from the response
    if (generatedImage.candidates?.[0]?.content?.parts) {
      for (const part of generatedImage.candidates[0].content.parts) {
        if (part.inlineData) {
          return part.inlineData.data;
        }
      }
    }
    throw new Error("No image data found in Gemini response");
  });

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
    generateImageOverlay25
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

  const editedImageBase64 = await randomOverlay({
    base64Data: response,
    content: { fact: fact.fact, highlights: fact.highlights, description: fact.description },
    pageName,
    colors,
    noTextOverlay,
    includePageProfileImage,
    pageProfileImageUrl
  });

  if (editedImageBase64) {
    console.log('Image Generated from Gemini 2.5 Flash Image and edited ✅');
  }
  
  return response;
}

module.exports = { generateImage };
