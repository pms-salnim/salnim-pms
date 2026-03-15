import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import * as nodemailer from "nodemailer";
import type { Property } from "../types/property";

export const sendGuestMessage = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be authenticated.");
    }

    const { guestId, guestEmail, guestName, message, propertyId, messageType = 'email' } = request.data;

    if (!guestEmail || !message || !propertyId) {
        throw new HttpsError("invalid-argument", "Missing required fields: guestEmail, message, propertyId.");
    }

    try {
        // Get property configuration
        const propDocRef = db.doc(`properties/${propertyId}`);
        const propDocSnap = await propDocRef.get();

        if (!propDocSnap.exists) {
            throw new HttpsError("not-found", "Property configuration not found.");
        }

        const propertyData = propDocSnap.data() as Property;

        // Send email message
        if (messageType === 'email') {
            const emailConfig = propertyData.emailConfiguration;

            if (!emailConfig?.smtpHost || !emailConfig.smtpUser || !emailConfig.smtpPass) {
                throw new HttpsError("failed-precondition", "SMTP not configured for this property.");
            }

            const transporter = nodemailer.createTransport({
                host: emailConfig.smtpHost,
                port: emailConfig.smtpPort || 587,
                secure: emailConfig.smtpPort === 465,
                auth: {
                    user: emailConfig.smtpUser,
                    pass: emailConfig.smtpPass,
                },
            });

            const fromName = emailConfig.fromName || propertyData.name;
            const fromEmail = emailConfig.smtpUser;

            // Create HTML email
            const htmlBody = `
                <html>
                    <body style="font-family: Arial, sans-serif; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto;">
                            <p style="font-size: 16px; line-height: 1.6;">
                                Hello <strong>${guestName}</strong>,
                            </p>
                            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                                ${message.split('\n').map((line: string) => `<p style="margin: 8px 0;">${line}</p>`).join('')}
                            </div>
                            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                                Best regards,<br/>
                                <strong>${fromName}</strong>
                            </p>
                        </div>
                    </body>
                </html>
            `;

            await transporter.sendMail({
                from: `"${fromName}" <${fromEmail}>`,
                to: guestEmail,
                subject: `Message from ${fromName}`,
                html: htmlBody,
            });

            logger.info(`Message sent to guest ${guestEmail}`, { guestId, propertyId });
        }

        // Create message record in Firestore
        const messageRef = db.collection('guests').doc(guestId || 'unknown').collection('messages');
        await messageRef.add({
            guestEmail,
            guestName,
            message,
            messageType,
            status: 'sent',
            sentAt: new Date(),
            sentBy: request.auth.uid,
            propertyId,
        });

        return {
            success: true,
            message: 'Message sent successfully',
        };
    } catch (error) {
        logger.error('Error sending guest message:', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Failed to send message');
    }
});
