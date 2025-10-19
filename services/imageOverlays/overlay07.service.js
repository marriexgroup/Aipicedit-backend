const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const { drawReadCaptionBubble } = require('./comon/readCamptionElement');
const { addImageMetadataWithUuid } = require('../metadata.service');

async function generateImageOverlay07(options) {
  const {
    base64Data,
    content,
    pageName,
    colors,
    noTextOverlay,
    includePageProfileImage,
    pageProfileImageUrl,
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
    await drawOverlay(canvas, ctx, image, content, pageName, colors, noTextOverlay, includePageProfileImage, pageProfileImageUrl);

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

async function drawOverlay(canvas, ctx, image, content, pageName, colors, noTextOverlay, includePageProfileImage, pageProfileImageUrl) {
  // Set canvas dimensions
  canvas.width = 768;
  canvas.height = 960;

  // Clear canvas before drawing
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw image
  ctx.drawImage(image, 0, 0, 768, 960);

    // Draw the "Read Caption" bubble
    drawReadCaptionBubble(ctx, canvas);

  // Text configuration
  const textPadding = 40;
  const cornerRadius = 0; // Remove rounded corners for full-width look
  const lineHeight = 50;
  const fontSize = 40;
  const footerHeight = 40;
  const minOverlayHeight = 150;
  // Draw logo at top left
  if (includePageProfileImage) {
    const logoImage = await loadImage(pageProfileImageUrl);
    const logoWidth = 120;
    const logoHeight = logoWidth; // Assuming you want a perfect circle (square aspect ratio)
    const logoX = 40;
    const logoY = 40;
    const borderWidth1 = 5;
    const shadowBlur = 10;

    // Save the context state
    ctx.save();

    // Create shadow (draw this first so it appears behind the image)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    // Draw the border (white circle that will show as border)
    ctx.beginPath();
    ctx.arc(
      logoX + logoWidth / 2,
      logoY + logoHeight / 2,
      logoWidth / 2,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = '#ffffff'; // Border color (white in this case)
    ctx.fill();

    // Create clipping path for the image
    ctx.beginPath();
    ctx.arc(
      logoX + logoWidth / 2,
      logoY + logoHeight / 2,
      (logoWidth / 2) - borderWidth1, // Slightly smaller radius to account for border
      0,
      Math.PI * 2
    );
    ctx.closePath();
    ctx.clip();

    // Draw the image
    ctx.drawImage(
      logoImage,
      logoX + borderWidth1, // Adjust position to account for border
      logoY + borderWidth1,
      logoWidth - (borderWidth1 * 2),
      logoHeight - (borderWidth1 * 2)
    );
    ctx.restore();
  }
  const fontPath = path.join(process.cwd(), 'fonts', 'OpenSans-Bold.ttf');
  registerFont(fontPath, { family: 'OpenSans-Bold', weight: 'bold' });
  ctx.font = `bold ${fontSize}px Open Sans`;

  // Register sinhala font
  const fontPathSinhala = path.join(process.cwd(), 'fonts', 'iskpotab.ttf');
  registerFont(fontPathSinhala, { family: 'OpenSans-Bold', weight: 'bold' });
  ctx.textAlign = "left";

  if (!noTextOverlay) {
    // Get highlight words from content
    const highlightWords = content.highlights || [];
    const highlightColor = "#ffff00";
    const normalColor = colors.main;

    // Function to split text into wrapped lines with highlight information
    const createTextLines = () => {
      const maxWidth = canvas.width - (textPadding * 2); // Remove padding since box is full width
      const words = content.fact.split(/\s+/);
      const lines = [];
      let currentLine = [];
      let currentLineWidth = 0;

      // First break into words and identify highlights
      const processedWords = words.map(word => {
        const isHighlight = highlightWords.some(highlight =>
          word.toLowerCase().includes(highlight.toLowerCase())
        );
        return { text: word, isHighlight };
      });

      // Build lines ensuring they fit within maxWidth
      processedWords.forEach(wordObj => {
        const wordWidth = ctx.measureText(wordObj.text + ' ').width;

        if (currentLineWidth + wordWidth <= maxWidth) {
          currentLine.push(wordObj);
          currentLineWidth += wordWidth;
        } else {
          if (currentLine.length > 0) {
            lines.push(currentLine);
          }
          currentLine = [wordObj];
          currentLineWidth = wordWidth;
        }
      });

      // Add the last line
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }

      return lines;
    };

    // Create the text lines
    const textLines = createTextLines();
    const lineCount = textLines.length;

    // Calculate overlay height
    const textHeight = (lineCount * lineHeight) + (textPadding * 2);
    const overlayHeight = Math.max(textHeight, minOverlayHeight);
    const overlayTop = canvas.height - overlayHeight - footerHeight;

    // Draw full-width rectangle (no rounded corners)
    ctx.beginPath();
    ctx.rect(0, overlayTop, canvas.width, 500);
    ctx.closePath();

    // Solid fill color for rectangle
    ctx.fillStyle = "rgba(0, 0, 0)"; // Pure dark overlay
    ctx.fill();

    // Draw text lines with highlights
    let textY = overlayTop + textPadding + fontSize;
    const boxLeft = textPadding;
    const boxRight = canvas.width - textPadding;

    textLines.forEach(line => {
      let currentX = boxLeft;
      let lineText = '';

      // First calculate total line width for centering
      const totalWidth = line.reduce((sum, word) => sum + ctx.measureText(word.text + ' ').width, 0);
      currentX = (canvas.width - totalWidth) / 2;

      // Draw each word with appropriate color
      line.forEach((wordObj, index) => {
        const word = wordObj.text + (index < line.length - 1 ? ' ' : '');
        ctx.fillStyle = wordObj.isHighlight ? colors.child[Math.floor(Math.random() * 3)] : normalColor;
        ctx.fillText(word, currentX, textY);
        currentX += ctx.measureText(word).width;
      });

      textY += lineHeight;
    });
  }
  // Footer
  ctx.fillStyle = "#bdc3c7";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`- ${pageName} -`, canvas.width / 2, canvas.height - 20);
}

module.exports = { generateImageOverlay07 };