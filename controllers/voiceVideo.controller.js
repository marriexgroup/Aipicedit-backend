const fs = require('fs');
const path = require('path');
const os = require('os');
const nodeFetch = require('node-fetch');
const { GoogleAuth } = require('google-auth-library');
const { GoogleGenAI } = require('@google/genai');
const { Runware } = require('@runware/sdk-js');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const { VoiceVideo, User } = require('../db');
const { uploadBuffer } = require('../services/s3.service');

// Configure ffmpeg path and make it executable on serverless environments
try {
  if (fs.existsSync(ffmpegStatic)) {
    fs.chmodSync(ffmpegStatic, 0o755);
  }
} catch (e) {
  console.warn("Chmod on ffmpeg failed, might be read-only filesystem or already executable:", e.message);
}
ffmpeg.setFfmpegPath(ffmpegStatic);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const runware = new Runware({ apiKey: process.env.RUNWARE_API_KEY });
const serviceAccountKeyPath = path.resolve(__dirname, '../secrets/veo-service-account-key.json');

// System prompt for Gemini to structure text into scenes
const systemPrompt = `You are a professional video script writer and storyboarding AI.
Your task is to take a story or script text and divide it into sequential scenes for a video.
For each scene, you must generate:
1. "imagePrompt": A highly detailed and descriptive text-to-image prompt (for Stable Diffusion/Runware). This prompt must describe the visual elements, mood, color palette, and cinematic lighting, but must not contain text or instructional words.
2. "voiceoverText": The exact narration script corresponding to this part of the story. The voiceover text across all scenes must cover the entire input text completely, without omitting details. Keep each voiceover segment under 35 words.
3. "duration": Estimated duration in seconds needed to speak the voiceover at a normal pace (~2 to 2.5 words per second). Ensure the duration is between 4 and 12 seconds.

You MUST return a JSON object with this exact structure:
{
  "title": "A short, engaging title for the video based on the text",
  "scenes": [
    {
      "sceneIndex": 1,
      "imagePrompt": "A cinematic close-up shot of Saturn's icy moon Enceladus, with giant geysers erupting from the south pole into space...",
      "voiceoverText": "Imagine a frozen world nearly one point three billion kilometers from Earth, orbiting the giant planet Saturn.",
      "duration": 7
    },
    ...
  ]
}
Make sure all numbers are spelled out in the voiceover text (e.g. "one point three billion" instead of "1.3 billion") so they are read correctly by the text-to-speech engine. Do not add any backticks, markdown code blocks, or text outside the JSON object.`;

/**
 * Initiates the voice video generation job
 */
async function generateVoiceVideo(req, res) {
  try {
    const { prompt, userId, aspectRatio = '16:9', voiceName = 'en-US-Wavenet-D' } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: "Missing 'prompt' in request body."
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    // Check user balance (say 15 credits minimum needed)
    const user = await User.findById(userId);
    if (!user || user.accountbalance < 15) {
      return res.status(400).json({
        success: false,
        message: "Insufficient account balance. Minimum 15 credits required."
      });
    }

    // Create record in DB
    const voiceVideo = new VoiceVideo({
      userId,
      prompt,
      aspectRatio,
      voiceName,
      status: 'pending',
    });
    await voiceVideo.save();

    // Respond immediately
    res.status(202).json({
      success: true,
      message: "Voice video generation started in background",
      data: {
        videoId: voiceVideo._id,
        status: voiceVideo.status,
      }
    });

    // Run background worker
    processVoiceVideoGeneration(voiceVideo._id, userId);

  } catch (error) {
    console.error("Voice video generation request error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to initiate voice video generation",
      error: error.message
    });
  }
}

/**
 * Background worker processing the steps sequentially
 */
