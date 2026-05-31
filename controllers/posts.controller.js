const { default: mongoose } = require("mongoose");
const { Posts, User } = require("../db");
const moment = require("moment");
const Page = require('../models/page.model');
const { uploadImage } = require('../services/s3.service');
const fetch = require('node-fetch');

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

        const pageDoc = await Page.findById(pageId);
        if (!pageDoc) {
            return res.status(404).json({ error: "Page not found" });
        }

        // Validate each post
        const validatedPosts = await Promise.all(posts.map(async post => {
            if (!post.imageUrl || !post.content) {
                throw new Error('imageUrl and content are required for each post');
            }

            // ── Timezone-safe datetime resolution ──────────────────────────────
            // Primary path: frontend sends a full ISO 8601 UTC string (scheduledAt).
            // Fallback: legacy separate date + time strings (timezone-imprecise, kept
            // for backward compatibility with any older clients).
            let scheduledDateTime;

            if (post.scheduledAt) {
                scheduledDateTime = new Date(post.scheduledAt);
                if (isNaN(scheduledDateTime.getTime())) {
                    throw new Error(`Invalid scheduledAt value: ${post.scheduledAt}`);
                }
            } else if (post.scheduleDate && post.scheduleTime) {
                // Legacy path — assumes times are in UTC (warn in logs)
                console.warn('[posts.controller] Using legacy scheduleDate+scheduleTime — timezone may be imprecise. Send scheduledAt instead.');

                if (!moment(post.scheduleDate, 'YYYY-MM-DD', true).isValid()) {
                    throw new Error('Invalid schedule date format. Use YYYY-MM-DD');
                }
                if (!moment(post.scheduleTime, 'HH:mm', true).isValid()) {
                    throw new Error('Invalid schedule time format. Use HH:mm');
                }

                const [hours, minutes] = post.scheduleTime.split(':').map(Number);
                scheduledDateTime = new Date(post.scheduleDate);
                // setUTCHours treats the time as UTC, avoiding server-local-time drift
                scheduledDateTime.setUTCHours(hours, minutes, 0, 0);
            } else {
                throw new Error('Each post requires either scheduledAt (ISO string) or both scheduleDate and scheduleTime');
            }

            if (post.generationId && !mongoose.Types.ObjectId.isValid(post.generationId)) {
                throw new Error('Invalid generation ID');
            }

            // Derive legacy storage fields from the authoritative UTC timestamp
            const pad = (n) => String(n).padStart(2, '0');
            const utcDateString = `${scheduledDateTime.getUTCFullYear()}-${pad(scheduledDateTime.getUTCMonth() + 1)}-${pad(scheduledDateTime.getUTCDate())}`;
            const utcTimeString = `${pad(scheduledDateTime.getUTCHours())}:${pad(scheduledDateTime.getUTCMinutes())}`;

            // Validate against Facebook Graph API time constraints
            const unixTimestamp = Math.floor(scheduledDateTime.getTime() / 1000);
            const nowTimestamp = Math.floor(Date.now() / 1000);
            if (unixTimestamp < nowTimestamp + 600) {
                throw new Error('Scheduled time must be at least 10 minutes from now for Facebook Graph API.');
            }
            if (unixTimestamp > nowTimestamp + (75 * 24 * 3600)) {
                throw new Error('Scheduled time cannot be more than 75 days from now for Facebook Graph API.');
            }

            let finalImageUrl = post.imageUrl;
            let fbEndpoint = `https://graph.facebook.com/v21.0/${pageDoc.facebookPageId}/photos`;
            let fbPayload = {
                message: post.content.text || '',
                published: false,
                scheduled_publish_time: unixTimestamp,
                access_token: pageDoc.accessToken
            };

            if (finalImageUrl && finalImageUrl.startsWith('data:image')) {
                const uploadResult = await uploadImage(finalImageUrl);
                finalImageUrl = uploadResult.Location;
                fbPayload.url = finalImageUrl;
            } else if (!finalImageUrl || finalImageUrl.includes('placehold.co')) {
                // Text only post
                fbEndpoint = `https://graph.facebook.com/v21.0/${pageDoc.facebookPageId}/feed`;
            } else {
                // Pre-existing valid URL
                fbPayload.url = finalImageUrl;
            }

            const fbResponse = await fetch(fbEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fbPayload)
            });

            const fbData = await fbResponse.json();
            if (fbData.error) {
                console.error("Facebook API Full Error:", JSON.stringify(fbData.error, null, 2));
                throw new Error(`Facebook API Error: ${fbData.error.message} - Details: ${JSON.stringify(fbData.error)}`);
            }

            return {
                ...post,
                imageUrl: finalImageUrl,
                // Canonical UTC timestamp
                scheduledAt: scheduledDateTime,
                scheduledDateTime,
                // Legacy UTC-derived fields for display/compat
                scheduleDate: utcDateString,
                scheduleTime: utcTimeString,
                timezone: post.timezone || 'UTC',
                content: {
                    ...post.content,
                    _id: new mongoose.Types.ObjectId(post.content._id)
                }
            };
        }));

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


// Get all posts visible to a regular user:
// 1. Posts they created themselves
// 2. Posts on pages where they are in assignedUsers
async function getUserPosts(req, res) {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required." });
        }

        // Find pages assigned to this user
        const assignedPages = await Page.find({ assignedUsers: userId }).lean();
        const assignedPageIds = assignedPages.map(p => String(p._id));

        // Find own pages (pages created by this user)
        const ownPages = await Page.find({ user: userId }).lean();
        const ownPageIds = ownPages.map(p => String(p._id));

        // Combine all relevant page IDs (assigned + own)
        const allRelevantPageIds = [...new Set([...assignedPageIds, ...ownPageIds])];

        // Build all pages map for lookup
        const allPages = [...assignedPages, ...ownPages];
        const pagesMap = new Map();
        allPages.forEach(p => pagesMap.set(String(p._id), p));

        // Fetch posts: created by user OR on relevant pages
        const posts = await Posts.find({
            $or: [
                { createdBy: userId },
                { page: { $in: allRelevantPageIds } }
            ]
        }).lean();

        // Fetch all involved user ids
        const userIds = [...new Set(posts.map(p => String(p.createdBy)).filter(Boolean))];
        const users = await User.find({ _id: { $in: userIds } }, { password: 0 }).lean();
        const usersMap = new Map(users.map(u => [String(u._id), u]));

        const result = posts.map(post => {
            const pageInfo = pagesMap.get(String(post.page)) || null;
            const userInfo = usersMap.get(String(post.createdBy)) || null;
            return {
                ...post,
                pageDetails: pageInfo ? {
                    _id: pageInfo._id,
                    pageName: pageInfo.pageName,
                    profileImage: pageInfo.profileImage,
                    facebookPageId: pageInfo.facebookPageId,
                } : null,
                userDetails: userInfo ? {
                    _id: userInfo._id,
                    username: userInfo.username,
                } : null,
            };
        });

        res.json({
            success: true,
            count: result.length,
            data: result
        });
    } catch (err) {
        console.error('Error fetching user posts:', err);
        res.status(500).json({ message: 'Failed to fetch user posts' });
    }
}


module.exports = {
    getScheduledPostsByUser,
    createScheduledPosts,
    getUserPosts,
};