const Veo2Client = require('./veo2-client');
const path = require('path');
const { Video, User } = require('../db');
const configsModel = require('../models/configs.model');

// Load environment variables (using dotenv if needed)
require('dotenv').config();

const serviceAccountKeyPath = path.resolve(__dirname, '../secrets/veo-service-account-key.json');

// Helper function to save errors to video model
async function saveVideoError(videoId, operationId, errorMessage) {
    try {
        await Video.findByIdAndUpdate(videoId, {
            $push: {
                errors: {
                    operationId: operationId || 'unknown',
                    message: errorMessage
                }
            }
        });
        console.log(`Error saved for video ${videoId}: ${errorMessage}`);
    } catch (error) {
        console.error('Failed to save video error:', error);
    }
}

async function generateLongVideo(req, res) {
    try {
        const { text_prompt,script_promt, totalDuration = 600, pageId, userId } = req.body;

        if (!text_prompt) {
            return res.status(400).json({ 
                success: false,
                message: "Missing 'text_prompt' in request body." 
            });
        }

        if (!userId) {
            return res.status(401).json({ 
                success: false,
                message: "User authentication required" 
            });
        }

        // Step 1: Check duration of request and identify how many parts we need to generate
        const totalParts = Math.ceil(totalDuration / 8); // 8 seconds per part
        const totalCost = totalParts * 10; // 10 credits per 8-second segment

        // Check user balance
        const user = await User.findById(userId);
        if (!user || user.accountbalance < totalCost) {
            return res.status(400).json({
                success: false,
                message: "Insufficient account balance for this generation",
                required: totalCost,
                available: user?.accountbalance || 0
            });
        }

        const video = new Video({
            operationIds: [],
            videoUrls: [],
            userId,
            numberOfVideos: totalParts,
            status: 'processing'
        });
        await video.save();

        // Step 2: Send user response that generation starts with part count and current processing video part number
        res.status(202).json({
            success: true,
            message: "Long video generation started",
            data: {
                status: "processing",
                videoId: video._id,
                totalParts,
                currentPart: 1,
                totalDuration,
                estimatedCost: totalCost,
                statusCheckUrl: `/api/longvideo/status/${userId}`
            }
        });

        // Step 3: Start background processing
        processLongVideoGeneration(text_prompt,script_promt, totalParts, userId, video._id);

    } catch (error) {
        console.error("Long video generation error:", error);
        
        // Save error to video model if video was created
        if (req.body.userId) {
            try {
                const video = await Video.findOne({ userId: req.body.userId, status: 'processing' });
                if (video) {
                    await saveVideoError(video._id, 'initialization', `Failed to start long video generation: ${error.message}`);
                }
            } catch (saveError) {
                console.error("Failed to save initialization error:", saveError);
            }
        }
        
        return res.status(500).json({
            success: false,
            message: "Failed to start long video generation",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

async function processLongVideoGeneration(text_prompt,script_promt, totalParts, userId, videoId) {
    try {
        // Step 3: In first part start generation, create new Video object and do not use LongVideoGeneration model
        

        const veoClient = new Veo2Client(serviceAccountKeyPath);
        const video = await Video.findOne({ _id: videoId});
        // Process each part sequentially
        for (let i = 0; i < totalParts; i++) {
            try {
                console.log(`Processing part ${i + 1} of ${totalParts}`);
                let new_prompt = '';
                if (totalParts > 1) {
                    new_prompt = `This is chunk ${i + 1} of a ${totalParts} chunk video. Visual Reference Sheet For Whole video : ${text_prompt}, Scene Sheets ${script_promt}`;
                }

                // Generate video for this part using the complete prompt from frontend
                const result = await veoClient.generateVideoFromText(new_prompt, {
                    sampleCount: 1,
                    storageUri: "gs://veo8784654/output/",
                    parameters: {
                        durationSeconds: 8,
                        aspectRatio: "16:9"
                    }
                });

                if (result.error) {
                    await saveVideoError(videoId, `part_${i + 1}`, `Video generation failed for part ${i + 1}: ${result.error}`);
                    throw new Error(result.error);
                }

                if (result.name) {
                    // Step 4: Save operation ID in operationIds array and numberOfVideos, status need to update
                    video.operationIds.push(result.name);
                    video.numberOfVideos = totalParts;
                    video.status = 'processing';
                    await video.save();
                    console.log(`Started generation for part ${i + 1}, operation ID: ${result.name}`);

                    // Wait for this part to complete
                    const videoUrl = await waitForVideoCompletion(result.name, veoClient, videoId);
                    
                    if (videoUrl) {
                        // Step 5: When first part complete, add video url to videoUrls array and start second part generation
                        video.videoUrls.push(videoUrl);
                        await video.save();

                        const configs = await configsModel.findOne({});

                        if (configs && configs.pricingConfigs) {
                            await User.findByIdAndUpdate(userId, {
                                $inc: {
                                    accountbalance: -(8 * configs.pricingConfigs.videoCostPerSecond),
                                    usedStorange: +10
                                }
                            }, { new: true });
                        }

                        // Update user balance for this part
                        await User.findByIdAndUpdate(userId, {
                            $inc: {
                                accountbalance: -10,
                                usedStorange: +10
                            }
                        });
                    }
                }

                // Add delay between requests (1 minute as per rate limit)
                if (i < totalParts - 1) {
                    await new Promise(resolve => setTimeout(resolve, 60000)); // 60 seconds
                }

            } catch (error) {
                console.error(`Error processing part ${i + 1}:`, error);
                await saveVideoError(videoId, `part_${i + 1}`, `Error processing part ${i + 1}: ${error.message}`);
                // Continue with next part even if one fails
            }
        }

        // Step 6: All parts done, status change to completed
        if (video.videoUrls.length === totalParts) {
            video.status = 'completed';
        } else {
            video.status = 'failed';
        }
        await video.save();

    } catch (error) {
        console.error("Error in long video generation process:", error);
        // Update video status to failed if it exists
        try {
            const video = await Video.findOne({ userId, status: 'processing' });
            if (video) {
                video.status = 'failed';
                await video.save();
                await saveVideoError(video._id, 'process_generation', `Long video generation process failed: ${error.message}`);
            }
        } catch (updateError) {
            console.error("Error updating video status:", updateError);
        }
    }
}

async function waitForVideoCompletion(operationId, veoClient, videoId) {
    const maxAttempts = 30; // 30 minutes max wait time
    let attempts = 0;

    // Extract just the operation ID from the full path if it's a full path
    let actualOperationId = operationId;
    if (operationId.includes('/operations/')) {
        actualOperationId = operationId.split('/operations/').pop();
    }

    console.log(`Waiting for video completion. Original ID: ${operationId}, Extracted ID: ${actualOperationId}`);

    while (attempts < maxAttempts) {
        try {
            // Since we're using aspectRatio: "16:9", we should use 'veo-3.0-generate-preview'
            const status = await veoClient.checkOperationStatus(actualOperationId, 'veo-3.0-generate-preview');
            console.log(`res:>>>`, status);
            
            if (status.done) {
                if (status.response && status.response.videos && status.response.videos[0]) {
                    console.log(`Video completed successfully for operation ${actualOperationId}`);
                    return status.response.videos[0].gcsUri.replace('gs://', 'https://storage.googleapis.com/');
                } else {
                    console.error('No video URL in response');
                    return null;
                }
            }

            console.log(`Video still processing for operation ${actualOperationId}, attempt ${attempts + 1}/${maxAttempts}`);
            // Wait 1 minute before checking again
            await new Promise(resolve => setTimeout(resolve, 60000));
            attempts++;

        } catch (error) {
            console.error(`Error checking status for operation ${actualOperationId}:`, error);
            if (videoId) {
                await saveVideoError(videoId, actualOperationId, `Error checking video status: ${error.message}`);
            }
            return null;
        }
    }

    console.error(`Timeout waiting for video completion for operation ${actualOperationId}`);
    if (videoId) {
        await saveVideoError(videoId, actualOperationId, `Timeout waiting for video completion after ${maxAttempts} attempts`);
    }
    return null;
}

// Step 7: In status checking you can look Video object and send response with Video object details
async function getLongVideoStatus(req, res) {
    try {
        const { videoId,userId } = req.params;

        const video = await Video.findOne({ _id: videoId });

        if (!video) {
            return res.status(404).json({
                success: false,
                message: "No video generation found for this user"
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                userId: userId,
                videoId: video._id,
                status: video.status,
                totalParts: video.numberOfVideos,
                completedParts: video.videoUrls.length,
                operationIds: video.operationIds,
                videoUrls: video.videoUrls,
                progress: video.numberOfVideos > 0 ? (video.videoUrls.length / video.numberOfVideos) * 100 : 0,
                errors: video.errors || [],
                createdAt: video.createdAt,
                updatedAt: video.updatedAt
            }
        });

    } catch (error) {
        console.error("Error getting long video status:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get long video status"
        });
    }
}

async function getLongVideoUrls(req, res) {
    try {
        const { userId, videoId } = req.params;

        const video = await Video.findOne({ userId, _id: videoId });

        if (!video) {
            return res.status(404).json({
                success: false,
                message: "No video generation found for this user"
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                videoId: video._id,
                status: video.status,
                totalParts: video.numberOfVideos,
                completedParts: video.videoUrls.length,
                videoUrls: video.videoUrls,
                progress: video.numberOfVideos > 0 ? (video.videoUrls.length / video.numberOfVideos) * 100 : 0
            }
        });

    } catch (error) {
        console.error("Error getting long video URLs:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get long video URLs"
        });
    }
}

async function cancelLongVideo(req, res) {
    try {
        const { userId, videoId } = req.params;

        const video = await Video.findOneAndUpdate(
            {
                userId,
                _id: videoId,
                status: { $in: ['processing'] }
            },
            {
                status: 'cancelled'
            },
            { new: true }
        );

        if (!video) {
            return res.status(404).json({
                success: false,
                message: "No active video generation found for this user"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Long video generation cancelled",
            data: {
                videoId: video._id,
                status: video.status
            }
        });

    } catch (error) {
        console.error("Error cancelling long video:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to cancel long video generation"
        });
    }
}

async function getAllVideos(req, res) {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required"
            });
        }

        // Get all videos for the user, sorted by creation date (newest first)
        const videos = await Video.find({ userId })
            .sort({ createdAt: -1 })
            .select('_id videoUrls status numberOfVideos createdAt updatedAt');

        // Transform the data to match the expected format
        const transformedVideos = videos.map(video => ({
            _id: video._id,
            videoUrls: video.videoUrls,
            status: video.status,
            totalParts: video.numberOfVideos,
            completedParts: video.videoUrls.length,
            progress: video.numberOfVideos > 0 ? (video.videoUrls.length / video.numberOfVideos) * 100 : 0,
            createdAt: video.createdAt,
            updatedAt: video.updatedAt,
            videoType: "16:9", // Long videos are always 16:9
            pageName: "Long Video Generation", // Default page name for long videos
            isLongVideo: true // Flag to identify long videos
        }));

        return res.status(200).json({
            success: true,
            data: {
                videos: transformedVideos,
                total: transformedVideos.length
            }
        });

    } catch (error) {
        console.error("Error getting all videos:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get videos"
        });
    }
}

module.exports = { 
    generateLongVideo, 
    getLongVideoStatus, 
    getLongVideoUrls, 
    cancelLongVideo,
    getAllVideos
};
