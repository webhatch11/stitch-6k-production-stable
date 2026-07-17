import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const transporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
  port: Number(process.env.BREVO_SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASS
  }
});

async function runTest() {
  console.log("Using Host:", process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com");
  console.log("Using User/Login:", process.env.BREVO_SMTP_USER || "(Not configured)");
  
  if (!process.env.BREVO_SMTP_USER || !process.env.BREVO_SMTP_PASS) {
    console.error("❌ Error: SMTP credentials (BREVO_SMTP_USER and BREVO_SMTP_PASS) are missing in .env.local.");
    process.exit(1);
  }

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || '"6K Brand Test" <noreply@the6k.com>';
    console.log("Sending test email to 6kthebrand@gmail.com...");
    
    const info = await transporter.sendMail({
      from: fromEmail,
      to: "6kthebrand@gmail.com",
      subject: "Stitch 6K — Brevo SMTP Test",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Brevo SMTP test connection is working!</h2>
          <p>This message confirms that your Nodemailer configuration is authenticated successfully.</p>
        </div>
      `
    });

    console.log("✅ Connection successful!");
    console.log("Message ID:", info.messageId);
  } catch (error: any) {
    console.error("❌ Email failed to send!");
    console.error("Error details:", error.message || error);
  }
}

runTest();
