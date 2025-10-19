const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const { drawReadCaptionBubble } = require('./comon/readCamptionElement');
const { addImageMetadataWithUuid } = require('../metadata.service');

async function generateImageOverlay25(options) {
  const {
    base64Data,
    content,
    pageName,
    colors,
    noTextOverlay,
    pageProfileImageUrl,
    includePageProfileImage,
    templateWidth = 768,
    templateHeight = 960
  } = options;

  // Create canvas - scaled up 2x
  const canvas = createCanvas(templateWidth * 1.5, templateHeight * 1.5);
  const ctx = canvas.getContext('2d');

  try {
    // Load image from base64 data
    const image = await loadImage(`data:image/jpeg;base64,${base64Data}`);

    // Draw overlay
    await drawOverlay(canvas, ctx, image, content, pageName, colors, noTextOverlay, pageProfileImageUrl, includePageProfileImage);

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

async function drawOverlay(canvas, ctx, image, content, pageName, colors, noTextOverlay, pageProfileImageUrl, includePageProfileImage) {
  // Set canvas dimensions (already set to 2x)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw image scaled up 2x
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Register font
  const fontPath = path.join(process.cwd(), 'fonts', 'OpenSans-Bold.ttf');
  registerFont(fontPath, { family: 'OpenSans-Bold', weight: 'bold' });

  // Register sinhala font
  const fontPathSinhala = path.join(process.cwd(), 'fonts', 'iskpotab.ttf');
  registerFont(fontPathSinhala, { family: 'OpenSans-Bold', weight: 'bold' });

  if (!noTextOverlay) {
    

    const bottomGradient = ctx.createLinearGradient(0, canvas.height * 0.3, 0, canvas.height);
    bottomGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    bottomGradient.addColorStop(1, "#000000");

    // Draw gradients
   

    ctx.fillStyle = bottomGradient;
    ctx.fillRect(0, canvas.height * 0.3, canvas.width, canvas.height * 0.8);

    // Draw the "Read Caption" bubble (scaled up)
    drawReadCaptionBubble(ctx, canvas);
    
    // Color palette
    const wordColors = ['#ea1058', '#fff', '#16a0ed', '#1de4a1', '#ddcd54', '#39e6df'];

    // Process fact text
    const factText = content?.fact || '';
    const allWords = factText.split(' ');
    const topWords = allWords.slice(0, 3).join(' ');
    const bottomWords = allWords.slice(3).join(' ');

    // Draw top section with two border lines
    const lineMargin = 40 * 2; // Scaled up
    const lineThickness = 2 * 2; // Scaled up

    // Top border lines - pure white
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lineThickness;

    // Draw logo at top left (scaled up)
    if (includePageProfileImage) {
      const logoImage = await loadImage(pageProfileImageUrl);
      const logoWidth = 120 * 2; // Scaled up
      const logoHeight = logoWidth;
      const logoX = 40 * 2; // Scaled up
      const logoY = 250 * 2; // Scaled up
      const borderWidth1 = 5 * 2; // Scaled up
      const shadowBlur = 10 * 2; // Scaled up

      // Save the context state
      ctx.save();

      // Create shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4 * 2; // Scaled up

      // Draw the border
      ctx.beginPath();
      ctx.arc(
        logoX + logoWidth / 2,
        logoY + logoHeight / 2,
        logoWidth / 2,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Create clipping path for the image
      ctx.beginPath();
      ctx.arc(
        logoX + logoWidth / 2,
        logoY + logoHeight / 2,
        (logoWidth / 2) - borderWidth1,
        0,
        Math.PI * 2
      );
      ctx.closePath();
      ctx.clip();

      // Draw the image
      ctx.drawImage(
        logoImage,
        logoX + borderWidth1,
        logoY + borderWidth1,
        logoWidth - (borderWidth1 * 2),
        logoHeight - (borderWidth1 * 2)
      );
      ctx.restore();
    }

    // Draw bottom section

    // Bottom text (remaining words) - now left aligned
    const bottomTextSize = 30 * 2; // Scaled up
    ctx.font = `bold ${bottomTextSize}px OpenSans-Bold`;
    ctx.textAlign = 'left'; // Changed from 'center' to 'left'

    if (bottomWords) {
      // Split into words and measure total width
      const words = bottomWords.split(' ');
      const spaceWidth = ctx.measureText(' ').width;
      
      // Calculate lines
      const maxWidth = canvas.width - lineMargin * 2;
      const lineHeight = bottomTextSize * 1.3;
      let lines = [];
      let currentLine = [];
      let currentLineWidth = 0;
      
      // Build lines
      for (const word of words) {
        const wordWidth = ctx.measureText(word).width;
        if (currentLineWidth + wordWidth + (currentLine.length > 0 ? spaceWidth : 0) <= maxWidth) {
          currentLine.push(word);
          currentLineWidth += wordWidth + (currentLine.length > 1 ? spaceWidth : 0);
        } else {
          lines.push({ words: currentLine, width: currentLineWidth });
          currentLine = [word];
          currentLineWidth = wordWidth;
        }
      }
      if (currentLine.length > 0) {
        lines.push({ words: currentLine, width: currentLineWidth });
      }
      
      // Draw gold vertical line on the left side of text
      const goldLineX = lineMargin - 20 * 2; // Position to the left of text
      const goldLineY = canvas.height - 150 * 2; // Start at text position
      const goldLineHeight = lines.length * 55; // Height based on text lines
      
      ctx.strokeStyle = '#FFD700'; // Gold color
      ctx.lineWidth = 4 * 2; // Scaled up thickness
      ctx.beginPath();
      ctx.moveTo(goldLineX, goldLineY - lineHeight * 0.5);
      ctx.lineTo(goldLineX, goldLineY + goldLineHeight);
      ctx.stroke();
      
      // Draw lines left aligned at bottom center
      let currentY = canvas.height - 150 * 2; // Position at bottom center
      lines.forEach((line, lineIndex) => {
        let currentX = lineMargin; // Left aligned with margin
        
        line.words.forEach((word, wordIndex) => {
          const wordWidth = ctx.measureText(word).width;
          ctx.fillStyle = '#ffffff'; // Pure white color
          ctx.fillText(word, currentX, currentY);
          currentX += wordWidth + spaceWidth;
        });
        
        currentY += lineHeight;
      });
    }


    // Draw page name box - scaled up
    const pageNameText = pageName?.toUpperCase() || '';
    const pageNameSize = 15 * 2; // Scaled up
    ctx.font = `bold ${pageNameSize}px OpenSans-Bold`;

    const pageNameWidth = ctx.measureText(pageNameText).width;
    const pageNamePadding = 8 * 2; // Scaled up
    const pageNameBoxHeight = 25 * 2; // Scaled up
    const pageNameBoxY = canvas.height - 40 * 2; // Scaled up

    // White box
    ctx.fillStyle = '#ffffff';
    if (ctx.roundRect) {
      ctx.roundRect(
        (canvas.width - pageNameWidth) / 2 - pageNamePadding,
        pageNameBoxY,
        pageNameWidth + pageNamePadding * 2,
        pageNameBoxHeight,
        10 * 2 // Scaled up
      );
    } else {
      ctx.rect(
        (canvas.width - pageNameWidth) / 2 - pageNamePadding,
        pageNameBoxY,
        pageNameWidth + pageNamePadding * 2,
        pageNameBoxHeight
      );
    }
    ctx.fill();

    // Page name text
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      pageNameText,
      canvas.width / 2,
      pageNameBoxY + pageNameBoxHeight / 2
    );
  }
}

module.exports = { generateImageOverlay25 };