const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const { drawReadCaptionBubble } = require('./comon/readCamptionElement');
const { addImageMetadataWithUuid } = require('../metadata.service');

async function generateImageOverlay06(options) {
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

  // Create canvas
  const canvas = createCanvas(templateWidth, templateHeight);
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
  // Set canvas dimensions with border space
  const borderWidth = 0;
  canvas.width = 768;
  canvas.height = 960;
  const fontSize = 40;
  // Clear canvas before drawing
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw border background
  // ctx.fillStyle = '#fff';
  // ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw image with border offset
  const imageX = borderWidth;
  const imageY = borderWidth;
  const imageWidth = canvas.width;
  const imageHeight = canvas.height;
  ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);

    // Draw the "Read Caption" bubble
    drawReadCaptionBubble(ctx, canvas);

  // Add the colorful line with light bulb in the middle of the image
  const lineHeight = 40;
  const lineThickness = 6;
  const lineY = canvas.height / 1.7; // Middle of the canvas

  // Draw the gradient line
  const gradient = ctx.createLinearGradient(0, lineY, canvas.width, lineY);
  gradient.addColorStop(0, 'red');
  gradient.addColorStop(0.2, 'yellow');
  gradient.addColorStop(0.4, 'blue');
  gradient.addColorStop(0.6, 'magenta');
  gradient.addColorStop(0.8, 'yellow');
  gradient.addColorStop(1, 'red');

  ctx.fillStyle = gradient;
  ctx.fillRect(borderWidth, lineY - lineThickness / 2, imageWidth, lineThickness);

  if( includePageProfileImage) {
    // Load the bulb image
    const bulbImage = await loadImage(pageProfileImageUrl);
    const bulbSize = 100; // Adjust size as needed
    const bulbPadding = 2;
    const bulbX = canvas.width / 2;

    // Draw background for the bulb
    ctx.beginPath();
    ctx.arc(
      bulbX,
      lineY,
      bulbSize / 2 + bulbPadding,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Create a clipping path for the circular image
    ctx.save(); // Save the current context state
    ctx.beginPath();
    ctx.arc(
      bulbX,
      lineY,
      bulbSize / 2,
      0,
      Math.PI * 2
    );
    ctx.closePath();
    ctx.clip(); // Apply the clipping path

    // Draw the bulb image within the circular clipping path
    ctx.drawImage(
      bulbImage,
      bulbX - bulbSize / 2,
      lineY - bulbSize / 2,
      bulbSize,
      bulbSize
    );

    ctx.restore();
  } else  {
    
    // // Fallback to emoji if image fails to load
    // const bulbText = '💡';
    // const bulbSize = 16;
    // const bulbPadding = 8;
    // const bulbX = canvas.width / 2;

    // ctx.font = `${bulbSize}px Arial`;
    // const bulbTextWidth = ctx.measureText(bulbText).width;

    // ctx.fillStyle = '#000';
    // ctx.fillRect(
    //   bulbX - bulbTextWidth / 2 - bulbPadding,
    //   lineY - bulbSize / 2 - 2,
    //   bulbTextWidth + bulbPadding * 2,
    //   bulbSize + 4
    // );

    // ctx.fillStyle = '#fff';
    // ctx.textAlign = 'center';
    // ctx.textBaseline = 'middle';
    // ctx.fillText(bulbText, bulbX, lineY);
    // ctx.textAlign = 'left';
  }

  // Rest of your existing code...
  const fontPath = path.join(process.cwd(), 'fonts', 'OpenSans-Bold.ttf');
  registerFont(fontPath, { family: 'OpenSans-Bold', weight: 'bold' });
  ctx.font = `bold ${fontSize}px Open Sans`;

  // Register sinhala font
  const fontPathSinhala = path.join(process.cwd(), 'fonts', 'iskpotab.ttf');
  registerFont(fontPathSinhala, { family: 'OpenSans-Bold', weight: 'bold' });

  // Overlay configuration
  const overlayHeight = canvas.height * 0.7; // 40% of canvas height
  const overlayBottomMargin = borderWidth;
  const overlayTop = canvas.height - overlayHeight - overlayBottomMargin;

  if (!noTextOverlay) {
    // Create gradient with pure black at bottom
    const gradient = ctx.createLinearGradient(0, overlayTop, 0, canvas.height - overlayBottomMargin);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)"); // Fully transparent at top of overlay
    gradient.addColorStop(1, "#000000"); // Pure black at bottom

    // Draw overlay
    ctx.fillStyle = gradient;
    ctx.fillRect(borderWidth, overlayTop, imageWidth, overlayHeight);

    // Add fact text above page name at the bottom (column, page name at bottom, fact above)
    const pageNameText = pageName.toUpperCase();
    const pageNameColor = '#fff';
    const factText = content && content.fact ? content.fact : '';
    const factFontSize = 40;
    const pageNameFontSize = 25;
    const marginBottom = 10;
    const marginBetween = 10;
    const borderY = canvas.height - borderWidth;
    // Page name Y position (10px above border)
    const pageNameY = borderY - marginBottom;

    // Set up fonts and measure widths
    ctx.font = `bold ${pageNameFontSize}px OpenSans-Bold`;
    const pageNameWidth = ctx.measureText(pageNameText).width;
    const pageNameX = (canvas.width - pageNameWidth) / 2;

    ctx.font = `bold ${factFontSize}px OpenSans-Bold`;
    const factMaxWidth = canvas.width - borderWidth * 2 - 40;

    // Helper to center-align text lines (no justification), with highlights
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
        // Find highlight matches in the line (case-insensitive, multi-word)
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
            // Draw highlight
            ctx.fillStyle = '#bb8fce';
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

    // Calculate fact text block height
    const factLineHeight = factFontSize * 1.3;
    let tempLine = '';
    let lines = [];
    const words = factText.split(' ');
    for (let n = 0; n < words.length; n++) {
      const testLine = tempLine + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > factMaxWidth && n > 0) {
        lines.push(tempLine.trim());
        tempLine = words[n] + ' ';
      } else {
        tempLine = testLine;
      }
    }
    lines.push(tempLine.trim());
    const factBlockHeight = lines.length * factLineHeight;
    // The bottom of the fact text is 10px above the page name
    const factBottomY = pageNameY - marginBetween - 70;
    // The top of the fact text is factBottomY - factBlockHeight

    // Draw "DID YOU KNOW" box above the fact text
    const didYouKnowBoxWidth = 600;
    const didYouKnowBoxHeight = 130;
    const didYouKnowBoxX = (canvas.width - didYouKnowBoxWidth) / 2;
    const didYouKnowBoxY = (canvas.height - didYouKnowBoxHeight) / 2 + 50;

    // Draw black box with yellow border
    // ctx.beginPath();
    // if (ctx.roundRect) {
    //   ctx.roundRect(didYouKnowBoxX, didYouKnowBoxY, didYouKnowBoxWidth, didYouKnowBoxHeight, 20);
    // } else {
    //   // Fallback for environments without roundRect
    //   ctx.rect(didYouKnowBoxX, didYouKnowBoxY, didYouKnowBoxWidth, didYouKnowBoxHeight);
    // }
    // ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    // ctx.fill();
    // ctx.strokeStyle = '#fff';
    // ctx.lineWidth = 4;
    // ctx.stroke();

    // Add "DID YOU KNOW" text
    // ctx.font = 'bold 48px OpenSans-Bold';
    // ctx.fillStyle = '#fff';
    // ctx.textAlign = 'center';
    // ctx.fillText('Ever wondered!', canvas.width / 2, didYouKnowBoxY + 80);
    // ctx.textAlign = 'left'; // Reset to default for other text

    // Draw fact text (centered, white, bottom-aligned above page name, with highlights)
    if (factText) {
      ctx.font = `bold ${factFontSize}px OpenSans-Bold`;
      drawCenteredTextLinesWithHighlights(ctx, factText, content.highlights, borderWidth + 20, factBottomY, factMaxWidth, factLineHeight);
    }

    // Draw page name in white box with black text
    const pageNamePadding = 10;
    const pageNameBoxHeight = 40;
    const pageNameBoxY = borderY - pageNameBoxHeight - marginBottom;

    // Draw white box for page name
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(
        (canvas.width - pageNameWidth) / 2 - pageNamePadding,
        pageNameBoxY,
        pageNameWidth + pageNamePadding * 2,
        pageNameBoxHeight,
        10
      );
    } else {
      // Fallback for environments without roundRect
      ctx.rect(
        (canvas.width - pageNameWidth) / 2 - pageNamePadding,
        pageNameBoxY,
        pageNameWidth + pageNamePadding * 2,
        pageNameBoxHeight
      );
    }
    ctx.fill();

    // Draw page name (centered, black text)
    ctx.font = `bold ${pageNameFontSize}px OpenSans-Bold`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      pageNameText,
      canvas.width / 2,
      pageNameBoxY + pageNameBoxHeight / 2
    );
    ctx.textAlign = 'left'; // Reset alignment
    ctx.textBaseline = 'alphabetic'; // Reset baseline
  }
}

module.exports = { generateImageOverlay06 };