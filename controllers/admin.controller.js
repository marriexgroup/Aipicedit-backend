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

// Controller for admin user management (placeholder)
function getUsers(req, res) {
  // req.user is populated by authenticateToken middleware
  // In a real app, you'd fetch and return user data here
  res.json({
    message: 'Admin User Management page.',
    user: {
      id: req.user.userId,
      username: req.user.username,
      role: req.user.role
    },
    users: [] // Placeholder for user list
  });
}

const { User, Generation, Page } = require('../db');

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
  getAllUsersDetailsPublic,
};
