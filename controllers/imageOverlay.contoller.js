const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const { drawReadCaptionBubble } = require('../services/imageOverlays/comon/readCamptionElement');

async function generateImageOverlay(options) {
  const {
    base64Data,
    content,
    pageName,
    colors,
    noTextOverlay
  } = options;

  // Create canvas
  const canvas = createCanvas(768, 960);
  const ctx = canvas.getContext('2d');

  try {
    // Load image from base64 data
    const image = await loadImage(`data:image/jpeg;base64,${base64Data}`);

    // Draw overlay
    await drawOverlay(canvas, ctx, image, content, pageName, colors, noTextOverlay);

    // Convert canvas to base64
    const editedImageBase64 = canvas.toDataURL().split(',')[1]; // Remove data URL prefix
    return editedImageBase64;

  } catch (error) {
    console.error('Error generating image:', error);
    throw error;
  }
}

async function drawOverlay(canvas, ctx, image, content, pageName, colors, noTextOverlay) {
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
  const padding = 40;
  const textPadding = 40;
  const cornerRadius = 32;
  const lineHeight = 50;
  const fontSize = 40;
  const footerHeight = 40;
  const minOverlayHeight = 150;
  const fontPath = path.join(process.cwd(), 'fonts', 'OpenSans-Bold.ttf');
  registerFont(fontPath, { family: 'OpenSans-Bold', weight: 'bold' });
  ctx.font = `bold ${fontSize}px Open Sans`;
  ctx.textAlign = "left";

  if (!noTextOverlay) {
    // Get highlight words from content
    const highlightWords = content.highlights || [];
    const highlightColor = "#ffff00";
    const normalColor = colors.main;

    // Function to split text into wrapped lines with highlight information
    const createTextLines = () => {
      const maxWidth = canvas.width - (padding * 2) - (textPadding * 2);
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
    const overlayTop = canvas.height - overlayHeight - footerHeight - 20;

    // Draw rounded rectangle
    ctx.beginPath();
    ctx.moveTo(padding, overlayTop + cornerRadius);
    ctx.arcTo(padding, overlayTop, padding + cornerRadius, overlayTop, cornerRadius);
    ctx.lineTo(canvas.width - padding - cornerRadius, overlayTop);
    ctx.arcTo(canvas.width - padding, overlayTop, canvas.width - padding, overlayTop + cornerRadius, cornerRadius);
    ctx.lineTo(canvas.width - padding, overlayTop + overlayHeight - cornerRadius);
    ctx.arcTo(canvas.width - padding, overlayTop + overlayHeight, canvas.width - padding - cornerRadius, overlayTop + overlayHeight, cornerRadius);
    ctx.lineTo(padding + cornerRadius, overlayTop + overlayHeight);
    ctx.arcTo(padding, overlayTop + overlayHeight, padding, overlayTop + overlayHeight - cornerRadius, cornerRadius);
    ctx.closePath();

    // Gradient fill for rounded rectangle
    const gradient = ctx.createLinearGradient(0, overlayTop, 0, overlayTop + overlayHeight);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.4)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.6)");
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw text lines with highlights
    let textY = overlayTop + textPadding + fontSize;
    const boxLeft = padding + textPadding;
    const boxRight = canvas.width - padding - textPadding;

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
  ctx.fillStyle = "#dddddd";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(pageName, canvas.width / 2, canvas.height - 20);
}

module.exports = { generateImageOverlay };