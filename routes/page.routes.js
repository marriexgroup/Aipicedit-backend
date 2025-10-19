const express = require('express');
const router = express.Router();
const multer = require('multer');
const pageController = require('../controllers/page.controller.js');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 960 * 960 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
}).fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]);

router.get('/getpages/:userId', pageController.getPagesByUser);
router.post('/pageadd/:userId', (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      return next(err);
    }
    next();
  });
}, pageController.createPage);
router.put('/pageupdate/:userId/:pageId', pageController.updatePage);
router.put('/update-image/:pageId', (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      return next(err);
    }
    next();
  });
}, pageController.updatePageImage);
router.delete('/pagedelete/:userId/:pageId', pageController.deletePage);

module.exports = router;
