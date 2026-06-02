const { Runware } = require("@runware/sdk-js");
const { GoogleGenAI } = require("@google/genai");
const AWS = require('aws-sdk');
const { Generation, User } = require("../db");
const { generateImageOverlay } = require("./imageOverlay.contoller");
const geminiService = require('../services/gemini.service');
const runwareService = require('../services/runware.service');
const geminiImageService = require('../services/geminiImage.service');
const s3Service = require('../services/s3.service');
const concurrencyLimiter = require('../services/concurrencyLimiter');
const { generateImageOverlay02 } = require("../services/imageOverlays/overlay02.service");
const { generateImageOverlay04 } = require("../services/imageOverlays/overlay04.service");
const { generateImageOverlay05 } = require("../services/imageOverlays/overlay05.service");
const { generateImageOverlay03 } = require("../services/imageOverlays/overlay03.service");
const { generateImageOverlay06 } = require("../services/imageOverlays/overlay06.service");
const { generateImageOverlay07 } = require("../services/imageOverlays/overlay07.service");
const { generateImageOverlay08 } = require("../services/imageOverlays/overlay08.service");
const { generateImageOverlay09 } = require("../services/imageOverlays/overlay09.service");
const { generateImageOverlay10 } = require("../services/imageOverlays/overlay10.service");
const { generateImageOverlay11 } = require("../services/imageOverlays/overlay11.service");
const { generateImageOverlay16 } = require("../services/imageOverlays/overlay16.service");
const { generateImageOverlay24 } = require("../services/imageOverlays/overlay24.service");
const { generateImageOverlay26 } = require("../services/imageOverlays/overlay26.service");
const { generateImageOverlay29 } = require("../services/imageOverlays/overlay29.service");
const configsModel = require("../models/configs.model");

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const runware = new Runware({ apiKey: process.env.RUNWARE_API_KEY });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MAX_CONCURRENT_IMAGE_GENERATIONS = 5;
const IMAGE_GENERATION_TIMEOUT = 60000;
const COST_PER_IMAGE = 0.25;
const COST_PER_IMAGE_Gemini = 0.3;
const COST_PER_IMAGE_PAID = 0.08;
const STORANGE_PER_IMAGE = 1.5; //MB
const RETRY_DELAY = 2000;
const MAX_RETRIES = 2;

// Function to get cost per image based on user account type
async function getCostPerImage(user, model = 'runware') {
  const configs = await configsModel.findOne({});
  if (configs && configs.pricingConfigs) {
    const pricing = configs.pricingConfigs;
    const isPaid = user?.accounttype === 'paid';
    if (model === 'nano-banana') {
      return isPaid ? pricing.imageCostPerGeminiPaid : pricing.imageCostPerGeminiNonPaid;
    }
    return isPaid ? pricing.imageCostPerRunwarePaid : pricing.imageCostPerRunwareNonPaid;
  }
  // Fallback to constants if configs are missing
  const isPaid = user?.accounttype === 'paid';
  if (model === 'nano-banana') {
    return isPaid ? COST_PER_IMAGE_Gemini : COST_PER_IMAGE_Gemini;
  }
  return isPaid ? COST_PER_IMAGE_PAID : COST_PER_IMAGE;
}

