const { registerFont } = require('canvas');
const path = require('path');

// Register font before exporting the function
const fontPath = path.join(process.cwd(), 'fonts', 'OpenSans-Bold.ttf');
registerFont(fontPath, { family: 'OpenSans-Bold', weight: 'bold' });

// Register sinhala font
const fontPathSinhala = path.join(process.cwd(), 'fonts', 'iskpotab.ttf');
registerFont(fontPathSinhala, { family: 'OpenSans-Bold', weight: 'bold' });

function drawReadCaptionBubble(ctx, canvas) {
    // Save the current context state
    ctx.save();
    
    const bubbleWidth = 180;
    const bubbleHeight = 50;
    const cornerRadius = 15;
    const tailHeight = 10;
    const tailWidth = 12;
    const rightMargin = 40;
    const topMargin = 20;
    
    // Bubble position
    const bubbleX = canvas.width - bubbleWidth - rightMargin;
    const bubbleY = topMargin + tailHeight; // Make space for the tail
    
    // Draw the pointed tail at top center (pointing upward)
    ctx.beginPath();
    ctx.moveTo(bubbleX + bubbleWidth * 0.5 - tailWidth/2, bubbleY); // Left point
    ctx.lineTo(bubbleX + bubbleWidth * 0.5, bubbleY - tailHeight);  // Top center point
    ctx.lineTo(bubbleX + bubbleWidth * 0.5 + tailWidth/2, bubbleY); // Right point
    ctx.closePath();
    ctx.fillStyle = 'white';
    ctx.fill();
    
    // Draw the main rounded rectangle below the tail
    ctx.beginPath();
    // Start just right of top-left corner
    ctx.moveTo(bubbleX + cornerRadius, bubbleY); 
    // Top edge
    ctx.lineTo(bubbleX + bubbleWidth - cornerRadius, bubbleY);
    // Top-right corner
    ctx.quadraticCurveTo(
        bubbleX + bubbleWidth, bubbleY,
        bubbleX + bubbleWidth, bubbleY + cornerRadius
    );
    // Right edge
    ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - cornerRadius);
    // Bottom-right corner
    ctx.quadraticCurveTo(
        bubbleX + bubbleWidth, bubbleY + bubbleHeight,
        bubbleX + bubbleWidth - cornerRadius, bubbleY + bubbleHeight
    );
    // Bottom edge
    ctx.lineTo(bubbleX + cornerRadius, bubbleY + bubbleHeight);
    // Bottom-left corner
    ctx.quadraticCurveTo(
        bubbleX, bubbleY + bubbleHeight,
        bubbleX, bubbleY + bubbleHeight - cornerRadius
    );
    // Left edge
    ctx.lineTo(bubbleX, bubbleY + cornerRadius);
    // Top-left corner
    ctx.quadraticCurveTo(
        bubbleX, bubbleY,
        bubbleX + cornerRadius, bubbleY
    );
    ctx.closePath();
    
    // Fill the bubble
    ctx.fillStyle = 'white';
    ctx.fill();
    
    // Add text
    try {
        ctx.font = 'bold 20px OpenSans-Bold';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Read Caption', bubbleX + bubbleWidth/2, bubbleY + bubbleHeight/2);
    } catch (error) {
        console.error('Error drawing bubble text:', error);
        // Fallback to system font
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('Read Caption', bubbleX + bubbleWidth/2, bubbleY + bubbleHeight/2);
    }
    
    // Restore the context state
    ctx.restore();
}

module.exports = { drawReadCaptionBubble };