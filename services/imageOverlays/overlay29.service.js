const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const { addImageMetadataWithUuid } = require('../metadata.service');

async function generateImageOverlay29(options) {
  const {
    base64Data,
    content,
    pageName,
    colors,
    noTextOverlay,
    pageProfileImageUrl,
    includePageProfileImage,
    templateWidth = 1080,
    templateHeight = 1350
  } = options;

  // Work at 2x resolution for sharper text
  const canvas = createCanvas(templateWidth * 2, templateHeight * 2);
  const ctx = canvas.getContext('2d');

  try {
    const image = await loadImage(`data:image/jpeg;base64,${base64Data}`);
    await drawOverlay(canvas, ctx, image, content, pageName, noTextOverlay, includePageProfileImage, pageProfileImageUrl);

    const imageBuffer = canvas.toBuffer('image/jpeg');
    const { buffer: imageWithMetadata } = await addImageMetadataWithUuid(imageBuffer, {
      pageName: pageName,
      content: content,
      description: content?.fact
    });

    return imageWithMetadata.toString('base64');
  } catch (error) {
    console.error('Error generating overlay29:', error);
    throw error;
  }
}

async function drawOverlay(canvas, ctx, image, content, pageName, noTextOverlay, includePageProfileImage, pageProfileImageUrl) {
  const themeYellow = '#FFD700';
  const themePurple = '#FFD700';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background image
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Fonts
  const fontPath = path.join(process.cwd(), 'fonts', 'Lakes-Neue.ttf');
  registerFont(fontPath, { family: 'Lakes-Neue', weight: 'normal' });
  // const fontPathSinhala = path.join(process.cwd(), 'fonts', 'iskpotab.ttf');
  // registerFont(fontPathSinhala, { family: 'Lakes-Neue', weight: 'normal' });

  // // Outer rounded border similar to reference
  // const radius = 28 * 2;
  // const border = 5 * 2;
  // ctx.save();
  // // yellow frame
  // ctx.lineWidth = border;
  // ctx.strokeStyle = themeYellow;
  // roundedRectStroke(ctx, border, border, canvas.width - border * 2, canvas.height - border * 2, radius);
  // ctx.restore();

  // Optional profile image (top-left within frame)
  if (includePageProfileImage && pageProfileImageUrl) {
    const logoImage = await loadImage(pageProfileImageUrl);
    const size = 90 * 2;
    const x = 26 * 2;
    const y = 26 * 2;
    const whiteBorder = 3 * 2; // slimmer border
    ctx.save();
    // outer white circle
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    // clip and draw image
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - whiteBorder, 0, Math.PI * 2);
    ctx.clip();
    // object-fit: cover inside the circle
    drawImageCover(ctx, logoImage, x + whiteBorder, y + whiteBorder, size - whiteBorder * 2, size - whiteBorder * 2);
    ctx.restore();
  }

  // Magnified circular inset at top-left (uses same background image, 3x zoom)
  const insetSize = 250 * 2;
  const insetX = 30 * 2;
  const insetY = 36 * 2;
  const insetBorder = 5 * 2;
  ctx.save();
  // Outer yellow ring
  ctx.beginPath();
  ctx.arc(insetX + insetSize / 2, insetY + insetSize / 2, insetSize / 2, 0, Math.PI * 2);
  ctx.lineWidth = insetBorder;
  ctx.strokeStyle = themeYellow;
  ctx.stroke();
  // Clip to inner circle and draw the background image with object-fit: cover, then zoom 3x
  ctx.beginPath();
  const innerRadius = insetSize / 2 - insetBorder * 0.8;
  ctx.arc(insetX + insetSize / 2, insetY + insetSize / 2, innerRadius, 0, Math.PI * 2);
  ctx.clip();
  {
    const zoomFactor = 3;
    // Compute a cover-style source rect first
    const sourceWidth = image.width || image.naturalWidth || insetSize;
    const sourceHeight = image.height || image.naturalHeight || insetSize;
    const destAspect = insetSize / insetSize; // 1
    const sourceAspect = sourceWidth / sourceHeight;

    let sx, sy, sWidth, sHeight;
    if (sourceAspect > destAspect) {
      // source is wider: crop horizontally
      sHeight = sourceHeight;
      sWidth = sHeight * destAspect;
      sx = (sourceWidth - sWidth) / 2;
      sy = 0;
    } else {
      // source is taller: crop vertically
      sWidth = sourceWidth;
      sHeight = sWidth / destAspect;
      sx = 0;
      sy = (sourceHeight - sHeight) / 2;
    }

    // Apply additional zoom by shrinking the source rect around its center
    const zoomedWidth = sWidth / zoomFactor;
    const zoomedHeight = sHeight / zoomFactor;
    const zoomedSx = sx + (sWidth - zoomedWidth) / 2;
    const zoomedSy = sy + (sHeight - zoomedHeight) / 2;

    ctx.drawImage(
      image,
      zoomedSx,
      zoomedSy,
      zoomedWidth,
      zoomedHeight,
      insetX,
      insetY,
      insetSize,
      insetSize
    );
  }
  ctx.restore();

  if (!noTextOverlay) {
    // Bottom black gradient overlay (1.5x height)
    const originalTopFactor = 0.55;
    const originalHeightFactor = 0.45;
    const overlayHeightFactor = Math.min(1, originalHeightFactor * 1.5); // 0.675
    const overlayTopFactor = 1 - overlayHeightFactor; // 0.325
    const overlayTopY = canvas.height * overlayTopFactor;
    const grad = ctx.createLinearGradient(0, overlayTopY, 0, canvas.height);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, overlayTopY, canvas.width, canvas.height * overlayHeightFactor);

    // Caption
    const full = (content?.fact || '').toUpperCase();
    const bottomSize = 30 * 2.9;
    const highlightColor = themePurple;
    const marginX = 40 * 2;
    const maxWidth = canvas.width - marginX * 2;
    const textBottomY = canvas.height - 70 * 2;
    const lineHeight = bottomSize * 1.6;
    
    // Calculate text height to position divider above it
    const words = (full || '').split(' ');
    let line = '';
    const lines = [];
    ctx.font = `normal ${bottomSize}px Lakes-Neue`;
    for (let i = 0; i < words.length; i++) {
      const test = line + words[i] + ' ';
      if (ctx.measureText(test).width > maxWidth && i > 0) {
        lines.push(line.trim());
        line = words[i] + ' ';
      } else {
        line = test;
      }
    }
    lines.push(line.trim());
    const textHeight = lines.length * lineHeight;
    const textTopY = textBottomY - textHeight;
    
    // No mid-divider for this layout; text sits directly above the bottom line
    
    // Draw the text
    drawCenteredTextWithHighlights(ctx, full, content?.highlights, marginX, textBottomY, maxWidth, lineHeight, highlightColor);

    // Bottom centered thin white line
    const underlineWidth = canvas.width * 0.25;
    const underlineY = canvas.height - 42 * 2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo((canvas.width - underlineWidth) / 2, underlineY);
    ctx.lineTo((canvas.width + underlineWidth) / 2, underlineY);
    ctx.stroke();

    // Bottom credit line (centered)
    const creditText = `|${(pageName ? pageName.toUpperCase() : 'CUTE PET WORLD')}|`;
    const creditSize = 13 * 2;
    ctx.font = `normal ${creditSize}px Lakes-Neue`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(creditText, canvas.width / 2, canvas.height - 16 * 2);
  }
}