async function generateImage(req, res) {
  try {
    const { prompt, numberOfFacts, highlightCount, userId, pageName, colors, noTextOverlay } = req.body;
    if (!prompt || !numberOfFacts || !highlightCount || !userId) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const costPerImage = await getCostPerImage(user,'nano-banana');
    const estimatedCost = costPerImage * numberOfFacts;
    if (user.accountbalance < estimatedCost) {
      return res.status(402).json({ error: "Insufficient account balance." });
    }

    const modifiedPrompt = createPrompt(prompt, numberOfFacts);
    const textResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: modifiedPrompt,
    });

    if (!textResponse.candidates?.[0]?.content) {
      throw new Error("No content returned from Gemini");
    }

    const contentArr = parseFacts(textResponse.text, highlightCount);
    const { results: imageUrls, errors: imageErrors } = await processImagesWithConcurrency(contentArr, MAX_CONCURRENT_IMAGE_GENERATIONS, pageName, colors, noTextOverlay);

    // Pair content with successfully generated images
    const successfulContent = contentArr.filter((_, index) => imageUrls[index]);
    const successfulImages = imageUrls.filter(url => url);
    const failedIndexes = imageUrls.map((url, idx) => url ? null : idx).filter(idx => idx !== null);

    const actualCost = costPerImage * successfulImages.length;
    const session = await Generation.startSession();
    session.startTransaction();

    try {
      if (successfulImages.length > 0) {
        await Generation.create([{
          content: successfulContent,
          images: successfulImages,
          user: userId,
          cost: actualCost,
          pageName
        }], { session });
        await User.findByIdAndUpdate(userId, { $inc: { accountbalance: -actualCost } }, { new: true, session });
      }
      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        content: contentArr,
        images: imageUrls,
        errors: imageErrors,
        cost: actualCost
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

  } catch (error) {
    console.error("Error in generateImage:", error);
    return res.status(500).json({
      success: false,
      error: "An error occurred, please try again later!",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
}

async function processImagesWithConcurrency(contentArr, maxConcurrency, pageName, colors, noTextOverlay) {
  const results = Array(contentArr.length).fill(null); // Initialize with null to preserve order
  const errors = Array(contentArr.length).fill(null); // Track errors for each image
  const queue = contentArr.map((fact, index) => ({ fact, index })); // Track original index

  const processNext = async () => {
    while (queue.length > 0) {
      const { fact, index } = queue.shift();
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const url = await generateAndUploadImage(fact, pageName, colors, noTextOverlay);
          if (url) results[index] = url; // Store at original index
          break;
        } catch (err) {
          console.error(`Attempt ${attempt} failed for fact ${index}:`, err.message);
          if (attempt === MAX_RETRIES) {
            errors[index] = err.message || 'Unknown error';
            results[index] = null;
            console.error(`Image failed after ${MAX_RETRIES} retries for fact: ${fact.fact}`);
          } else {
            await new Promise(r => setTimeout(r, RETRY_DELAY));
          }
        }
      }
    }
  };

  const promises = Array(Math.min(maxConcurrency, contentArr.length)).fill(null).map(processNext);
  await Promise.all(promises);
  return { results, errors };
}

async function generateAndUploadImage(fact, pageName, colors, noTextOverlay) {
  const prompt = `Description: ${fact.description} Fact:${fact.fact}, Generate an image based on this description and fact with hyper-realistic natural look (3:4 aspect ratio).`;

  const images = await Promise.race([
    runware.requestImages({
      positivePrompt: prompt,
      negativePrompt: "",
      width: 768,
      height: 960,
      model: "rundiffusion:130@100",
      numberResults: 1,
      outputType: "base64Data",
      outputFormat: "PNG",
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Image generation timeout")), IMAGE_GENERATION_TIMEOUT))
  ]);

  const editedImageBase64 = await generateImageOverlay({
    base64Data: images[0].imageBase64Data,
    content: { fact: fact.fact, highlights: fact.highlights, description: fact.description },
    pageName,
    colors,
    noTextOverlay
  });

  return await uploadToS3(editedImageBase64);
}

function createPrompt(prompt, numberOfFacts) {
  return `Generate ${numberOfFacts} factual items about ${prompt}. For each fact, provide:\n1. **Fact:** [Clear statement (15-20 words)]\n2. **Description:** [100-word engaging description]\n3. **Highlights:** [3-5 key words from the fact]\nRequirements: \n- Fact must be 15-20 words\n- Description should be ~100 words\n- Maintain this exact format\n- Highlight key words\nExample:\n1. Fact: The Earth's atmosphere is 78% nitrogen...\nDescription: Nitrogen is crucial for plant growth but inert for humans...\nHighlights: [Nitrogen, plants, humans]`;
}

function parseFacts(text, highlightCount) {
  const entries = text.split(/\n(?=\d+\.\s+\*\*Fact:\*\*)/);
  return entries.map(entry => {
    const factMatch = entry.match(/\*\*Fact:\*\*(.*?)\*\*Description:\*\*/s);
    const descriptionMatch = entry.match(/\*\*Description:\*\*(.*?)\*\*Highlights:\*\*/s);
    const highlightsMatch = entry.match(/\*\*Highlights:\*\*\s*\[(.*?)\]/s);

    const fact = factMatch?.[1]?.trim()?.replace(/\*/g, '') || '';
    const description = descriptionMatch?.[1]?.trim()?.replace(/\*/g, '') || '';
    const highlights = highlightsMatch?.[1]?.trim()?.split(/,\s*/)?.map(h => h.replace(/\*/g, '')) || [];

    return {
      fact,
      description,
      highlights: highlights.length ? highlights : getRandomWords(fact, highlightCount)
    };
  }).filter(obj => obj.fact.trim());
}

function contentAdding(facts, count) {
  return facts.map(entry => ({
    fact: entry?.fact?.replace(/\*/g, '') || '',
    description: entry?.description?.replace(/\*/g, '') || '',
    highlights: getRandomWords(entry?.fact || '', count)
  })).filter(obj => obj.fact.trim());
}

function getRandomWords(text, count) {
  const words = text.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length >= 4);
  const unique = [...new Set(words)];
  if (unique.length <= count) return unique;
  const selected = new Set();
  while (selected.size < count) {
    selected.add(unique[Math.floor(Math.random() * unique.length)]);
  }
  return [...selected];
}

async function uploadToS3(base64) {
  const body = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `generated-images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`,
    Body: body,
    ContentType: 'image/png'
  };
  const { Location } = await s3.upload(params).promise();
  return Location;
}

