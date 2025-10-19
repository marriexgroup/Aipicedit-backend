const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const { addImageMetadataWithUuid } = require('../metadata.service');

async function generateImageOverlay28(options) {
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
    console.error('Error generating overlay28:', error);
    throw error;
  }
}

async function drawOverlay(canvas, ctx, image, content, pageName, noTextOverlay, includePageProfileImage, pageProfileImageUrl) {
  const themeYellow = '#ffe100';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background image
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Fonts
  const fontPath = path.join(process.cwd(), 'fonts', 'Lakes-Neue.ttf');
  registerFont(fontPath, { family: 'Lakes-Neue', weight: 'normal' });
  // const fontPathSinhala = path.join(process.cwd(), 'fonts', 'iskpotab.ttf');
  // registerFont(fontPathSinhala, { family: 'Lakes-Neue', weight: 'normal' });

  // Outer rounded border similar to reference
  const radius = 28 * 2;
  const border = 5 * 2;
  ctx.save();
  // yellow frame
  ctx.lineWidth = border;
  ctx.strokeStyle = themeYellow;
  roundedRectStroke(ctx, border, border, canvas.width - border * 2, canvas.height - border * 2, radius);
  ctx.restore();

  // Optional profile image (top-left within frame)
  if (includePageProfileImage && pageProfileImageUrl) {
    const logoImage = await loadImage(pageProfileImageUrl);
    const size = 90 * 2;
    const x = 26 * 2;
    const y = 26 * 2;
    const whiteBorder = 6 * 2;
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
    ctx.drawImage(logoImage, x + whiteBorder, y + whiteBorder, size - whiteBorder * 2, size - whiteBorder * 2);
    ctx.restore();
  }

  // Magnified circular inset at top-left
  const insetSize = 180 * 2;
  const insetX = 30 * 2;
  const insetY = 36 * 2;
  const insetBorder = 10 * 2;
  const insetOffsetY = 80 * 2; // sample area offset down a bit
  ctx.save();

  if (!noTextOverlay) {
    // Bottom black gradient overlay (2x height)
    const originalTopFactor = 0.55;
    const originalHeightFactor = 0.45;
    const overlayHeightFactor = Math.min(1, originalHeightFactor * 2); // 0.90
    const overlayTopFactor = 1 - overlayHeightFactor; // 0.10
    const overlayTopY = canvas.height * overlayTopFactor;
    const grad = ctx.createLinearGradient(0, overlayTopY, 0, canvas.height);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, overlayTopY, canvas.width, canvas.height * overlayHeightFactor);

    // Caption
    const full = (content?.fact || '').toUpperCase();
    const bottomSize = 30 * 2.6;
    const highlightColor = '#ffe100';
    const marginX = 40 * 2;
    const maxWidth = canvas.width - marginX * 2;
    const textBottomY = canvas.height - 70 * 2;
    const lineHeight = bottomSize * 1.3;
    
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
    
    // Thin yellow divider with two diamonds - positioned above text with margin
    const dividerMargin = 20 * 2; // margin above text
    const lineY = textTopY - dividerMargin;
    ctx.strokeStyle = themeYellow;
    ctx.lineWidth = 8;
    // Draw divider as two separate line segments to leave a gap between diamonds
    const leftDiamondCx = canvas.width / 2 - 24;
    const rightDiamondCx = canvas.width / 2 + 24;
    const diamondSize = 14;
    // Left segment: from margin to just after left diamond
    ctx.beginPath();
    ctx.moveTo(marginX, lineY);
    ctx.lineTo(leftDiamondCx + diamondSize, lineY);
    ctx.stroke();
    // Right segment: from just before right diamond to margin
    ctx.beginPath();
    ctx.moveTo(rightDiamondCx - diamondSize, lineY);
    ctx.lineTo(canvas.width - marginX, lineY);
    ctx.stroke();
    // Draw diamonds
    drawDiamond(ctx, leftDiamondCx, lineY, diamondSize, themeYellow);
    drawDiamond(ctx, rightDiamondCx, lineY, diamondSize, themeYellow);
    
    // Draw the text
    drawCenteredTextWithHighlights(ctx, full, content?.highlights, marginX, textBottomY, maxWidth, lineHeight, highlightColor);

    // Page name bottom-right, white
    const pageText = `@${(pageName || '').toUpperCase()}`;
    const pageSize = 15 * 2;
     ctx.font = `normal ${pageSize}px Lakes-Neue`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(pageText, canvas.width - 20 * 2, canvas.height - 20 * 2);
  }
}

function roundedRectStroke(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();
}

function drawDiamond(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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

module.exports = { generateImageOverlay28 };