function drawCenteredTextWithHighlights(ctx, text, highlights, x, yBottom, maxWidth, lineHeight, highlightColor) {
  const highlightSet = (highlights || []).map(h => h.toLowerCase());
  const words = (text || '').split(' ');
  let line = '';
  const lines = [];
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      lines.push(line.trim());
      line = words[i] + ' ';
    } else {
      line = test;
    }
  }
  lines.push(line.trim());

  for (let i = lines.length - 1; i >= 0; i--) {
    const current = lines[i];
    const y = yBottom - (lines.length - 1 - i) * lineHeight;
    const lineWidth = ctx.measureText(current).width;
    let cursor = x + (maxWidth - lineWidth) / 2;
    let remaining = current;
    while (remaining.length > 0) {
      let matched = '';
      for (const h of highlightSet) {
        if (h && remaining.toLowerCase().startsWith(h) && h.length > matched.length) {
          matched = remaining.substring(0, h.length);
        }
      }
      if (matched) {
        ctx.fillStyle = highlightColor;
        ctx.fillText(matched, cursor, y);
        cursor += ctx.measureText(matched).width;
        remaining = remaining.slice(matched.length);
        ctx.fillStyle = '#ffffff';
      } else {
        // draw until next highlight occurrence or end
        let nextIdx = -1;
        let nextLen = 0;
        for (const h of highlightSet) {
          const idx = remaining.toLowerCase().indexOf(h);
          if (idx !== -1 && (nextIdx === -1 || idx < nextIdx)) {
            nextIdx = idx;
            nextLen = h.length;
          }
        }
        const part = nextIdx === -1 ? remaining : remaining.substring(0, nextIdx);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(part, cursor, y);
        cursor += ctx.measureText(part).width;
        remaining = nextIdx === -1 ? '' : remaining.substring(nextIdx);
      }
    }
  }
}

// Draw image to destination rect using object-fit: cover behavior
function drawImageCover(ctx, img, dx, dy, dWidth, dHeight) {
  const sourceWidth = img.width || img.naturalWidth || dWidth;
  const sourceHeight = img.height || img.naturalHeight || dHeight;
  const destAspect = dWidth / dHeight;
  const sourceAspect = sourceWidth / sourceHeight;

  let sx, sy, sWidth, sHeight;
  if (sourceAspect > destAspect) {
    // source is wider: crop horizontally
    sHeight = sourceHeight;
    sWidth = sHeight * destAspect;
    sx = (sourceWidth - sWidth) / 2;
    sy = 0;
  } else {
    // source is taller: crop vertically
    sWidth = sourceWidth;
    sHeight = sWidth / destAspect;
    sx = 0;
    sy = (sourceHeight - sHeight) / 2;
  }

  ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
}

module.exports = { generateImageOverlay29 };


