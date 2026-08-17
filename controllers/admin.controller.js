const { User, Generation, Page, Posts, VoiceVideo } = require('../db');
const s3Service = require('../services/s3.service');

// Controller for admin dashboard
function getDashboard(req, res) {
  // req.user is populated by authenticateToken middleware
  res.json({
    message: 'Welcome to the Admin Dashboard!',
    user: {
      id: req.user.userId,
      username: req.user.username,
      role: req.user.role
    }
  });
}

async function getUsers(req, res) {
  try {
    const users = await User.find({ role: 'user' }, { password: 0 }).lean();
    res.json({
      success: true,
      users
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
}

async function getAllPages(req, res) {
  try {
    // Return all pages across all users so admins have full visibility
    const pages = await Page.find({})
      .populate('user', 'username')
      .populate('assignedUsers', 'username')
      .lean();
    res.json({
      success: true,
      pages
    });
  } catch (err) {
    console.error('Error fetching pages:', err);
    res.status(500).json({ message: 'Failed to fetch pages' });
  }
}

async function assignPage(req, res) {
  try {
    const { pageId } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      return res.status(400).json({ message: 'userIds must be an array' });
    }

    const updatedPage = await Page.findByIdAndUpdate(
      pageId,
      { $set: { assignedUsers: userIds } },
      { new: true }
    );

    if (!updatedPage) {
      return res.status(404).json({ message: 'Page not found' });
    }

    res.json({
      success: true,
      page: updatedPage
    });
  } catch (err) {
    console.error('Error assigning page:', err);
    res.status(500).json({ message: 'Failed to assign page' });
  }
}

async function getAssignedPosts(req, res) {
  try {
    // Fetch ALL pages across all users so admin sees every post in the system
    const pages = await Page.find({}).lean();

    if (pages.length === 0) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }

    const pagesMap = new Map(pages.map(p => [String(p._id), p]));
    const allPageIds = Array.from(pagesMap.keys());

    // Fetch ALL posts across all pages
    const posts = await Posts.find({ page: { $in: allPageIds } }).lean();
    const userIds = [...new Set(posts.map(p => String(p.createdBy)))].filter(Boolean);

    const users = await User.find({ _id: { $in: userIds } }, { password: 0 }).lean();
    const usersMap = new Map(users.map(u => [String(u._id), u]));

    const result = posts.map(post => {
      const pageInfo = pagesMap.get(String(post.page));
      const userInfo = usersMap.get(String(post.createdBy));
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

    // Only return posts whose page was found in the DB
    const filteredResult = result.filter(r => r.pageDetails);

    res.json({
      success: true,
      count: filteredResult.length,
      data: filteredResult
    });
  } catch (err) {
    console.error('Error fetching assigned posts:', err);
    res.status(500).json({ message: 'Failed to fetch assigned posts' });
  }
}

async function getAllUsersDetailsPublic(req, res) {
  try {
    const users = await User.find({}, { password: 0 }).lean();

    const userIds = users.map(u => u._id);

    const [generationCountsAgg, pages] = await Promise.all([
      Generation.aggregate([
        { $match: { user: { $in: userIds } } },
        { $group: { _id: '$user', count: { $sum: 1 } } }
      ]),
      Page.find({ user: { $in: userIds } }, { accessToken: 0 }).lean()
    ]);

    const generationCountByUserId = new Map();
    for (const row of generationCountsAgg) {
      generationCountByUserId.set(String(row._id), row.count);
    }

    const pagesByUserId = new Map();
    for (const pg of pages) {
      const key = String(pg.user);
      if (!pagesByUserId.has(key)) pagesByUserId.set(key, []);
      pagesByUserId.get(key).push(pg);
    }

    const result = users.map(u => ({
      user: u,
      generationsCount: generationCountByUserId.get(String(u._id)) || 0,
      pages: pagesByUserId.get(String(u._id)) || []
    }));

    res.json({
      count: result.length,
      data: result
    });
  } catch (err) {
    console.error('Error fetching users details:', err);
    res.status(500).json({ message: 'Failed to fetch users details' });
  }
}

async function updateUserBalance(req, res) {
  try {
    const { userId } = req.params;
    const { balance } = req.body;

    if (balance === undefined || typeof balance !== 'number') {
      return res.status(400).json({ message: 'balance is required and must be a number' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.accountbalance = balance;
    if (balance > 0) {
      user.accounttype = 'paid';
    }
    await user.save();

    res.json({
      success: true,
      message: 'User balance updated successfully',
      user: {
        _id: user._id,
        username: user.username,
        accountbalance: user.accountbalance,
        accounttype: user.accounttype
      }
    });
  } catch (err) {
    console.error('Error updating user balance:', err);
    res.status(500).json({ message: 'Failed to update user balance' });
  }
}

async function getAdminVoiceVideos(req, res) {
  try {
    const { userId, page = 1, limit = 10, rangeType, startDate, endDate } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing 'userId' query parameter"
      });
    }

    const query = {
      userId,
      status: 'completed'
    };

    if (rangeType) {
      let start, end;
      const now = new Date();
      
      if (rangeType === 'today') {
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
      } else if (rangeType === 'week') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(now.setDate(diff));
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
      } else if (rangeType === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
      } else if (rangeType === 'custom') {
        if (startDate) {
          start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
        }
        if (endDate) {
          end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
        }
      }
      
      if (start || end) {
        query.createdAt = {};
        if (start) query.createdAt.$gte = start;
        if (end) query.createdAt.$lte = end;
      }
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const total = await VoiceVideo.countDocuments(query);
    const videos = await VoiceVideo.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.json({
      success: true,
      data: videos,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (err) {
    console.error('Error fetching admin voice videos:', err);
    res.status(500).json({ message: 'Failed to fetch voice videos' });
  }
}

async function clearS3Bucket(req, res) {
  try {
    const result = await s3Service.clearBucket();
    res.json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} files from S3 bucket.`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('Error clearing S3 bucket:', err);
    res.status(500).json({ message: err.message || 'Failed to clear S3 bucket' });
  }
}

module.exports = {
  getDashboard,
  getUsers,
  getAllPages,
  assignPage,
  getAssignedPosts,
  getAllUsersDetailsPublic,
  updateUserBalance,
  getAdminVoiceVideos,
  clearS3Bucket,
};