async function generateImagesAuto(req, res) {
  try {
    const { prompt, numberOfFacts, highlightCount, userId, pageName, colors, noTextOverlay, pageId, templateNo, templateSelectMode, includePageProfileImage, pageProfileImageUrl, model } = req.body;

    if (!prompt || !numberOfFacts || !highlightCount || !userId || !pageName) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    // Validate model parameter
    if (!model || !['runaware', 'nano-banana'].includes(model)) {
      return res.status(400).json({ error: "Invalid model. Must be 'runware' or 'nano-banana'." });
    }

    console.log("Model selected for auto generation:", model);

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const costPerImage = await getCostPerImage(user, model);
    const estimatedCost = costPerImage * numberOfFacts;
    if (user.accountbalance < estimatedCost) {
      return res.status(402).json({ error: "Insufficient account balance." });
    }

    const estimatedStorange = (STORANGE_PER_IMAGE * numberOfFacts);
    if (user.availableStorange < estimatedStorange) {
      return res.status(402).json({ error: "Insufficient Storange." });
    }

    // 1. Generate prompts once
    const prompts = await geminiService.generatePrompts(prompt, numberOfFacts, highlightCount);

    // 2. Generate images concurrently with limit
    const limit = concurrencyLimiter(5); // max 5 concurrent
    
    // Select image generation service based on model
    const imageService = model === 'runaware' ? runwareService : geminiImageService;
    const imagePromises = prompts.map(p => limit(() => imageService.generateImage(p, pageName, colors, noTextOverlay, templateNo, templateSelectMode, includePageProfileImage, pageProfileImageUrl)));

    const images = await Promise.allSettled(imagePromises);

    // 3. Upload images concurrently with limit
    const uploadPromises = images.map((result, i) => {
      if (result.status === 'fulfilled') {
        return limit(() => s3Service.uploadImage(result.value));
      } else {
        return Promise.resolve(null); // failed image
      }
    });

    const imageObjects = await Promise.all(uploadPromises);

    const formattedContent = contentAdding(prompts, highlightCount);

    if (prompts.length == 0) {
      return res.status(400).json({
        error: 'Generation failed: prompt not recognized.'
      });
    }

    const actualCost = costPerImage * imageObjects.length;
    const imageUrls = imageObjects.map(img => img.Location);
    const totalBytes = parseFloat(imageObjects.reduce((sum, img) => sum + parseFloat(img.size), 0)).toFixed(2);

    await Generation.create({
      content: formattedContent,
      images: imageUrls,
      user: userId,
      cost: actualCost,
      pageName,
      pageId
    });

    await User.findByIdAndUpdate(userId, {
      $inc: {
        accountbalance: -actualCost,
        usedStorange: +totalBytes
      }
    }, { new: true });

    return res.status(200).json({
      success: true,
      content: formattedContent,
      images: imageUrls,
      cost: 123,
      model: model
    });
  } catch (error) {
    console.error('Error in generateImages:', error);
    res.status(500).json({ error: error?.message });
  }
}

