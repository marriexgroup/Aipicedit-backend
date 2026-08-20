const { Generation } = require("../db");
const AWS = require('aws-sdk');

// Controller for admin user management (placeholder)
async function getGenerations(req, res) {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const type = req.query.type;

    if (!userId) {
        return res.status(400).json({
            error: "User ID is required."
        });
    }

    try {
        let query = { user: userId };
        if (type === 'video') {
            query.isVideo = true;
        } else if (type === 'image') {
            query.isVideo = { $ne: true };
        }

        const total = await Generation.countDocuments(query);
        const generations = await Generation.find(query)
            .sort({ generationDate: -1 })
            .skip(skip)
            .limit(limit)
            .populate('pageId');

        res.json({
            message: 'Generations retrieved successfully.',
            generations: generations,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Error retrieving generations:", error);
        res.status(500).json({
            error: "An error occurred while retrieving generations.",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
}

// Configure AWS (you might want to do this elsewhere in your app)
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});


const s3 = new AWS.S3();

async function removeAllGenerationsByUser(req, res) {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ error: "User ID is required." });
    }

    try {
        // Find all generations for the user
        const allGenerations = await Generation.find({ user: userId });
        let allImageUrls = [];
        
        // Collect all image URLs
        allGenerations.forEach(generation => {
            if (generation.images?.length > 0) {
                allImageUrls.push(...generation.images);
            }
        });

        if (allImageUrls.length === 0) {
            return res.status(404).json({ message: "No images found for this user." });
        }

        console.log(`Found ${allImageUrls.length} images to delete for user ${userId}`);
        
        // Delete all images from S3
        const deletePromises = allImageUrls.map(url => {
            const key ='generated-images/'+ url.split('/').pop(); // Assuming URL contains the S3 key at the end
            console.log(key);
            
            return s3.deleteObject({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: key
            }).promise();
        });

        await Promise.all(deletePromises);

        
        await Generation.deleteMany({ user: userId });

        return res.status(200).json({ message: `Successfully deleted ${allImageUrls.length} images.` });

    } catch (error) {
        console.error("Error in removeAllGenerationsByUser:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

module.exports = {
    getGenerations,
    removeAllGenerationsByUser
};