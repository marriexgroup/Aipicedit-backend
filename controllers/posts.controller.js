const { default: mongoose } = require("mongoose");
const {  Posts } = require("../db");
const moment = require("moment");

// Controller for admin user management (placeholder)
function getScheduledPostsByUser(req, res) {
    const { userId } = req.params;
    if (!userId) {
        return res.status(400).json({
            error: "User ID is required."
        });
    }
    Posts.find({ createdBy: userId })
        .then(posts => {
            res.json({
                message: 'Scheduled Posts retrieved successfully.',
                generations: posts
            });
        })
        .catch(error => {
            console.error("Error retrieving Scheduled Posts:", error);
            res.status(500).json({
                error: "An error occurred while retrieving Scheduled Posts.",
                details: process.env.NODE_ENV === "development" ? error.message : undefined
            });
        });
}

async function createScheduledPosts(req, res) {
    try {
        const { userId } = req.params;
        const { pageId, posts } = req.body;

        // Validate inputs
        // if (!mongoose.Types.ObjectId.isValid(userId)) {
        //     return sendError(res, 400, 'Invalid user ID');
        // }

        // if (!mongoose.Types.ObjectId.isValid(pageId)) {
        //     return sendError(res, 400, 'Invalid page ID');
        // }

        if (!Array.isArray(posts) || posts.length === 0) {
            return res.status(500).json({
                error: "At least one post is required"
            });
        }

        // Validate each post
        const validatedPosts = posts.map(post => {
            if (!post.generationId || !post.imageUrl || !post.content || 
                !post.scheduleDate || !post.scheduleTime) {
                throw new Error('All post fields are required');
            }

            if (!mongoose.Types.ObjectId.isValid(post.generationId)) {
                throw new Error('Invalid generation ID');
            }

            if (!moment(post.scheduleDate, 'YYYY-MM-DD', true).isValid()) {
                throw new Error('Invalid schedule date format. Use YYYY-MM-DD');
            }

            if (!moment(post.scheduleTime, 'HH:mm', true).isValid()) {
                throw new Error('Invalid schedule time format. Use HH:mm');
            }

            // Combine date and time for easier querying
            const scheduledDateTime = new Date(post.scheduleDate);
            const [hours, minutes] = post.scheduleTime.split(':');
            scheduledDateTime.setHours(hours, minutes);

            return {
                ...post,
                scheduledDateTime,
                content: {
                    ...post.content,
                    _id: new mongoose.Types.ObjectId(post.content._id)
                }
            };
        });

        // Create scheduled posts
        const scheduledPosts = new Posts({
            page: pageId,
            posts: validatedPosts,
            createdBy: userId,
            status: 'scheduled'
        });

        await scheduledPosts.save();
return res.status(200).json({
                message: 'Posts scheduled successfully',
               
            });
         
    } catch (error) {
        console.error('Error scheduling posts:', error);
        return res.status(400).json({
                error: "Error scheduling posts"
            });
    }
}


module.exports = {
    getScheduledPostsByUser,
    createScheduledPosts
};