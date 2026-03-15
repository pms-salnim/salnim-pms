
import { db } from "../firebase";
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v2/https";
import * as nodemailer from "nodemailer";
import { generateEmailHtml, generateSignatureHtml } from "../lib/emailHelpers";
import type { Property } from "../types/property";
import { emailTemplateTypes, type EmailTemplate, type EmailTemplateType } from "../types/emailTemplate";


/**
 * Fetches an email template, replaces variables, and sends the email.
 * @param {PropertyData} propertyData The property's configuration.
 * @param {EmailTemplateType} templateType The type of template to use.
 * @param {string} recipientEmail The email address of the recipient.
 * @param {Record<string, string | number>} variables Key-value pairs for replacement.
 */
export async function sendTemplatedEmail(
  propertyData: Property,
  templateType: EmailTemplateType,
  recipientEmail: string,
  variables: {[key: string]: string | number | undefined},
  attachments?: nodemailer.SendMailOptions['attachments'],
) {
  const emailConfig = propertyData.emailConfiguration;
  if (!emailConfig?.smtpHost || !emailConfig.smtpUser || !emailConfig.smtpPass) {
    logger.error(`SMTP not configured for property ${propertyData.id}. Skipping email for template ${templateType}.`);
    throw new HttpsError("failed-precondition", "SMTP settings are not configured for this property.");
  }

  const templateDocId = `${templateType}_${propertyData.id}`;
  const templateDocRef = db.doc(`emailTemplates/${templateDocId}`);
  const templateDoc = await templateDocRef.get();
  
  if (!templateDoc.exists) {
    const templateInfo = emailTemplateTypes.find((t) => t.type === templateType);
    const templateName = templateInfo ? templateInfo.name : templateType;
    throw new HttpsError('failed-precondition', `Email template "${templateName}" is not configured. Please set it up in your settings.`);
  }

  const templateData = templateDoc.data() as EmailTemplate;
  if (templateData.status !== 'live') {
    logger.log(`Email template "${templateType}" is not live (status: ${templateData.status}). Skipping send.`);
    return; // Successfully do nothing if the template is not live.
  }

  let subject = templateData?.subject;
  let body = templateData?.body;

  if (!subject || !body) {
    const templateInfo = emailTemplateTypes.find((t) => t.type === templateType);
    const templateName = templateInfo ? templateInfo.name : templateType;
    throw new HttpsError('failed-precondition', `The subject or body for the "${templateName}" email template is empty. Please complete it in your settings.`);
  }

  if (body.includes("{{price_breakdown}}")) {
      const currency = propertyData.currency || '$';
      let breakdownText = "";
      if (variables.roomsTotal !== undefined) breakdownText += `\nRooms Total: ${currency}${Number(variables.roomsTotal).toFixed(2)}`;
      if (variables.extrasTotal !== undefined && Number(variables.extrasTotal) > 0) breakdownText += `\nExtras Total: ${currency}${Number(variables.extrasTotal).toFixed(2)}`;
      if (variables.subtotal !== undefined) breakdownText += `\nSubtotal: ${currency}${Number(variables.subtotal).toFixed(2)}`;
      if (variables.discountAmount !== undefined && Number(variables.discountAmount) > 0) breakdownText += `\nDiscount: -${currency}${Number(variables.discountAmount).toFixed(2)}`;
      if (variables.netAmount !== undefined) breakdownText += `\nNet Amount: ${currency}${Number(variables.netAmount).toFixed(2)}`;
      if (variables.taxAmount !== undefined && Number(variables.taxAmount) > 0) breakdownText += `\nTaxes: ${currency}${Number(variables.taxAmount).toFixed(2)}`;
      if (variables.total_price !== undefined) breakdownText += `\n\nGrand Total: ${currency}${Number(variables.total_price.toString().replace(currency, '')).toFixed(2)}`;

      body = body.replace("{{price_breakdown}}", breakdownText.trim());
  }


  // Replace all standard variables
  for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      subject = subject.replace(regex, String(value || "N/A"));
      body = body.replace(regex, String(value || "N/A"));
  }
  
  // Replace property-level variables
  subject = subject.replace(/{{property_name}}/g, propertyData.name || "");
  body = body.replace(/{{property_name}}/g, propertyData.name || "");
  body = body.replace(/{{property_address}}/g, propertyData.address || "");
  body = body.replace(/{{property_phone}}/g, propertyData.phone || "");
  body = body.replace(/{{property_email}}/g, propertyData.email || "");

  // Inject signature HTML into the template placeholder
  const signatureHtml = generateSignatureHtml(propertyData.signatureSettings);
  if (signatureHtml) {
    // Replace the signature placeholder ID with the generated signature HTML
    // The signature placeholder follows the pattern: id="email-signature-[template-key]"
    body = body.replace(new RegExp(`id="email-signature-${templateType}"[^>]*>\\s*</`, "g"), `id="email-signature-${templateType}">${signatureHtml}</`);
  }

  try {
    const isSecure = emailConfig.smtpPort === 465; // true for 465
    const transporter = nodemailer.createTransport({
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort,
      secure: isSecure,
      auth: { user: emailConfig.smtpUser, pass: emailConfig.smtpPass },
      tls: {
          rejectUnauthorized: false
      }
    });

    const fromName = emailConfig.fromName || propertyData.name;
    const fromEmail = emailConfig.smtpUser;
    const htmlBody = generateEmailHtml(body, propertyData);

    const mailOptions: nodemailer.SendMailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: recipientEmail,
        subject: subject,
        text: body,
        html: htmlBody,
    };
    
    if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments;
    }

    await transporter.sendMail(mailOptions);
    logger.log(`Templated email "${templateType}" sent to ${recipientEmail}.`);
  } catch (error) {
    logger.error(`Error sending templated email "${templateType}" to ${recipientEmail}:`, error);
    throw new HttpsError("internal", `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
