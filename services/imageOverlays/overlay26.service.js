const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const { drawReadCaptionBubble } = require('./comon/readCamptionElement');
const { addImageMetadataWithUuid } = require('../metadata.service');

async function generateImageOverlay26(options) {
  const {
    base64Data,
    content,
    pageName,
    colors,
    noTextOverlay,
    pageProfileImageUrl,
    includePageProfileImage,
    templateHeight,
    templateWidth
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
   registerFont(fontPathSinhala, { family: 'IskPota-Bold', weight: 'bold' });

  if (!noTextOverlay) {
    

    const bottomGradient = ctx.createLinearGradient(0, canvas.height * 0.3, 0, canvas.height);
    bottomGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    bottomGradient.addColorStop(1, "#000000");

    // Draw gradients
   

    ctx.fillStyle = bottomGradient;
    ctx.fillRect(0, canvas.height * 0.3, canvas.width, canvas.height * 0.8);

    
    // Process fact text
    const factText = content?.fact || '';

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

    // Helper function to draw text with highlights (similar to overlay 3)
    function drawCenteredTextLinesWithHighlights(ctx, text, highlights, x, yBottom, maxWidth, lineHeight) {
      // Prepare highlights for case-insensitive matching
      const highlightSet = (highlights || []).map(h => h.toLowerCase());
      // Split text into words, but keep punctuation
      const words = text.split(' ');
      let line = '';
      let lines = [];
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          lines.push(line.trim());
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line.trim());
      
      // Draw from bottom up, center-aligned, with highlights
      for (let i = lines.length - 1; i >= 0; i--) {
        let currentLine = lines[i];
        let drawX = x;
        let y = yBottom - (lines.length - 1 - i) * lineHeight;
        
        // For center alignment, measure the full line width (with all white)
        ctx.fillStyle = '#fff';
        let lineWidth = ctx.measureText(currentLine).width;
        drawX = x + (maxWidth - lineWidth) / 2;

        // Tokenize the line for highlights (greedy match longest highlight first)
        let remaining = currentLine;
        let cursor = drawX;
        while (remaining.length > 0) {
          let match = null;
          let matchIdx = -1;
          let matchLen = 0;
          // Find the longest highlight match at the start
          for (let h of highlightSet) {
            if (remaining.toLowerCase().startsWith(h) && h.length > matchLen) {
              match = remaining.substr(0, h.length);
              matchIdx = 0;
              matchLen = h.length;
            }
          }
          if (match) {
            // Draw highlight in gold
            ctx.fillStyle = '#FFD700';
            ctx.fillText(match, cursor, y);
            cursor += ctx.measureText(match).width;
            remaining = remaining.substr(matchLen);
            ctx.fillStyle = '#fff';
          } else {
            // Draw up to next highlight or next space
            let nextHighlightIdx = -1;
            let nextHighlightLen = 0;
            for (let h of highlightSet) {
              let idx = remaining.toLowerCase().indexOf(h);
              if (idx !== -1 && (nextHighlightIdx === -1 || idx < nextHighlightIdx)) {
                nextHighlightIdx = idx;
                nextHighlightLen = h.length;
              }
            }
            let drawPart = '';
            if (nextHighlightIdx === -1) {
              drawPart = remaining;
              remaining = '';
            } else {
              drawPart = remaining.substr(0, nextHighlightIdx);
              remaining = remaining.substr(nextHighlightIdx);
            }
            ctx.fillStyle = '#fff';
            ctx.fillText(drawPart, cursor, y);
            cursor += ctx.measureText(drawPart).width;
          }
        }
      }
    }

    // Draw bottom section
    const bottomTextSize = 30 * 2.7; // Scaled up 2x more
    // Choose font based on language (Sinhala range U+0D80–U+0DFF)
    const isSinhala = /[\u0D80-\u0DFF]/u.test(factText);
    ctx.font = `bold ${bottomTextSize}px ${isSinhala ? 'IskPota-Bold' : 'OpenSans-Bold'}`;
    ctx.textAlign = 'left'; // Reset to left for the helper function

    if (factText) {
      const maxWidth = canvas.width - lineMargin * 2;
      const lineHeight = bottomTextSize * 1.3;
      const factBottomY = canvas.height - 60 * 2; // Position at bottom center
      
      // Use the highlight function to draw text with highlights
      drawCenteredTextLinesWithHighlights(ctx, factText, content?.highlights, lineMargin, factBottomY, maxWidth, lineHeight);
    }


    // Load and draw bottom banner
    const bottomBannerPath = path.join(process.cwd(), 'services', 'imageOverlays', 'bottombanner.png');
    const bottomBanner = await loadImage(bottomBannerPath);
    
    // Calculate banner dimensions to fit at bottom
    const bannerHeight = 60 * 2; // Scaled up height
    const bannerWidth = canvas.width; // Full width
    const bannerY = canvas.height - bannerHeight;
    
    // Draw bottom banner
    ctx.drawImage(bottomBanner, 0, bannerY, bannerWidth, bannerHeight);

    // Draw page name in right corner of bottom banner
    const pageNameText = `@${pageName?.toUpperCase() || ''}`;
    const pageNameSize = 15 * 2; // Scaled up
    ctx.font = `bold ${pageNameSize}px OpenSans-Bold`;

    const pageNameWidth = ctx.measureText(pageNameText).width;
    const pageNameBoxY = bannerY + (bannerHeight - pageNameSize) / 2; // Center vertically in banner
    const pageNameBoxX = canvas.width - pageNameWidth - 20 * 2; // Right corner with margin

    // Page name text in gold color, no background
    ctx.fillStyle = '#FFD700'; // Gold color
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      pageNameText,
      pageNameBoxX,
      pageNameBoxY + pageNameSize / 2
    );
  }
}

module.exports = { generateImageOverlay26 };