const { User, Generation, Page, Posts } = require('../db');

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

module.exports = {
  getDashboard,
  getUsers,
  getAllPages,
  assignPage,
  getAssignedPosts,
  getAllUsersDetailsPublic,
};