async function processVoiceVideoGeneration(videoId, userId) {
  let tempJobDir = null;
  try {
    console.log(`[Worker] Starting voice video generation job for ID: ${videoId}`);
    const job = await VoiceVideo.findById(videoId);
    if (!job) {
      console.error(`[Worker] Job ${videoId} not found in database`);
      return;
    }

    const aspectRatio = job.aspectRatio || '16:9';
    const voiceName = job.voiceName || 'en-US-Wavenet-D';

    // Step 1: Divide into scenes using Gemini
    console.log(`[Worker] Step 1: Querying Gemini for scene decomposition...`);
    let geminiResponse;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Divide this text into scenes:\n\n${job.prompt}`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json"
        }
      });
      geminiResponse = JSON.parse(response.text);
    } catch (err) {
      let friendlyMessage = err.message;
      if (err.message.includes("API key not valid") || err.message.includes("API_KEY_INVALID") || err.status === 400) {
        friendlyMessage = "The GEMINI_API_KEY in your backend .env file is invalid, expired, or inactive. Please update it with a valid API key from Google AI Studio (https://aistudio.google.com/).";
      }
      throw new Error(`Gemini scene generation failed: ${friendlyMessage}`);
    }

    console.log(`[Worker] Gemini divided prompt into ${geminiResponse.scenes.length} scenes. Title: ${geminiResponse.title}`);
    job.title = geminiResponse.title;
    job.scenes = geminiResponse.scenes.map(s => ({
      sceneIndex: s.sceneIndex,
      imagePrompt: s.imagePrompt,
      voiceoverText: s.voiceoverText,
      duration: s.duration || 6
    }));
    job.status = 'scenes_generated';
    await job.save();

    // Step 2: Generate Images via Runware
    console.log(`[Worker] Step 2: Generating images with Runware...`);
    job.status = 'images_generating';
    await job.save();

    const isVertical = aspectRatio === '9:16';
    const runwareWidth = isVertical ? 576 : 1024;
    const runwareHeight = isVertical ? 1024 : 576;

    for (let i = 0; i < job.scenes.length; i++) {
      const scene = job.scenes[i];
      console.log(`[Worker] Generating image for scene ${i + 1}/${job.scenes.length}: "${scene.imagePrompt.substring(0, 40)}..."`);
      try {
        const generatedImage = await runware.requestImages({
          positivePrompt: scene.imagePrompt + ", hyper-realistic, cinematic lighting, 8k resolution, detailed, space exploration documentary style",
          negativePrompt: "text, watermark, logo, bad quality, drawing, cartoon",
          width: runwareWidth,
          height: runwareHeight,
          model: "rundiffusion:130@100",
          numberResults: 1,
          outputType: "base64Data",
          outputFormat: "PNG",
        });

        if (!generatedImage || generatedImage.length === 0) {
          throw new Error("Runware returned no image data");
        }

        // Upload image to S3
        const imageBase64 = generatedImage[0].imageBase64Data;
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        const s3Key = `voice-video-gen/${videoId}/scene-${scene.sceneIndex}-${Date.now()}.png`;
        const imageUrl = await uploadBuffer(imageBuffer, s3Key, 'image/png');
        
        scene.imageUrl = imageUrl;
        await job.save();
      } catch (err) {
        throw new Error(`Runware image generation failed for scene ${scene.sceneIndex}: ${err.message}`);
      }
    }

    // Step 3: Generate Voice Clips using Google TTS or Fallback
    console.log(`[Worker] Step 3: Generating voice clips with Text-To-Speech...`);
    job.status = 'voices_generating';
    await job.save();

    for (let i = 0; i < job.scenes.length; i++) {
      const scene = job.scenes[i];
      console.log(`[Worker] Generating voice for scene ${i + 1}/${job.scenes.length}: "${scene.voiceoverText.substring(0, 40)}..."`);
      try {
        let audioBuffer;
        try {
          // Attempt Google Cloud TTS
          audioBuffer = await generateGoogleTTS(scene.voiceoverText, serviceAccountKeyPath, voiceName);
        } catch (ttsErr) {
          console.warn(`[Worker] Google Cloud TTS failed, trying Translate TTS fallback: ${ttsErr.message}`);
          // Fallback to translate TTS
          audioBuffer = await generateTranslateTTSFallback(scene.voiceoverText);
        }

        // Upload audio to S3
        const s3Key = `voice-video-gen/${videoId}/voice-${scene.sceneIndex}-${Date.now()}.mp3`;
        const audioUrl = await uploadBuffer(audioBuffer, s3Key, 'audio/mpeg');

        scene.audioUrl = audioUrl;
        await job.save();
      } catch (err) {
        throw new Error(`Voice generation failed for scene ${scene.sceneIndex}: ${err.message}`);
      }
    }

    // Step 4: Video Compilation using FFmpeg
    console.log(`[Worker] Step 4: Compiling video using FFmpeg...`);
    job.status = 'video_merging';
    await job.save();

    // Create a local temp directory for processing files (compatible with Vercel/serverless /tmp)
    tempJobDir = path.join(os.tmpdir(), `voice-video-job-${videoId}`);
    if (!fs.existsSync(tempJobDir)) {
      fs.mkdirSync(tempJobDir, { recursive: true });
    }

    const sceneVideoPaths = [];
    for (let i = 0; i < job.scenes.length; i++) {
      const scene = job.scenes[i];
      const localImagePath = path.join(tempJobDir, `scene-${scene.sceneIndex}-img.png`);
      const localAudioPath = path.join(tempJobDir, `scene-${scene.sceneIndex}-audio.mp3`);
      const localVideoPath = path.join(tempJobDir, `scene-${scene.sceneIndex}-video.mp4`);

      // Download S3 assets locally for processing
      console.log(`[Worker] Downloading scene ${scene.sceneIndex} assets...`);
      await downloadFile(scene.imageUrl, localImagePath);
      await downloadFile(scene.audioUrl, localAudioPath);

      // Get precise audio duration
      const audioDuration = await getAudioDuration(localAudioPath);
      scene.duration = Math.ceil(audioDuration);
      console.log(`[Worker] Scene ${scene.sceneIndex} precise audio duration: ${audioDuration}s`);

      // Render clip with pan effect
      console.log(`[Worker] Rendering scene ${scene.sceneIndex} video clip with pan effect...`);
      await renderSceneVideo(localImagePath, localAudioPath, localVideoPath, audioDuration, scene.sceneIndex, aspectRatio);
      sceneVideoPaths.push(localVideoPath);
    }

    // Concatenate all clips
    console.log(`[Worker] Concatenating scene videos...`);
    const finalVideoLocalPath = path.join(tempJobDir, 'final_output.mp4');
    await concatVideos(sceneVideoPaths, finalVideoLocalPath, tempJobDir);

    // Upload final video to S3
    console.log(`[Worker] Uploading final video to S3...`);
    const finalVideoBuffer = fs.readFileSync(finalVideoLocalPath);
    const finalS3Key = `voice-video-gen/${videoId}/final-video-${Date.now()}.mp4`;
    const finalVideoUrl = await uploadBuffer(finalVideoBuffer, finalS3Key, 'video/mp4');

    // Deduct user balance
    try {
      const user = await User.findById(userId);
      if (user) {
        // Charge 2 credits per scene
        const cost = job.scenes.length * 2;
        user.accountbalance = Math.max(0, user.accountbalance - cost);
        await user.save();
        console.log(`[Worker] Charged ${cost} credits to user balance. New balance: ${user.accountbalance}`);
      }
    } catch (balanceErr) {
      console.error("[Worker] Failed to deduct balance:", balanceErr.message);
    }

    // Save final status
    job.videoUrl = finalVideoUrl;
    job.status = 'completed';
    await job.save();
    console.log(`[Worker] Voice video generation completed successfully! S3 URL: ${finalVideoUrl}`);

  } catch (error) {
    console.error(`[Worker] Job failed: ${error.message}`);
    try {
      await VoiceVideo.findByIdAndUpdate(videoId, {
        status: 'failed',
        errorMessage: error.message
      });
    } catch (dbErr) {
      console.error("Failed to update failed state in DB:", dbErr.message);
    }
  } finally {
    // Clean up temporary local directory
    if (tempJobDir && fs.existsSync(tempJobDir)) {
      try {
        fs.rmSync(tempJobDir, { recursive: true, force: true });
        console.log(`[Worker] Cleaned up temporary files in: ${tempJobDir}`);
      } catch (rmErr) {
        console.error("Failed to delete temp dir:", rmErr.message);
      }
    }
  }
}

/**
 * Synthesizes audio using GCP Text-to-Speech API
 */
async function generateGoogleTTS(text, serviceAccountKeyPath, voiceName = 'en-US-Wavenet-D') {
  const auth = new GoogleAuth({
    keyFile: serviceAccountKeyPath,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;

  const languageCode = voiceName.substring(0, 5);

  const endpoint = 'https://texttospeech.googleapis.com/v1/text:synthesize';
  const response = await nodeFetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode, name: voiceName },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || response.statusText);
  }

  const data = await response.json();
  return Buffer.from(data.audioContent, 'base64');
}

/**
 * Fallback to Google Translate TTS API for free synthesizing
 */
async function generateTranslateTTSFallback(text) {
  const chunks = splitTextIntoChunks(text, 180);
  const buffers = [];
  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    const res = await nodeFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (!res.ok) throw new Error(`Translate TTS failed: ${res.statusText}`);
    buffers.push(await res.buffer());
  }
  return Buffer.concat(buffers);
}

function splitTextIntoChunks(text, maxLength) {
  const words = text.split(' ');
  const chunks = [];
  let currentChunk = '';
  for (const word of words) {
    if ((currentChunk + ' ' + word).length > maxLength) {
      chunks.push(currentChunk.trim());
      currentChunk = word;
    } else {
      currentChunk += ' ' + word;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

/**
 * Helper to download file from URL
 */
async function downloadFile(url, destPath) {
  const res = await nodeFetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.statusText}`);
  const fileStream = fs.createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on("error", reject);
    fileStream.on("finish", resolve);
  });
}

