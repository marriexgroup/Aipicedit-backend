const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pageName: { type: String, required: true },
  facebookPageId: { type: String, required: true },
  pageUrl: { type: String, unique: true, required: true },
  profileImage: { type: String },
  coverImage: { type: String },
  accessToken: { type: String, required: true },
});

module.exports = mongoose.model('Page', pageSchema);
