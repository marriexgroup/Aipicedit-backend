const mongoose = require('mongoose');
require('dotenv').config(); // To load environment variables from .env file

const User = require('./models/user.model');
const Role = require('./models/role.model');
const Generation = require('./models/generaion.model');
const Page = require('./models/page.model.js');
const Posts = require('./models/post.model');
const Video = require('./models/video.model');
const LongVideoGeneration = require('./models/longVideoGeneration.model');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Successfully connected to MongoDB.');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1); // Exit process with failure
  }
};

module.exports = {
  connectDB,
  mongooseConnection: mongoose.connection,
  User,
  Role,
  Generation,
  Posts,
  Page,
  Video,
  LongVideoGeneration
};
