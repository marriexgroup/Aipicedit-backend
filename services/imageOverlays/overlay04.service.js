const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const { drawReadCaptionBubble } = require('./comon/readCamptionElement');
const { addImageMetadataWithUuid } = require('../metadata.service');

async function generateImageOverlay04(options) {
  const {
    base64Data,
    content,
    pageName,
    colors,
    noTextOverlay,
    templateWidth = 768,
    templateHeight = 960
  } = options;

  // Create canvas
  const canvas = createCanvas(templateWidth, templateHeight);
  const ctx = canvas.getContext('2d');

  try {
    // Load image from base64 data
    const image = await loadImage(`data:image/jpeg;base64,${base64Data}`);

    // Draw overlay
    await drawOverlay(canvas, ctx, image, content, pageName, colors, noTextOverlay);

    // Convert canvas to buffer for metadata processing
    const imageBuffer = canvas.toBuffer('image/jpeg');
    
    // Add metadata with UUID
    const { buffer: imageWithMetadata, uuid } = await addImageMetadataWithUuid(imageBuffer, {
      pageName: pageName,
      content: content,
      description: content?.fact
    });

    // Convert back to base64
    return imageWithMetadata.toString('base64');

  } catch (error) {
    console.error('Error generating image:', error);
    throw error;
  }
}

async function drawOverlay(canvas, ctx, image, content, pageName, colors, noTextOverlay) {
    // Set canvas dimensions
    canvas.width = 768;
    canvas.height = 960;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw solid black background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw the "Read Caption" bubble
    drawReadCaptionBubble(ctx, canvas);
    // Register font
    const fontPath = path.join(process.cwd(), 'fonts', 'OpenSans-Bold.ttf');
    registerFont(fontPath, { family: 'OpenSans-Bold', weight: 'bold' });

    // Register sinhala font
    const fontPathSinhala = path.join(process.cwd(), 'fonts', 'iskpotab.ttf');
    registerFont(fontPathSinhala, { family: 'OpenSans-Bold', weight: 'bold' });

    if (!noTextOverlay) {
      // Draw yellow quote mark at the top left
      ctx.font = 'bold 100px OpenSans-Bold';
      ctx.fillStyle = '#FFD600';
      ctx.fillText('“', 40, 170);

      // Draw quote text (large, white, left-aligned)
      const quote = content && content.fact ? content.fact : '';
      ctx.font = 'bold 34px OpenSans-Bold';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      // Wrap quote text
      const quoteX = 80;
      const quoteY = 180;
      const quoteMaxWidth = 540;
      const quoteLineHeight = 48;
      let words = quote.split(' ');
      let line = '';
      let y = quoteY;
      for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let metrics = ctx.measureText(testLine);
        let testWidth = metrics.width;
        if (testWidth > quoteMaxWidth && n > 0) {
          ctx.fillText(line, quoteX, y);
          line = words[n] + ' ';
          y += quoteLineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, quoteX, y);
      y += quoteLineHeight;

      // Draw author (yellow, smaller, below quote)
      const author = pageName ? pageName : '';
      ctx.font = 'bold 22px OpenSans-Bold';
      ctx.fillStyle = '#FFD600';
      ctx.fillText('- ' + author, quoteX, y + 10);
    }

    // Draw image in rounded rectangle with yellow border at bottom right
    // Image box size and position
    const imgBoxW = 400;
    const imgBoxH = 300;
    const imgBoxX = canvas.width - imgBoxW - 40;
    const imgBoxY = canvas.height - imgBoxH - 60;
    // Border radius: top-left 0px, top-right 40px, bottom-right 40px, bottom-left 40px
    const borderRadii = [40, 0, 40, 0];
    // Draw rounded rectangle (border)
    function roundedRectCustom(ctx, x, y, w, h, radii) {
      // radii: [tl, tr, br, bl]
      ctx.moveTo(x + radii[0], y);
      ctx.lineTo(x + w - radii[1], y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radii[1]);
      ctx.lineTo(x + w, y + h - radii[2]);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radii[2], y + h);
      ctx.lineTo(x + radii[3], y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radii[3]);
      ctx.lineTo(x, y + radii[0]);
      ctx.quadraticCurveTo(x, y, x + radii[0], y);
    }
    ctx.save();
    ctx.beginPath();
    roundedRectCustom(ctx, imgBoxX, imgBoxY, imgBoxW, imgBoxH, borderRadii);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, imgBoxX, imgBoxY, imgBoxW, imgBoxH);
    ctx.restore();
    // Draw yellow border
    ctx.save();
    ctx.beginPath();
    roundedRectCustom(ctx, imgBoxX, imgBoxY, imgBoxW, imgBoxH, borderRadii);
    ctx.closePath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FFD600';
    ctx.stroke();
    ctx.restore();
}

module.exports = { generateImageOverlay04 };