/**
 * Helper to parse exact audio duration using ffmpeg
 */
function getAudioDuration(audioPath) {
  return new Promise((resolve) => {
    ffmpeg(audioPath).ffprobe((err, data) => {
      if (err || !data || !data.format || !data.format.duration) {
        console.warn(`ffprobe failed to read duration, falling back to 10s:`, err?.message);
        resolve(10);
      } else {
        resolve(parseFloat(data.format.duration));
      }
    });
  });
}

/**
 * Compiles a single image + voiceover into a clip with a panning filter
 */
function renderSceneVideo(imagePath, audioPath, outputPath, duration, sceneIndex, aspectRatio = '16:9') {
  return new Promise((resolve, reject) => {
    const safeDuration = Math.max(1, duration);
    const isVertical = aspectRatio === '9:16';
    
    // Scale and Crop parameters for Pan Effect
    // Landscape: scale to 1472x828, crop to 1280x720 (1.15x larger)
    // Vertical: scale to 828x1472, crop to 720x1280 (1.15x larger)
    const outW = isVertical ? 720 : 1280;
    const outH = isVertical ? 1280 : 720;
    const scaleW = isVertical ? 828 : 1472;
    const scaleH = isVertical ? 1472 : 828;

    let filter = '';
    // Alternate pan direction based on sceneIndex
    if (sceneIndex % 4 === 0) {
      // Pan left to right
      filter = `scale=${scaleW}:${scaleH},crop=${outW}:${outH}:(iw-${outW})*(t/${safeDuration}):(ih-${outH})/2`;
    } else if (sceneIndex % 4 === 1) {
      // Pan right to left
      filter = `scale=${scaleW}:${scaleH},crop=${outW}:${outH}:(iw-${outW})*(1-t/${safeDuration}):(ih-${outH})/2`;
    } else if (sceneIndex % 4 === 2) {
      // Pan top to bottom
      filter = `scale=${scaleW}:${scaleH},crop=${outW}:${outH}:(iw-${outW})/2:(ih-${outH})*(t/${safeDuration})`;
    } else {
      // Pan bottom to top
      filter = `scale=${scaleW}:${scaleH},crop=${outW}:${outH}:(iw-${outW})/2:(ih-${outH})*(1-t/${safeDuration})`;
    }

    ffmpeg()
      .input(imagePath)
      .loop(safeDuration)
      .input(audioPath)
      .videoFilter(filter)
      .outputOptions([
        '-c:v libx264',
        '-tune stillimage',
        '-pix_fmt yuv420p',
        '-c:a aac',
        '-b:a 192k',
        '-shortest'
      ])
      .duration(safeDuration)
      .output(outputPath)
      .on('end', () => {
        resolve();
      })
      .on('error', (err) => {
        reject(err);
      })
      .run();
  });
}

