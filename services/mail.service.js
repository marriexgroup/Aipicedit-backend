const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.EMAIL_PORT, 10) || 465,
  secure: process.env.EMAIL_SECURE !== 'false', // Default to true since port 465 is standard for Hostinger
  auth: {
    user: process.env.EMAIL_USER || 'support@aipicedit.com',
    pass: process.env.EMAIL_PASSWORD || '', // Must be provided in .env
  },
});

/**
 * Sends a verification email to the user.
 * Falls back to logging the link to the console if SMTP credentials are missing.
 * @param {string} toEmail - The recipient's email address
 * @param {string} username - The user's name
 * @param {string} token - The unique verification token
 */
async function sendVerificationEmail(toEmail, username, token) {
  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/verify?token=${token}`;
  
  console.log(`\n==================================================`);
  console.log(`[VERIFICATION EMAIL SENT]`);
  console.log(`To: ${toEmail}`);
  console.log(`Link: ${verifyUrl}`);
  console.log(`==================================================\n`);

  // Only attempt to send if SMTP credentials (password) are configured and not in test environment
  if (process.env.EMAIL_PASSWORD && process.env.NODE_ENV !== 'test') {
    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Aipicedit Support'}" <${process.env.EMAIL_USER || 'support@aipicedit.com'}>`,
        to: toEmail,
        subject: 'Verify Your Email Address - Aipicedit',
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1a202c; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #4f46e5; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.025em;">Aipicedit</h2>
              <p style="color: #718096; margin-top: 5px; font-size: 14px;">Elevate Your Visuals</p>
            </div>
            
            <h3 style="color: #2d3748; font-size: 20px; font-weight: 600; margin-top: 0;">Verify your email to get started</h3>
            <p style="font-size: 16px; line-height: 1.6; color: #4a5568;">Hi there,</p>
            <p style="font-size: 16px; line-height: 1.6; color: #4a5568;">Thank you for signing up with Aipicedit! Please click the button below to verify your email address and activate your account:</p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${verifyUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);">Verify Email Address</a>
            </div>
            
            <p style="font-size: 14px; line-height: 1.6; color: #718096;">If the button doesn't work, copy and paste the following URL into your browser:</p>
            <p style="font-size: 13px; word-break: break-all; color: #4f46e5; background-color: #f7fafc; padding: 12px; border-radius: 6px; border: 1px solid #edf2f7;">${verifyUrl}</p>
            
            <p style="font-size: 12px; color: #a0aec0; margin-top: 30px; border-top: 1px solid #edf2f7; padding-top: 20px; text-align: center;">
              This verification link is valid for 24 hours. If you did not create an account, you can safely ignore this email.
            </p>
            <p style="font-size: 12px; color: #a0aec0; text-align: center; margin-top: 5px;">
              &copy; ${new Date().getFullYear()} Aipicedit. All rights reserved.
            </p>
          </div>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('SMTP send details:', info.messageId);
      return info;
    } catch (err) {
      console.error('Failed to send SMTP email:', err);
      // We don't fail the whole request because logging to console succeeded
      return { error: err.message };
    }
  } else {
    console.log('[VERIFICATION EMAIL] EMAIL_PASSWORD environment variable not set. Email not sent via SMTP.');
    return { message: 'SMTP not configured, verification link logged to console.' };
  }
}

/**
 * Sends a password reset email to the user.
 * Falls back to logging the link to the console if SMTP credentials are missing.
 * @param {string} toEmail - The recipient's email address
 * @param {string} username - The user's name
 * @param {string} token - The password reset token
 */
async function sendPasswordResetEmail(toEmail, username, token) {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
  
  console.log(`\n==================================================`);
  console.log(`[PASSWORD RESET EMAIL SENT]`);
  console.log(`To: ${toEmail}`);
  console.log(`Link: ${resetUrl}`);
  console.log(`==================================================\n`);

  // Only attempt to send if SMTP credentials (password) are configured and not in test environment
  if (process.env.EMAIL_PASSWORD && process.env.NODE_ENV !== 'test') {
    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Aipicedit Support'}" <${process.env.EMAIL_USER || 'support@aipicedit.com'}>`,
        to: toEmail,
        subject: 'Reset Your Password - Aipicedit',
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1a202c; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #4f46e5; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.025em;">Aipicedit</h2>
              <p style="color: #718096; margin-top: 5px; font-size: 14px;">Elevate Your Visuals</p>
            </div>
            
            <h3 style="color: #2d3748; font-size: 20px; font-weight: 600; margin-top: 0;">Reset your password</h3>
            <p style="font-size: 16px; line-height: 1.6; color: #4a5568;">Hi there,</p>
            <p style="font-size: 16px; line-height: 1.6; color: #4a5568;">We received a request to reset the password for your Aipicedit account. Click the button below to choose a new password:</p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);">Reset Password</a>
            </div>
            
            <p style="font-size: 14px; line-height: 1.6; color: #718096;">If you didn't request a password reset, you can safely ignore this email. Your password won't change.</p>
            <p style="font-size: 14px; line-height: 1.6; color: #718096;">If the button doesn't work, copy and paste the following URL into your browser:</p>
            <p style="font-size: 13px; word-break: break-all; color: #4f46e5; background-color: #f7fafc; padding: 12px; border-radius: 6px; border: 1px solid #edf2f7;">${resetUrl}</p>
            
            <p style="font-size: 12px; color: #a0aec0; margin-top: 30px; border-top: 1px solid #edf2f7; padding-top: 20px; text-align: center;">
              This password reset link is valid for 1 hour.
            </p>
            <p style="font-size: 12px; color: #a0aec0; text-align: center; margin-top: 5px;">
              &copy; ${new Date().getFullYear()} Aipicedit. All rights reserved.
            </p>
          </div>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('SMTP reset details sent:', info.messageId);
      return info;
    } catch (err) {
      console.error('Failed to send SMTP reset email:', err);
      return { error: err.message };
    }
  } else {
    console.log('[PASSWORD RESET] EMAIL_PASSWORD environment variable not set. Email not sent via SMTP.');
    return { message: 'SMTP not configured, reset link logged to console.' };
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
