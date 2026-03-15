import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as nodemailer from "nodemailer";

interface SendTestEmailRequest {
  recipientEmail: string;
  subject: string;
  htmlContent: string;
  preheaderText?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  smtpConfig: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
  };
}

export const sendTestEmail = onCall(
  { region: 'europe-west1', memory: '512MiB' },
  async (request: CallableRequest<SendTestEmailRequest>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated.");
    }

    const {
      recipientEmail,
      subject,
      htmlContent,
      preheaderText,
      fromName,
      fromEmail,
      replyTo,
      smtpConfig,
    } = request.data;

    // Validate required fields
    if (!recipientEmail || !subject || !htmlContent || !smtpConfig) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: recipientEmail, subject, htmlContent, smtpConfig."
      );
    }

    // Validate SMTP config
    if (
      !smtpConfig.smtpHost ||
      !smtpConfig.smtpUser ||
      !smtpConfig.smtpPass
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid SMTP configuration: missing smtpHost, smtpUser, or smtpPass."
      );
    }

    try {
      // Create nodemailer transporter with provided SMTP config
      const transporter = nodemailer.createTransport({
        host: smtpConfig.smtpHost,
        port: smtpConfig.smtpPort || 587,
        secure: smtpConfig.smtpPort === 465, // true for 465, false for others
        auth: {
          user: smtpConfig.smtpUser,
          pass: smtpConfig.smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      // Prepare email headers
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${fromName || 'Test Email'}" <${fromEmail || smtpConfig.smtpUser}>`,
        to: recipientEmail,
        subject: subject,
        html: htmlContent,
      };

      // Add preheader text if provided (invisible preview text in email clients)
      if (preheaderText) {
        const preheaderHtml = `<div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheaderText}</div>`;
        mailOptions.html = preheaderHtml + htmlContent;
      }

      // Add reply-to if provided
      if (replyTo) {
        mailOptions.replyTo = replyTo;
      }

      // Send the test email
      const info = await transporter.sendMail(mailOptions);

      logger.log(
        `Test email sent successfully to ${recipientEmail}. Message ID: ${info.messageId}`
      );

      return {
        success: true,
        message: `Test email sent successfully to ${recipientEmail}!`,
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error("Error sending test email:", error);

      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred.";

      // Provide more specific error messages
      if (errorMessage.includes("ECONNREFUSED")) {
        throw new HttpsError(
          "unavailable",
          `Cannot connect to SMTP server. Please verify the SMTP host (${smtpConfig.smtpHost}) and port (${smtpConfig.smtpPort}).`
        );
      } else if (errorMessage.includes("Invalid login")) {
        throw new HttpsError(
          "unauthenticated",
          "SMTP authentication failed. Please verify your username and password."
        );
      } else if (errorMessage.includes("STARTTLS")) {
        throw new HttpsError(
          "failed-precondition",
          "STARTTLS error. Try changing the port (e.g., 587 with STARTTLS or 465 with SSL)."
        );
      }

      throw new HttpsError(
        "internal",
        `Failed to send test email: ${errorMessage}`
      );
    }
  }
);
