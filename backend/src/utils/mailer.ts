import nodemailer from "nodemailer";

// Check if SMTP is properly configured
const isSmtpConfigured = () => {
  const configured = !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_HOST !== '127.0.0.1' &&
    process.env.SMTP_HOST !== 'localhost' &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
  
  console.log("🔍 SMTP Configuration Check:");
  console.log(`   SMTP_HOST: ${process.env.SMTP_HOST || 'NOT SET'}`);
  console.log(`   SMTP_PORT: ${process.env.SMTP_PORT || 'NOT SET'}`);
  console.log(`   SMTP_USER: ${process.env.SMTP_USER || 'NOT SET'}`);
  console.log(`   SMTP_PASS: ${process.env.SMTP_PASS ? '***SET***' : 'NOT SET'}`);
  console.log(`   EMAIL_FROM: ${process.env.EMAIL_FROM || 'NOT SET'}`);
  console.log(`   ✅ SMTP Configured: ${configured}\n`);
  
  return configured;
};

// Create transporter only if SMTP is configured
let transporter: nodemailer.Transporter | null = null;

if (isSmtpConfigured()) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false, // Use TLS, not SSL
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // FIX: Ignore self-signed certificate errors
      tls: {
        rejectUnauthorized: false, // Accept self-signed certificates
      },
    });
    console.log("✅ SMTP transporter created successfully\n");
  } catch (error) {
    console.error("❌ Failed to create SMTP transporter:", error);
  }
} else {
  console.log("📧 Running in DEV MODE - emails will be logged to console only\n");
}

export const sendEmail = async ({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}) => {
  // Development mode - just log to console
  if (!transporter) {
    console.log("\n📧 ========== EMAIL (DEV MODE) ==========");
    console.log(`📬 To: ${to}`);
    console.log(`📝 Subject: ${subject}`);
    console.log(`📄 Text: ${text}`);
    console.log("=========================================\n");
    return { messageId: "dev-mode-no-email-sent" };
  }

  // Production mode - send real email
  try {
    console.log(`📤 Attempting to send email to: ${to}`);
    
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Your App" <noreply@yourapp.com>`,
      to,
      subject,
      text,
      html,
    });

    console.log("✅ Email sent successfully!");
    console.log("📧 Message ID:", info.messageId);
    console.log("📬 Delivered to:", to);
    console.log("📊 Response:", info.response);
    console.log("");
    
    return info;
  } catch (error: any) {
    console.error("\n❌ ========== EMAIL SENDING FAILED ==========");
    console.error("📧 Recipient:", to);
    console.error("❌ Error:", error.message);
    console.error("🔍 Error Code:", error.code);
    console.error("📋 Full Error:", error);
    console.error("============================================\n");
    throw error;
  }
};

export const sendVerificationEmail = async (email: string, code: string) => {
  const subject = "Verify Your Email Address";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333; text-align: center;">Email Verification</h2>
      <p>Thank you for registering! Please use the following code to verify your email:</p>
      <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 8px;">
        ${code}
      </div>
      <p style="color: #666;">This code will expire in 15 minutes.</p>
      <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
    </div>
  `;
  const text = `Your verification code is: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you didn't request this, please ignore this email.`;

  console.log(`\n📧 Preparing to send verification email to: ${email}`);
  console.log(`🔢 Verification code: ${code}`);
  
  await sendEmail({ to: email, subject, html, text });
};

export const sendPasswordResetEmail = async (email: string, resetToken: string) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  
  const subject = "Password Reset Request";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>You requested to reset your password. Click the button below to proceed:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #007bff;">${resetUrl}</p>
      <p style="color: #666;">This link will expire in 1 hour.</p>
      <p style="color: #999; font-size: 12px;">If you didn't request this reset, please ignore this email.</p>
    </div>
  `;
  const text = `You requested to reset your password.\n\nClick here to reset: ${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`;

  await sendEmail({ to: email, subject, html, text });
};