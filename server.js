const express = require('express');
const authMiddleware = require('./auth.middleware');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes'); // Import admin routes
const publicRoutes = require('./routes/public.routes'); // Import public routes
const imageRoutes = require('./routes/image.routes'); // Import image routes
const generationRoutes = require('./routes/gneration.routes'); // Import generation routes
const generationConfigRoutes = require('./routes/generationConfig.routes'); // Import generation config routes
const postsRoutes = require('./routes/posts.routes');
const pageRoutes = require('./routes/page.routes');
const videoRoutes = require('./routes/video.routes'); // Import video routes
const longvideoRoutes = require('./routes/longvideo.routes'); // Import long video routes
const paypalRoutes = require('./routes/paypal.routes'); // Import PayPal routes
const configsRoutes = require('./routes/configs.routes');
const aiAssistantRoutes = require('./routes/aiAssistant.routes');

const app = express();
const port = process.env.PORT || 3000;

const cors = require('cors');
const { default: mongoose } = require('mongoose');

app.use(express.json()); // Middleware to parse JSON bodies

// CORS Configuration
const corsOptions = {
  origin: ['http://localhost:3000', 'https://postgen-new.vercel.app', 'https://www.aipicedit.com', 'https://aipicedit-frontend.vercel.app'],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(corsOptions));

// Mount Public routes (typically at root or a common prefix)
app.use('/', publicRoutes); // Mount public routes at root
// Mount Auth routes
app.use('/api/auth', authRoutes);
// Mount User routes
app.use('/api/user', userRoutes);
// Mount Admin routes
app.use('/api/admin', adminRoutes); // Prefixing with /api/admin
// Mount Image routes
app.use('/api/image', imageRoutes);
app.use('/api/generation', generationRoutes);
app.use('/api/generation-config', generationConfigRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/page', pageRoutes);
// Mount Video routes
app.use('/api/video', videoRoutes);
// Mount Long Video routes
app.use('/api/longvideo', longvideoRoutes);
// Mount PayPal routes
app.use('/api/paypal', paypalRoutes);
app.use('/api/configs', configsRoutes);
app.use('/api/ai-assistant', aiAssistantRoutes);


// Global error handler (optional, but good practice)
app.use((err, req, res, next) => {
  console.error("Global error handler:", err.message);
  // Check if the error is one we recognize and want to send a specific response for
  if (err.code === 'USERNAME_EXISTS') { // Custom error code from auth.service
    return res.status(409).json({ message: err.message });
  }
  // For other errors, send a generic 500 response
  // Avoid sending stack traces or sensitive error details to the client in production
  res.status(err.status || 500).json({ message: 'Internal Server Error' });
});

// ✅ Database Connection
mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Connected to database!");
    app.listen(process.env.PORT || 9001, () =>
      console.log(`Server is running on port ${process.env.PORT || 9001}`)
    );
  })
  .catch((err) => {
    console.error("Database connection failed!", err);
    process.exit(1);
  });