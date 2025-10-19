const express = require('express');
const router = express.Router();
const multer = require('multer');
const { generateImage,generateImageManual, generateImagesAuto, overlayTestFunction, generateImagesNoneTemplate, generateImageWithPrompt } = require('../controllers/image.controller');


const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 960 * 960, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'), false);
      }
    }
  });
// Define the POST route for image generation
// POST /api/image/generate-image
router.post('/generate-image', generateImagesAuto);
router.post('/generate-image-manual', generateImageManual);
router.post('/generate-image-none-template', generateImagesNoneTemplate);
router.post('/generate-image-with-prompt', upload.single('image'), generateImageWithPrompt);
router.post('/overlay-test',upload.single('image'), overlayTestFunction);

module.exports = router;
