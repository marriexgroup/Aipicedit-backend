function drawSquareImageElement(ctx, image, logoWidth, logoHeight, logoX, logoY) {
//   const logoWidth = 300;
//   const logoHeight = 150;
//   const logoX = Math.random() < 0.5 ? 40 : 370;
//   const logoY = Math.floor(Math.random() * (450 - 40 + 1)) + 40;
  const borderWidth1 = 4;
  const shadowBlur = 10;

  ctx.save();

  // Shadow settings
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  // White border rectangle
  ctx.beginPath();
  ctx.rect(logoX, logoY, logoWidth, logoHeight);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Clip area inside border
  ctx.beginPath();
  ctx.rect(
    logoX + borderWidth1,
    logoY + borderWidth1,
    logoWidth - borderWidth1 * 2,
    logoHeight - borderWidth1 * 2
  );
  ctx.closePath();
  ctx.clip();

  // Draw image inside clipped area
  ctx.drawImage(
    image,
    logoX + borderWidth1,
    logoY + borderWidth1,
    logoWidth - borderWidth1 * 2,
    logoHeight - borderWidth1 * 2
  );

  ctx.restore();
}

module.exports = { drawSquareImageElement };
