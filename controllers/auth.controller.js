const { User } = require('../db');
const authService = require('../services/auth.service'); // We'll create this service soon

// Controller function for user registration
async function register(req, res, next) {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const { user, token } = await authService.registerUser(username, password, role);
    // Send back the full user object and the token.
    res.status(201).json({ message: 'User registered successfully', user: user, token: token });
  } catch (error) {
    // The error handling for 'USERNAME_EXISTS' (or MySQL 'ER_DUP_ENTRY') is now more generic in the service
    // and re-throws a custom error. The global error handler in server.js or test setup handles it.
    // So, no specific check for error.code === '23505' or error.constraint needed here.
    // The service layer error (e.g., "Username already exists.") will be passed to 'next(error)'
    // and handled by the error middleware, which should respond with 409.
    // If the error is "Role '...' not found", it will also be passed to next(error)
    // and handled by the error middleware, which should respond with 400.
    if (error.message.toLowerCase().includes('username already exists') || (error.code === 'USERNAME_EXISTS')) {
      return res.status(409).json({ message: error.message || 'Username already exists.' });
    }
    console.error('Registration controller error:', error);
    next(error); // Pass to global error handler
  }
}

// Controller function for user login
async function login(req, res, next) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const result = await authService.loginUser(username, password);
    if (result) {
      res.json({ message: 'Login successful', user: result.user, token: result.token });
    } else {
      // Use a generic message to avoid revealing whether username exists
      res.status(401).json({ message: 'Invalid credentials.' });
    }
  } catch (error) {
    console.error('Login controller error:', error);
    next(error); // Pass to global error handler
  }
}

const getAuthUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required in parameters." });
    }
    const user = await User.find({ _id: userId });
    const userToReturn = {
      id: user[0]._id,
      username: user[0].username,
      role: user[0].roleName,
      accounttype: user[0].accounttype,
      regdate: user[0].regdate,
      accountbalance: user[0].accountbalance,
      usedStorange:user[0].usedStorange,
      availableStorange:user[0].availableStorange,
      timezone: user[0].timezone || 'UTC'
    };
    res.status(200).json({ data: userToReturn });
  } catch (error) {
    res.status(500).json({ message: "Error fetching pages: " + error.message });
  }
};

module.exports = {
  register,
  login,
  getAuthUser
};