async function generateImageManual(req, res) {
  try {
    const { facts, highlightCount, userId, pageName, colors, noTextOverlay, pageId, templateNo, templateSelectMode, includePageProfileImage, pageProfileImageUrl, model, enhancedPrompt } = req.body;
    console.log("Facts received:", pageProfileImageUrl);
    console.log("Model selected:", model);
    
    const numberOfFacts = facts.length;

    if (!highlightCount || !userId || !pageName) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    // Validate model parameter
    if (!model || !['runaware', 'nano-banana'].includes(model)) {
      return res.status(400).json({ error: "Invalid model. Must be 'runware' or 'nano-banana'." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const costPerImage = await getCostPerImage(user, model);
    const estimatedCost = costPerImage * numberOfFacts;
    if (user.accountbalance < estimatedCost) {
      return res.status(402).json({ error: "Insufficient account balance." });
    }

    const estimatedStorange = (STORANGE_PER_IMAGE * numberOfFacts);
    if (user.availableStorange < estimatedStorange) {
      return res.status(402).json({ error: "Insufficient Storange." });
    }

    // 2. Generate images concurrently with limit
    const limit = concurrencyLimiter(5); // max 5 concurrent
    const mappedFacts = facts.map((f) => ({
      fact: f.rowData.fact,
      description: f.rowData.description
    }));

    const formattedContent = contentAdding(mappedFacts, highlightCount);
    
    // Select image generation service based on model
    const imageService = model === 'runaware' ? runwareService : geminiImageService;
    const imagePromises = formattedContent.map(p => limit(() => imageService.generateImage(p, pageName, colors, noTextOverlay, templateNo, templateSelectMode, includePageProfileImage, pageProfileImageUrl, enhancedPrompt)));

    const images = await Promise.allSettled(imagePromises);

    // 3. Upload images concurrently with limit
    const uploadPromises = images.map((result, i) => {
      if (result.status === 'fulfilled') {
        return limit(() => s3Service.uploadImage(result.value));
      } else {
        return Promise.resolve(null); // failed image
      }
    });

    const imageObjects = await Promise.all(uploadPromises);

    const actualCost = costPerImage * imageObjects.length;
    const imageUrls = imageObjects.map(img => img.Location);
    const totalBytes = parseFloat(imageObjects.reduce((sum, img) => sum + parseFloat(img.size), 0)).toFixed(2);

    await Generation.create({
      content: formattedContent,
      images: imageUrls,
      user: userId,
      cost: actualCost,
      pageName,
      pageId: pageId
    });

    await User.findByIdAndUpdate(userId, {
      $inc: {
        accountbalance: -actualCost,
        usedStorange: +totalBytes
      }
    }, { new: true });

    return res.status(200).json({
      success: true,
      content: formattedContent,
      images: imageUrls,
      cost: 123,
      model: model
    });
  } catch (error) {
    console.error('Error in generateImages:', error);
    res.status(500).json({ error: error?.message });
  }
}

async function overlayTestFunction(req, res,next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Convert the uploaded file to base64
    const base64Data = req.file.buffer.toString('base64');

    // Example content data - customize as needed
    const content = {
      fact: "Plants communicate through AIRBORNE CHEMICALS and respond to ULTRASONIC CLICKS, revealing A HIDDEN WORLD OF PLANT interaction.",
      highlights: ["AIRBORNE CHEMICALS", "ULTRASONIC CLICKS", "HIDDEN WORLD"]
    };

    // Example options - customize as needed
    const options = {
      base64Data,
      content,
      pageName: "Plant Facts",
      colors: {
        main: "#FFFFFF",
        child: ["#32CD32", "#FFFF00", "#FFA500"] // lime green, yellow, orange
      },
      noTextOverlay: false,
      includePageProfileImage: false,
      pageProfileImageUrl: "https://s3.amazonaws.com/aipicedit.com/generated-images/1749183547784.png" // Replace with actual URL or logic to get the profile image URL
    };

    // Process the image
    const processedImage = await generateImageOverlay26(options);

    // Option 2: Return as binary image (better for direct viewing)
    const imgBuffer = Buffer.from(processedImage, 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': imgBuffer.length
    });
    res.end(imgBuffer);

  } catch (error) {
    next(error);
  }
}

async function generateImagesNoneTemplate(req, res) {
  try {
    const { prompt, userId, pageName, pageId } = req.body;

    if (!prompt || !userId || !pageName) {
      return res.status(400).json({ error: "Missing required fields: prompt, userId, pageName." });
    }

    console.log("Generating image with nano-banana (gemini) model for prompt:", prompt);

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const costPerImage = await getCostPerImage(user,'nano-banana');
    const estimatedCost = costPerImage; // Single image cost
    if (user.accountbalance < estimatedCost) {
      return res.status(402).json({ error: "Insufficient account balance." });
    }

    const estimatedStorange = STORANGE_PER_IMAGE; // Single image storage
    if (user.availableStorange < estimatedStorange) {
      return res.status(402).json({ error: "Insufficient Storage." });
    }

    // Generate single image using nano-banana (gemini) model without templates
    const limit = concurrencyLimiter(1); // Single image generation
    const prompts = await geminiService.generatePrompts(prompt, 1, 5);
    
    const imagePromise = limit(async () => {
      // Use gemini service directly without templates/overlays
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [prompt],
      });
      
      console.log('Gemini Image Generation response:', response);
      
      // Extract the image data from the response
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            return part.inlineData.data;
          }
        }
      }
      throw new Error("No image data found in Gemini response");
    });
    const formattedContent = contentAdding(prompts, 5);
    const imageResult = await Promise.allSettled([imagePromise]);
    
    if (imageResult[0].status === 'rejected') {
      throw new Error(`Image generation failed: ${imageResult[0].reason.message}`);
    }

    const rawImageBase64 = imageResult[0].value;
    
    // Upload raw image directly to S3 without any editing/overlay
    const uploadResult = await limit(() => s3Service.uploadImage(rawImageBase64));
    
    if (!uploadResult) {
      throw new Error("Failed to upload image to S3");
    }

    const actualCost = costPerImage;
    const imageUrl = uploadResult.Location;
    const totalBytes = parseFloat(uploadResult.size).toFixed(2);

    // Create generation record
    await Generation.create({
      content: formattedContent,
      images: [imageUrl],
      user: userId,
      cost: actualCost,
      pageName,
      pageId
    });

    // Update user balance and storage
    await User.findByIdAndUpdate(userId, {
      $inc: {
        accountbalance: -actualCost,
        usedStorange: +totalBytes
      }
    }, { new: true });

    return res.status(200).json({
      success: true,
      content: formattedContent,
      images: [imageUrl],
      cost: actualCost,
      model: "nano-banana"
    });
  } catch (error) {
    console.error('Error in generateImagesNoneTemplate:', error);
    res.status(500).json({ error: error?.message });
  }
}



