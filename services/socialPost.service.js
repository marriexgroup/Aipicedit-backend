const { Runware } = require('@runware/sdk-js');
const { getGeminiClient } = require('./geminiClient');
const s3Service = require('./s3.service');
const retryHelper = require('./retryHelper');

let runwareInstance = null;

function getRunwareClient() {
  if (!runwareInstance) {
    const apiKey = (process.env.RUNWARE_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('RUNWARE_API_KEY is not configured in environment variables');
    }
    runwareInstance = new Runware({ apiKey });
  }
  return runwareInstance;
}

/**
 * Extracts and cleans JSON from Gemini text response.
 */
function parseGeminiJsonResponse(rawText) {
  if (!rawText) throw new Error('Empty response received from Gemini');

  let cleaned = rawText.trim();

  // Strip markdown code fences if present (e.g., ```json ... ```)
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  }

  // Parse JSON
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // If direct parse fails, try locating the first '{' and last '}'
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = cleaned.substring(firstBrace, lastBrace + 1);
      return JSON.parse(extracted);
    }
    throw new Error(`Failed to parse Gemini output as JSON: ${err.message}`);
  }
}

/**
 * Generates social media copy (title, caption/description, hashtags) and an image prompt using Gemini.
 */
async function generateSocialPostContent({ topic, platform = 'facebook', language = 'english', requestId }) {
  console.log(`[API_V1] [${requestId}] Generating copy with Gemini for topic: "${topic}", platform: ${platform}, language: ${language}`);

  const systemPrompt = `You are an expert social media copywriter and visual creative director for ${platform}.
Generate high-performing, engaging social media post content based on the provided topic.
The post must be written in the specified language (${language}).

Respond with ONLY a valid, raw JSON object (no markdown surrounding, no explanation) with the following structure:
{
  "title": "A short, punchy, catchy headline for the post (5-10 words)",
  "description": "Engaging, high-converting social media post caption formatted for ${platform}. Include relevant emojis and a compelling call-to-action.",
  "hashtags": [
    "#Hashtag1",
    "#Hashtag2",
    "#Hashtag3",
    "#Hashtag4",
    "#Hashtag5"
  ],
  "imagePrompt": "A highly detailed, visual description for generating a stunning photorealistic hero image representing this topic. Describe lighting, environment, focal subjects, composition, and mood. DO NOT include any text or words inside the image."
}`;

  const userPrompt = `Topic: "${topic}"\nTarget Platform: ${platform}\nLanguage: ${language}`;

  const response = await retryHelper(async () => {
    const ai = await getGeminiClient();
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${systemPrompt}\n\n${userPrompt}`,
    });
    return result;
  });

  const rawText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("No text content returned from Gemini model");
  }

  const parsed = parseGeminiJsonResponse(rawText);

  // Validate and sanitize parsed fields
  const title = (parsed.title || topic).trim();
  const description = (parsed.description || topic).trim();
  
  // Ensure hashtags is an array with # prefix
  let hashtags = [];
  if (Array.isArray(parsed.hashtags)) {
    hashtags = parsed.hashtags.map(tag => {
      const cleanTag = tag.trim().replace(/^#+/, '');
      return `#${cleanTag}`;
    }).filter(tag => tag.length > 1);
  }
  if (hashtags.length === 0) {
    hashtags = ['#Aipicedit', '#AIContent', '#SocialMediaPost'];
  }

  const imagePrompt = (parsed.imagePrompt || topic).trim();

  return {
    title,
    description,
    hashtags,
    imagePrompt
  };
}

/**
 * Generates an image with Runware based on the visual prompt and uploads it to S3.
 */
async function generateAndStoreImage({ imagePrompt, requestId }) {
  console.log(`[API_V1] [${requestId}] Generating image with Runware for prompt: "${imagePrompt.slice(0, 100)}..."`);

  const runware = getRunwareClient();

  const enhancedPrompt = `${imagePrompt}, hyper-realistic natural look, commercial photography, 8k resolution, photorealistic, cinematic lighting, ultra-detailed`;
  const negativePrompt = "blurry, low quality, distorted, bad anatomy, text, letters, watermark, signature, logo, deformed limbs, artifacts, oversaturated";

  // 1. Request image from Runware
  const images = await retryHelper(async () => {
    return await runware.requestImages({
      positivePrompt: enhancedPrompt,
      negativePrompt,
      width: 768,
      height: 960,
      model: "rundiffusion:130@100",
      numberResults: 1,
      outputType: "base64Data",
      outputFormat: "PNG",
    });
  });

  if (!images || !images[0] || !images[0].imageBase64Data) {
    throw new Error("Runware failed to return image data");
  }

  const base64Data = images[0].imageBase64Data;
  console.log(`[API_V1] [${requestId}] Image generated from Runware successfully. Uploading to S3...`);

  // 2. Upload to AWS S3 using existing s3Service
  const uploadResult = await s3Service.uploadImage(base64Data);

  if (!uploadResult || !uploadResult.Location) {
    throw new Error("Failed to upload generated image to S3");
  }

  console.log(`[API_V1] [${requestId}] Image saved on S3: ${uploadResult.Location}`);
  return uploadResult.Location;
}

/**
 * Orchestrates full generation: Gemini copy + Runware image + S3 upload.
 */
async function generateSocialPost({ topic, platform = 'facebook', language = 'english', requestId }) {
  // Step 1: Generate text copy and visual prompt with Gemini
  const content = await generateSocialPostContent({ topic, platform, language, requestId });

  // Step 2: Generate image with Runware and upload to S3
  const imageUrl = await generateAndStoreImage({
    imagePrompt: content.imagePrompt,
    requestId
  });

  return {
    title: content.title,
    description: content.description,
    hashtags: content.hashtags,
    image_url: imageUrl
  };
}

module.exports = {
  generateSocialPost,
  generateSocialPostContent,
  generateAndStoreImage
};
