const Veo2Client = require('./veo2-client');
const path = require('path');
const { GoogleGenAI } = require("@google/genai");
const { Generation, User } = require('../db');
const configsModel = require('../models/configs.model');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Load environment variables (using dotenv if needed)
require('dotenv').config();

const serviceAccountKeyPath = path.resolve(__dirname, '../secrets/veo-service-account-key.json');

async function generateVideo(req, res) {
    try {
        const { text_prompt, options, auto,userId } = req.body;

        if (!text_prompt) {
            return res.status(400).json({ error: "Missing 'text_prompt' in request body." });
        }
        const modifiedPrompt = `Act as a Vertex AI Veo 3 prompt engineer. Generate video prompt based on the user's input. For prompt:
        1. Include these REQUIRED elements:
            - Subject (primary focus)
            - Context (setting/background)
            - Action (dynamic movement)
            - Style (e.g., cinematic, cyberpunk, anime)
            - Camera/Composition (e.g., "close-up", "drone shot")
            - Ambiance (lighting/mood)
            - Negative Prompt (exclusions, e.g., "no modern buildings")

        2. Format rules:
           - Prioritize vivid, specific descriptors
           - Avoid instructional language ("should include")

        3. Example output format: TEXT
        Now generate promt for: '${text_prompt}'`;

        var textResponse = { text: text_prompt };
        if (auto) {
            textResponse = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: modifiedPrompt,
            });
        }
        console.log('GoogleGenAI generation success ✅', textResponse.text);

        const veoClient = new Veo2Client(serviceAccountKeyPath);
        const result = await veoClient.generateVideoFromText(auto ? textResponse.text : text_prompt, options || {});

        if (result.error) {
            return res.status(502).json({
                error: "Veo API request failed",
                details: result.error,
            });
        }

        if (result.name) { // Async operation
            console.log("Video generation started, operation ID:", result);
            const configs = await configsModel.findOne({});

            if (configs && configs.pricingConfigs) {
                await User.findByIdAndUpdate(userId, {
                    $inc: {
                        accountbalance: -(options.parameters.durationSeconds*configs.pricingConfigs.videoCostPerSecond),
                        usedStorange: +10
                    }
                }, { new: true });
            }
            
            return res.status(202).json({
                status: "processing",
                operation_id: result.name,
                message: "Video generation in progress. Check status later.",
                status_check_url: `/api/video/status/${result.name}`,
            });
        }

        // If video is generated immediately
        return res.status(200).json({
            status: "success",
            video_url: result.videoUri || result.downloadUri,
            metadata: result.metadata,
        });

    } catch (error) {
        console.error("Video generation error:", error);
        return res.status(500).json({
            error: "Internal server error",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
}

function extractAndParseArray(text) {
    const match = text.match(/\[.*\]/s); // match array inside [...]
    if (!match) {
        throw new Error("No array found in the text");
    }

    try {
        const array = JSON.parse(match[0]);
        return array;
    } catch (err) {
        throw new Error("Invalid JSON format: " + err.message);
    }
}

async function checkVideoStatus(req, res) {
    try {
        const { operationId, type,userId ,pageId} = req.params;

        const veoClient = new Veo2Client(serviceAccountKeyPath);
        const status = await veoClient.checkOperationStatus(operationId, type == '16:9' ? 'veo-3.0-generate-preview' : 'veo-2.0-generate-001');
        console.log("Checking video status for operation ID:", operationId, "Status:", status);

        if (status.done == true) {
            await Generation.create({
                content: [{
                    fact: "no data",
                    description: "no data",
                    highlights: ["no data"],
                }],
                user: userId,
                cost: 10,
                pageName:"no data",
                pageId: pageId,
                isVideo: true,
                videoUrl: status.response.videos[0].gcsUri.replace('gs://', 'https://storage.googleapis.com/'),
                videoType: type,
            });

            status.publicUrl = status.response.videos[0].gcsUri.replace('gs://', 'https://storage.googleapis.com/');
        }

        return res.status(200).json(status);
    } catch (error) {
        console.error("Status check error:", error);
        return res.status(500).json({ error: "Failed to check video status" });
    }
}

module.exports = { generateVideo, checkVideoStatus };