async function generateImageWithPrompt(req, res) {
  try {
    const { prompt, userId, pageName, pageId } = req.body;

    if (!prompt || !userId || !pageName) {
      return res.status(400).json({ error: "Missing required fields: prompt, userId, pageName." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No image file provided." });
    }

    console.log("Generating image with prompt and uploaded image using Gemini model");

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const costPerImage = await getCostPerImage(user,'nano-banana');
    const estimatedCost = costPerImage; // Single image cost
    if (user.accountbalance < estimatedCost) {
      return res.status(402).json({ error: "Insufficient account balance." });
    }

    const estimatedStorange = STORANGE_PER_IMAGE; // Single image storage
    if (user.availableStorange < estimatedStorange) {
      return res.status(402).json({ error: "Insufficient Storage." });
    }

    // Convert uploaded image to base64
    const uploadedImageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Generate image using Gemini with prompt and uploaded image
    const limit = concurrencyLimiter(1); // Single image generation
    
    const imagePromise = limit(async () => {
      // Use Gemini service directly with prompt and uploaded image
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [
          {
            text: prompt
          },
          {
            inlineData: {
              data: uploadedImageBase64,
              mimeType: mimeType
            }
          }
        ],
      });
      
      console.log('Gemini Image Generation response:', response);
      
      // Extract the image data from the response
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            return part.inlineData.data;
          }
        }
      }
      throw new Error("No image data found in Gemini response");
    });

    const imageResult = await Promise.allSettled([imagePromise]);
    
    if (imageResult[0].status === 'rejected') {
      throw new Error(`Image generation failed: ${imageResult[0].reason.message}`);
    }

    const rawImageBase64 = imageResult[0].value;
    
    // Upload raw image directly to S3 without any editing/overlay
    const uploadResult = await limit(() => s3Service.uploadImage(rawImageBase64));
    
    if (!uploadResult) {
      throw new Error("Failed to upload image to S3");
    }

    const actualCost = costPerImage;
    const imageUrl = uploadResult.Location;
    const totalBytes = parseFloat(uploadResult.size).toFixed(2);

    // Create content for the generation record
    const content = [{
      fact: prompt,
      description: `Generated image based on prompt: ${prompt}`,
      highlights: prompt.split(' ').slice(0, 5) // First 5 words as highlights
    }];

    // Create generation record
    await Generation.create({
      content: content,
      images: [imageUrl],
      user: userId,
      cost: actualCost,
      pageName,
      pageId
    });

    // Update user balance and storage
    await User.findByIdAndUpdate(userId, {
      $inc: {
        accountbalance: -actualCost,
        usedStorange: +totalBytes
      }
    }, { new: true });

    return res.status(200).json({
      success: true,
      content: content,
      images: [imageUrl],
      cost: actualCost,
      model: "gemini-image-prompt"
    });
  } catch (error) {
    console.error('Error in generateImageWithPrompt:', error);
    res.status(500).json({ error: error?.message });
  }
}

module.exports = { generateImage, generateImageManual, generateImagesAuto,overlayTestFunction,generateImagesNoneTemplate, generateImageWithPrompt };