/**
 * Concatenates list of video files using FFmpeg copy demuxer
 */
function concatVideos(videoPaths, outputPath, tempDir) {
  return new Promise((resolve, reject) => {
    const listFilePath = path.join(tempDir, 'list.txt');
    const fileContent = videoPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(listFilePath, fileContent);

    ffmpeg()
      .input(listFilePath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy'])
      .output(outputPath)
      .on('end', () => {
        resolve();
      })
      .on('error', (err) => {
        reject(err);
      })
      .run();
  });
}

/**
 * Get status of specific voice video generation job
 */
async function getVoiceVideoStatus(req, res) {
  try {
    const { videoId } = req.params;
    const voiceVideo = await VoiceVideo.findById(videoId);

    if (!voiceVideo) {
      return res.status(404).json({
        success: false,
        message: "Voice video job not found"
      });
    }

    // Calculate progress percentage
    let progress = 0;
    if (voiceVideo.status === 'completed') progress = 100;
    else if (voiceVideo.status === 'video_merging') progress = 90;
    else if (voiceVideo.status === 'voices_generating') {
      const voiceCount = voiceVideo.scenes.filter(s => s.audioUrl).length;
      const total = voiceVideo.scenes.length || 1;
      progress = 50 + Math.round((voiceCount / total) * 30); // 50% to 80%
    } else if (voiceVideo.status === 'images_generating') {
      const imgCount = voiceVideo.scenes.filter(s => s.imageUrl).length;
      const total = voiceVideo.scenes.length || 1;
      progress = 20 + Math.round((imgCount / total) * 30); // 20% to 50%
    } else if (voiceVideo.status === 'scenes_generated') {
      progress = 15;
    } else if (voiceVideo.status === 'pending') {
      progress = 5;
    }

    return res.status(200).json({
      success: true,
      data: {
        videoId: voiceVideo._id,
        status: voiceVideo.status,
        title: voiceVideo.title,
        prompt: voiceVideo.prompt,
        progress,
        scenes: voiceVideo.scenes,
        videoUrl: voiceVideo.videoUrl,
        errorMessage: voiceVideo.errorMessage,
        createdAt: voiceVideo.createdAt
      }
    });

  } catch (error) {
    console.error("Get voice video status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch status"
    });
  }
}

/**
 * Get history of user's voice video generation jobs
 */
async function getAllVoiceVideos(req, res) {
  try {
    const userId = req.user.id; // From authMiddleware

    const history = await VoiceVideo.find({ userId })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error("Get user voice videos error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve history"
    });
  }
}

module.exports = {
  generateVoiceVideo,
  getVoiceVideoStatus,
  getAllVoiceVideos
};
