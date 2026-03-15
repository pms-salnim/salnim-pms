
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import * as nodemailer from "nodemailer";
import { generateEmailHtml } from "../lib/emailHelpers";
import type { Property } from "../types/property";


export const sendComposedEmail = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be authenticated.");
    }

    const { propertyId, to, subject, htmlBody, attachments } = request.data;

    if (!propertyId || !to || !subject || !htmlBody) {
        throw new HttpsError("invalid-argument", "Missing required fields: to, subject, htmlBody.");
    }

    const propDocRef = db.doc(`properties/${propertyId}`);
    const propDocSnap = await propDocRef.get();

    if (!propDocSnap.exists) {
        throw new HttpsError("not-found", "Property configuration not found.");
    }

    const propertyData = propDocSnap.data() as Property;
    const emailConfig = propertyData.emailConfiguration;

    if (!(emailConfig?.smtpHost) || !emailConfig.smtpUser || !emailConfig.smtpPass) {
        throw new HttpsError("failed-precondition", "SMTP not configured for this property.");
    }

    const transporter = nodemailer.createTransport({
        host: emailConfig.smtpHost,
        port: emailConfig.smtpPort || 587,
        secure: emailConfig.smtpPort === 465, // true for 465, false for others
        auth: {
            user: emailConfig.smtpUser,
            pass: emailConfig.smtpPass,
        },
    });

    try {
        const fromName = emailConfig.fromName || propertyData.name;
        const fromEmail = emailConfig.smtpUser;
        const templatedHtmlBody = generateEmailHtml(htmlBody, propertyData);

        const mailOptions: nodemailer.SendMailOptions = {
            from: `"${fromName}" <${fromEmail}>`,
            to: to,
            subject: subject,
            html: templatedHtmlBody,
        };
        
        if (attachments && Array.isArray(attachments)) {
            mailOptions.attachments = attachments;
        }

        await transporter.sendMail(mailOptions);

        logger.log(`Composed email sent successfully from ${fromEmail} to ${to}.`);
        return { success: true, message: "Email sent successfully!" };
    } catch (error) {
        console.error("Error sending composed email:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new HttpsError("internal", `Failed to send email: ${errorMessage}`);
    }
});
