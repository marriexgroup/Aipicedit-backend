const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const { drawReadCaptionBubble } = require('./comon/readCamptionElement');
const { addImageMetadataWithUuid } = require('../metadata.service');

async function generateImageOverlay27(options) {
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

  // Register Lakes-Neue font (same as overlay 29)
  const fontPath = path.join(process.cwd(), 'fonts', 'Lakes-Neue.ttf');
  registerFont(fontPath, { family: 'Lakes-Neue', weight: 'normal' });

  if (!noTextOverlay) {
    

    const bottomGradient = ctx.createLinearGradient(0, canvas.height * 0.3, 0, canvas.height);
    bottomGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    bottomGradient.addColorStop(1, "#000000");

    // Draw gradients
   

    ctx.fillStyle = bottomGradient;
    ctx.fillRect(0, canvas.height * 0.3, canvas.width, canvas.height * 0.8);

    
    // Process fact text
    const allWords = (content?.fact || '').split(' ');
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

    // Helper function to draw a single center-aligned line with highlights
    function drawCenteredTextLineWithHighlights(ctx, text, highlights, centerX, y, maxWidth, fontSize) {
      const highlightSet = (highlights || []).map(h => h.toLowerCase());
      
      // For center alignment, measure the full line width (with all white)
      ctx.fillStyle = '#fff';
      let lineWidth = ctx.measureText(text).width;
      let drawX = centerX - lineWidth / 2; // Center the text

      // Tokenize the line for highlights (greedy match longest highlight first)
      let remaining = text;
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
          // Draw highlight in theme color
          ctx.fillStyle = '#fe001c';
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

    // Simple function to draw text with highlights - much more reliable
    function drawTextWithHighlights(ctx, text, highlights, x, y) {
      if (!highlights || highlights.length === 0) {
        // No highlights, just draw the text normally
        ctx.fillStyle = '#fff';
        ctx.fillText(text, x, y);
        return;
      }
      
      // Simple approach: draw the whole text in white first
      ctx.fillStyle = '#fff';
      ctx.fillText(text, x, y);
      
      // Then draw highlights on top
      const highlightSet = highlights.map(h => h.toLowerCase());
      const words = text.split(' ');
      let currentX = x;
      
      // Calculate starting position to center the text
      const totalWidth = ctx.measureText(text).width;
      const startX = x - totalWidth / 2;
      currentX = startX;
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const space = i < words.length - 1 ? ' ' : '';
        const wordWithSpace = word + space;
        const wordWidth = ctx.measureText(wordWithSpace).width;
        
        // // Check if this word should be highlighted
        // let shouldHighlight = false;
        // for (const highlight of highlightSet) {
        //   if (word.toLowerCase().includes(highlight.toLowerCase())) {
        //     shouldHighlight = true;
        //     break;
        //   }
        // }
        
        // if (shouldHighlight) {
        //   // Draw highlight in red
        //   ctx.fillStyle = '#fe001c';
        //   ctx.fillText(wordWithSpace, currentX, y);
        //   ctx.fillStyle = '#fff'; // Reset to white
        // }
        
        currentX += wordWidth;
      }
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
            // Draw highlight in theme color
            ctx.fillStyle = '#fe001c';
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

    // Draw fact text with descending sizes and perfect center alignment
    const factText = content?.fact || '';
    
    if (factText) {
      const factBottomY = canvas.height - 70 * 2; // Position at bottom center
      
      // Split text into words
      const words = factText.toUpperCase().split(' ');
      
      // Create lines with smart word distribution
      const lines = [];
      const baseSize = 40 * 2.6; // Largest size
      const sizeDecrement = 6 * 2.6; // Size decrease per line
      
      let wordIndex = 0;
      let lineIndex = 0;
      
      // Distribute words according to specific requirements
      while (wordIndex < words.length) {
        let wordsToTake;
        
        // Specific word distribution per line
        if (lineIndex === 0) {
          wordsToTake = 1; // 1st line: 1 word
        } else if (lineIndex === 1) {
          wordsToTake = 2; // 2nd line: 2 words
        } else if (lineIndex === 2) {
          wordsToTake = 3; // 3rd line: 3 words
        } else if (lineIndex === 3) {
          wordsToTake = 5; // 4th line: 5 words
        } else {
          wordsToTake = words.length - wordIndex; // 5th line: all remaining words
        }
        
        const lineWords = words.slice(wordIndex, wordIndex + wordsToTake);
        if (lineWords.length > 0) {
          lines.push(lineWords.join(' '));
          wordIndex += wordsToTake;
          lineIndex++;
        }
      }
      
      // Calculate total height for all lines
      let totalHeight = 0;
      for (let i = 0; i < lines.length; i++) {
        const fontSize = Math.max(baseSize - i * sizeDecrement, 20 * 2.6);
        totalHeight += fontSize * 1.4;
      }
      
      // Draw lines with perfect center alignment
      let currentY = factBottomY - totalHeight;
      
      for (let i = 0; i < lines.length; i++) {
        const fontSize = Math.max(baseSize - i * sizeDecrement, 20 * 2.6);
        const lineHeight = fontSize * 1.4;
        
        // Set font and alignment
        ctx.font = `normal ${fontSize}px Lakes-Neue`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw text with highlights
        drawTextWithHighlights(ctx, lines[i], content?.highlights, canvas.width / 2, currentY + lineHeight / 2);
        
        currentY += lineHeight;
      }
    }

    // Draw bottom centered thin white line (similar to overlay 29)
    const underlineWidth = canvas.width * 0.25;
    const underlineY = canvas.height - 42 * 2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo((canvas.width - underlineWidth) / 2, underlineY);
    ctx.lineTo((canvas.width + underlineWidth) / 2, underlineY);
    ctx.stroke();

    // Load and draw bottom banner
    const bottomBannerPath = path.join(process.cwd(), 'services', 'imageOverlays', 'bottombannerred.png');
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
    ctx.font = `normal ${pageNameSize}px Lakes-Neue`;

    const pageNameWidth = ctx.measureText(pageNameText).width;
    const pageNameBoxY = bannerY + (bannerHeight - pageNameSize) / 2; // Center vertically in banner
    const pageNameBoxX = canvas.width - pageNameWidth - 20 * 2; // Right corner with margin

    // Page name text in gold color, no background
    ctx.fillStyle = '#FFF'; // Gold color
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      pageNameText,
      pageNameBoxX,
      pageNameBoxY + pageNameSize / 2
    );
  }
}

module.exports = { generateImageOverlay27 };