"use strict";

/**
 * @fileoverview Main Cloud Functions file for the application.
 *
 * This file contains all the backend logic, including HTTP-callable functions
 * for client-side operations and Firestore triggers for automated workflows.
 * It handles reservation management, user creation, email notifications,
 * and public booking page functionality.
 */

import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import {
  onCall,
  HttpsError,
  type CallableRequest,
  onRequest,
} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import {initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp, FieldValue} from "firebase-admin/firestore";
import {getAuth} from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import {
  format,
  addDays,
  parseISO,
  startOfDay,
  eachDayOfInterval,
  isWithinInterval,
  differenceInDays,
  startOfMonth,
  isValid,
} from "date-fns";

import * as nodemailer from "nodemailer";
import imaps from "imap-simple";
import {simpleParser} from "mailparser";
import {emailTemplateTypes, type EmailTemplateType, type EmailTemplate} from "./types/emailTemplate";
import cors from "cors";
import { generateInvoicePdf } from "./pdfGenerator";
import type { Reservation } from "./types/reservation";
import type { Invoice } from "./types/payment";


// CORS configuration for onRequest functions
const corsHandler = cors({origin: true});


// --- START: TYPE DEFINITIONS ---
// Interfaces to provide strong typing for Firestore data.

interface PropertyData {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  currency: string;
  slug: string;
  lastInvoiceNumber?: number;
  lastReservationNumber?: number;
  cancellationPolicy?: string; // Added for booking page details
  invoiceCustomization?: {
    prefix?: string;
    logoUrl?: string;
    logoSize?: number;
    primaryColor?: string;
    footerText?: string;
    headerNotes?: string;
    includePropertyAddress?: boolean;
    pdfLanguage?: 'en' | 'fr';
  };
  emailConfiguration?: {
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    fromName?: string;
  };
  imapConfiguration?: {
    host: string;
    port: number;
    user: string;
    pass: string;
    useTls: boolean;
  };
  loyaltyProgramSettings?: {
    enabled?: boolean;
    earningRate?: number;
    redemptionRate?: number;
  };
  taxSettings?: {
    enabled: boolean;
    rate: number;
    name?: string;
  };
  bookingPageSettings?: {
    defaultBookingStatus?: "Pending" | "Confirmed";
    allowSameDayTurnover?: boolean;
    logoUrl?: string;
    logoSize?: number;
  };
  notificationSettings?: {
    new_reservation?: { channels?: { inApp?: boolean, email?: boolean }};
    payment_received?: { channels?: { inApp?: boolean, email?: boolean }};
    cancellation?: { channels?: { inApp?: boolean, email?: boolean }};
  }; 
}

interface ReservationData {
  id: string;
  propertyId: string;
  guestName: string;
  guestId?: string;
  guestEmail?: string;
  guestPhone?: string;
  guestCountry?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  roomTypeName?: string;
  roomTypeId: string;
  roomName?: string;
  roomId?: string;
  ratePlanId?: string | null;
  ratePlanName?: string | null;
  adults?: number;
  children?: number;
  paymentStatus?: 'Paid' | 'Pending' | 'Partial' | 'Refunded';
  totalPrice?: number;
  status: "Pending" | "Confirmed" | "Canceled" | "No-Show" | "Checked-in" | "Completed";
  source?: string;
  notes?: string;
  paidWithPoints?: boolean;
  packageInfo?: {
    id: string;
    name: string;
  };
  selectedExtras?: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
    unit: string;
    type: 'service' | 'meal_plan';
  }[];
  roomsTotal?: number;
  extrasTotal?: number;
  subtotal?: number;
  discountAmount?: number;
  netAmount?: number;
  taxAmount?: number;
  priceBeforeDiscount?: number;
  promotionApplied?: {
    id: string;
    name: string;
    discountAmount: number;
    discountType: 'percentage' | 'flat_rate';
    discountValue: number;
  };
  reservationNumber?: string;
  createdAt?: FieldValue;
  isCheckedOut?: boolean;
}

interface PaymentData {
  id: string; // Add id to PaymentData for logic
  propertyId: string;
  paymentNumber?: string;
  date: string;
  guestName: string;
  guestId?: string | null;
  reservationId: string;
  reservationNumber?: string;
  invoiceId: string;
  amountPaid: number;
  paymentMethod: string;
  status: 'Paid' | 'Pending' | 'Failed' | 'Refunded';
  notes: string;
  createdAt?: Date;
  isRefund?: boolean; // New field to distinguish refunds
  originalPaymentId?: string; // New field to link refund to original payment
}


interface InvoiceData {
  id: string; // Document ID
  propertyId: string;
  guestId?: string | null;
  amount: number;
  invoiceNumber: string;
  paymentStatus: "Paid" | "Pending" | "Refunded" | "Partial";
  guestOrCompany?: string;
  dueDate?: string;
  reservationId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  roomTypeName?: string;
  numberOfNights?: number;
  numberOfGuests?: number;
  pricePerNight?: number;
  subtotal: number;
  dateIssued?: string;
  taxAmount: number;
  lineItems?: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  createdAt?: Date;
  discountAmount: number;
}

interface StaffData {
  uid: string;
  fullName: string;
  email: string;
  role: string;
  propertyId: string;
  permissions?: {
    staffManagement?: boolean;
    guests?: boolean;
    settings?: boolean; // Added for the new save function
    finance?: boolean; // Added for refund function
  };
  profile_picture?: string;
}

interface LoyaltyHistoryEntry {
  date: Timestamp | FieldValue;
  change: number;
  reason: string;
}

interface BackendReservation {
  id: string;
  startDate: Date;
  endDate: Date;
  roomId: string;
  status: string;
  isCheckedOut?: boolean;
}

interface BackendRoom {
  id: string;
  roomTypeId: string;
  name: string;
}

interface BackendRoomType {
  id: string;
  name: string;
  maxGuests: number;
  baseRate?: number;
}

interface BackendRatePlan {
    id: string;
    roomTypeId: string;
    default: boolean;
    pricingMethod: "per_night" | "per_guest";
    basePrice?: number;
    pricingPerGuest?: Record<string, number>;
    startDate?: Timestamp | null;
    endDate?: Timestamp | null;
}

interface BackendAvailabilitySetting {
  id: string;
  propertyId: string,
  roomTypeId: string;
  roomId?: string | null;
  status: "blocked" | "available";
  startDate: string;
  endDate: string;
  createdAt: Timestamp;
}


// --- END: TYPE DEFINITIONS ---


// Initialize the Admin SDK
initializeApp();
const db = getFirestore();

/**
 * Helper function to generate a URL-friendly slug from a string.
 * @param {string} name The string to convert to a slug.
 * @return {string} The generated slug.
 */
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s-]/g, "") // remove non-word chars
    .replace(/[\s_-]+/g, "-") // swap spaces for hyphens
    .replace(/^-+|-+$/g, ""); // remove leading/trailing hyphens
};

/**
 * Wraps email content in a professional HTML template.
 * @param {string} bodyContent The main content of the email.
 * @param {PropertyData} propertyData The property's data for branding.
 * @return {string} The full HTML for the email.
 */
const generateEmailHtml = (bodyContent: string, propertyData: PropertyData): string => {
    const primaryColor = propertyData.invoiceCustomization?.primaryColor || '#003166';
    const logoUrl = propertyData.bookingPageSettings?.logoUrl || ''; // Use logo from booking settings
    const propertyName = propertyData.name || 'Your Property';
    const propertyAddress = propertyData.address || '';
    const currentYear = new Date().getFullYear();
    const formattedBody = bodyContent.replace(/\n/g, '<br />');

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${propertyName}</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 20px;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <table width="600" border="0" cellspacing="0" cellpadding="0" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
              <!-- Header -->
              <tr>
                <td align="center" style="background-color: ${primaryColor}; padding: 20px;">
                  ${logoUrl 
                    ? `<img src="${logoUrl}" alt="${propertyName} Logo" style="max-width: 150px; max-height: 70px; border: 0;">`
                    : `<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">${propertyName}</h1>`
                  }
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                  ${formattedBody}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td align="center" style="padding: 20px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0;">${propertyName}</p>
                  ${propertyAddress ? `<p style="margin: 5px 0 0 0;">${propertyAddress}</p>` : ''}
                  <p style="margin: 10px 0 0 0;">&copy; ${currentYear} ${propertyName}. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;
};

/**
 * Fetches an email template, replaces variables, and sends the email.
 * @param {PropertyData} propertyData The property's configuration.
 * @param {EmailTemplateType} templateType The type of template to use.
 * @param {string} recipientEmail The email address of the recipient.
 * @param {Record<string, string | number>} variables Key-value pairs for replacement.
 */
async function sendTemplatedEmail(
  propertyData: PropertyData,
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


/**
 * [PUBLIC] Creates a new user, a new property with a unique slug,
 * and assigns the user as the admin of that property.
 */
exports.signupAndCreateProperty = onCall({ memory: "512MiB" }, async (request) => {
  const {
    email,
    password,
    fullName,
    country,
    city,
    address,
    propertyName,
    propertyAddress,
    propertyType,
  } = request.data;

  // Validate input
  if (!email || !password || !fullName || !propertyName || !propertyType) {
    throw new HttpsError(
      "invalid-argument", "Missing required fields for signup.",
    );
  }

  // Generate initial slug
  let slug = generateSlug(propertyName);
  let isSlugUnique = false;
  let attempt = 0;

  while (!isSlugUnique) {
    const slugToCheck = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
    const slugQuery = db
      .collection("properties").where("slug", "==", slugToCheck).limit(1);
    const snapshot = await slugQuery.get();
    if (snapshot.empty) {
      slug = slugToCheck;
      isSlugUnique = true;
    } else {
      attempt++;
    }
  }

  // Create Firebase Auth user
  let userRecord;
  try {
    userRecord = await getAuth().createUser({
      email,
      password,
      displayName: fullName,
      emailVerified: false,
    });
  } catch (error: any) {
    logger.error("Error creating Firebase Auth user:", error);
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError(
        "already-exists",
        "This email is already in use by another account.",
      );
    }
    throw new HttpsError("internal", "Failed to create user account.");
  }

  const uid = userRecord.uid;
  const propertyDocRef = db.collection("properties").doc();
  const staffDocRef = db.collection("staff").doc(uid);

  const batch = db.batch();

  // Create Property Document
  batch.set(propertyDocRef, {
    name: propertyName,
    address: propertyAddress,
    type: propertyType,
    city: city || "",
    phone: "",
    email: email,
    website: "",
    legalName: "",
    currency: "USD",
    timeZone: "UTC",
    ownerUid: uid,
    slug: slug,
    lastInvoiceNumber: 0,
    lastReservationNumber: 0,
    createdAt: FieldValue.serverTimestamp(),
    bookingPageSettings: {},
    taxSettings: {enabled: true, rate: 0},
    loyaltyProgramSettings: {enabled: false, earningRate: 10, redemptionRate: 1},
    invoiceCustomization: {},
    emailConfiguration: {},
    imapConfiguration: {},
    onboardingCompleted: false,
  });

  // Create Staff Document
  batch.set(staffDocRef, {
    uid,
    fullName,
    email,
    role: "admin",
    propertyId: propertyDocRef.id,
    permissions: {
      rooms: true,
      reservations: true,
      ratePlans: true,
      guests: true,
      finance: true,
      availability: true,
      reports: true,
      settings: true,
      staffManagement: true,
      housekeeping: true,
      extras: true,
      teamWorkspace: true,
    },
    country: country || "",
    city: city || "",
    address: address || "",
    phone: "",
    status: "Active",
    createdAt: FieldValue.serverTimestamp(),
  });
  
  // Pre-create all default email templates
  emailTemplateTypes.forEach(templateInfo => {
    const templateDocRef = db.doc(`emailTemplates/${templateInfo.type}_${propertyDocRef.id}`);
    const defaultTemplateData: Omit<EmailTemplate, 'id'> = {
      propertyId: propertyDocRef.id,
      type: templateInfo.type,
      subject: templateInfo.defaultSubject,
      body: templateInfo.defaultBody,
      status: 'draft',
      lastEditedAt: Timestamp.now(),
      lastEditedBy: 'system',
    };
    batch.set(templateDocRef, defaultTemplateData);
  });

  try {
    await batch.commit();
    
    // Check if the new user is the designated support admin
    if (uid === "VPIar3bcaFgrZz4vJY0SRGW9Rad2") {
      await getAuth().setCustomUserClaims(uid, { admin: true });
      logger.log(`Custom admin claim set for user ${uid}`);
    }

    return {success: true, uid, propertyId: propertyDocRef.id};
  } catch (error: any) {
    logger.error("Error committing signup batch:", error);
    // If batch fails, delete the auth user to allow re-signup
    await getAuth().deleteUser(uid);
    throw new HttpsError(
      "internal", "Failed to create property and user profile.",
    );
  }
});


/**
 * Triggered on new reservation creation.
 * Handles invoice generation, notification creation, and property updates atomically.
 */
exports.handleReservationCreate = onDocumentCreated("reservations/{reservationId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        logger.log("No data associated with the event");
        return;
    }
    const reservationData = snapshot.data() as ReservationData;
    const { propertyId, guestEmail, startDate, endDate, paymentStatus } = reservationData;
    const reservationId = snapshot.id;

    if (!propertyId || !startDate || !endDate) {
        logger.error("Reservation is missing required fields (propertyId, dates).", { id: reservationId });
        return;
    }

    const propertyRef = db.doc(`properties/${propertyId}`);

    try {
        await db.runTransaction(async (transaction) => {
            const propertyDoc = await transaction.get(propertyRef);
            if (!propertyDoc.exists) {
                throw new Error(`Property ${propertyId} not found.`);
            }
            const propertyData = propertyDoc.data() as PropertyData;
            
            const updatedReservationData = { ...reservationData };

            let guestIdToLink: string | undefined = updatedReservationData.guestId;
            if (!guestIdToLink && guestEmail) {
                const guestQuery = db.collection("guests").where("email", "==", guestEmail).where("propertyId", "==", propertyId).limit(1);
                const guestSnapshot = await transaction.get(guestQuery);
                if (guestSnapshot.empty) {
                    const newGuestRef = db.collection("guests").doc();
                    transaction.set(newGuestRef, {
                        fullName: updatedReservationData.guestName, email: guestEmail, phone: updatedReservationData.guestPhone || "",
                        nationality: updatedReservationData.guestCountry || "", propertyId: propertyId, loyaltyStatus: 'not-enrolled', loyaltyPoints: 0, totalPointsEarned: 0, totalPointsRedeemed: 0,
                        createdAt: FieldValue.serverTimestamp(),
                    });
                    guestIdToLink = newGuestRef.id;
                } else {
                    guestIdToLink = guestSnapshot.docs[0].id;
                }
                transaction.update(snapshot.ref, { guestId: guestIdToLink });
                updatedReservationData.guestId = guestIdToLink;
            }
            

            // Generate a 9-digit reservation number
            const prefix = propertyData.invoiceCustomization?.prefix || "R-";
            const newReservationNumber = `${prefix}${Math.floor(100000000 + Math.random() * 900000000)}`;

            const reservationStartDate = updatedReservationData.startDate.toDate();
            const reservationEndDate = updatedReservationData.endDate.toDate();
            const nights = differenceInDays(reservationEndDate, reservationStartDate);

            transaction.update(snapshot.ref, {
              reservationNumber: newReservationNumber,
            });
            logger.log(`Generated and saved reservationNumber: ${newReservationNumber} for reservationId: ${reservationId}`);

            const newInvoiceRef = db.collection("invoices").doc(reservationId);
            const invoiceDocData: InvoiceData = {
                id: newInvoiceRef.id,
                propertyId, invoiceNumber: newReservationNumber,
                guestOrCompany: updatedReservationData.guestName || "N/A",
                guestId: updatedReservationData.guestId,
                reservationId: reservationId,
                dateIssued: format(new Date(), "yyyy-MM-dd"),
                dueDate: format(addDays(new Date(), 30), "yyyy-MM-dd"),
                amount: updatedReservationData.totalPrice || 0,
                paymentStatus: (paymentStatus === "Paid" || reservationData.paidWithPoints) ? "Paid" : "Pending",
                subtotal: updatedReservationData.subtotal || 0, 
                taxAmount: updatedReservationData.taxAmount || 0,
                discountAmount: updatedReservationData.discountAmount || 0,
                lineItems: updatedReservationData.packageInfo
                    ? [{ description: `Package: ${updatedReservationData.packageInfo.name}`, quantity: 1, unitPrice: updatedReservationData.roomsTotal || 0, total: updatedReservationData.roomsTotal || 0 }]
                    : [
                        {
                            description: `Accommodation: ${updatedReservationData.roomTypeName || "Room"} from ${format(reservationStartDate, "PP")} to ${format(reservationEndDate, "PP")}`,
                            quantity: nights > 0 ? nights : 1,
                            unitPrice: (updatedReservationData.roomsTotal && nights > 0) ? updatedReservationData.roomsTotal / nights : updatedReservationData.roomsTotal || 0,
                            total: updatedReservationData.roomsTotal || 0,
                        },
                        ...(updatedReservationData.selectedExtras || []).map(extra => ({
                            description: extra.name,
                            quantity: extra.quantity,
                            unitPrice: extra.price,
                            total: extra.total,
                        }))
                    ],
                createdAt: Timestamp.now(),
            };
            transaction.set(newInvoiceRef, invoiceDocData);

            const newPaymentRef = db.collection(`properties/${propertyId}/payments`).doc();
            const isPaid = paymentStatus === "Paid" ? (updatedReservationData.totalPrice || 0) : 0;
            let paymentMethod = 'N/A';
            
            if (updatedReservationData.paidWithPoints) {
                paymentMethod = 'Loyalty Points';
            } else if (isPaid) {
                paymentMethod = 'Credit Card';
            }

            if (isPaid && updatedReservationData.source !== 'Direct') {
                paymentMethod = 'Other';
            }

            transaction.set(newPaymentRef, {
                propertyId, 
                paymentNumber: newReservationNumber, 
                date: format(new Date(), "yyyy-MM-dd"),
                guestName: updatedReservationData.guestName || "N/A", 
                guestId: updatedReservationData.guestId || null,
                reservationId, 
                invoiceId: newInvoiceRef.id, 
                amountPaid: isPaid,
                paymentMethod: paymentMethod,
                status: isPaid ? "Paid" : "Pending",
                notes: isPaid ? "Payment recorded from new pre-paid reservation." : "Initial payment record for new reservation.",
                createdAt: Timestamp.now(),
            });

            const notificationSettings = propertyData.notificationSettings || {};
            if (notificationSettings.new_reservation?.channels?.inApp) {
                const newNotificationRef = db.collection("notifications").doc();
                transaction.set(newNotificationRef, {
                    propertyId, title: "New Reservation", description: `${updatedReservationData.guestName} booked ${updatedReservationData.roomTypeName || 'a room'}.`,
                    type: "new_reservation", relatedDocId: reservationId, read: false, createdAt: Timestamp.now(),
                });
            }
        });
        
        logger.log(`Successfully processed reservation ${reservationId}`);
    } catch (error) {
        logger.error(`Failed to process reservation ${reservationId}:`, error);
    }
});

/**
 * [NEW] Triggered on new reservation creation from the public booking page.
 * Sends a confirmation email to the guest.
 */
exports.sendPublicBookingConfirmation = onDocumentCreated("reservations/{reservationId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        return;
    }
    const reservationData = snapshot.data() as ReservationData;
    
    // Only proceed if the reservation is from the public booking page.
    if (reservationData.source !== 'Direct' || !reservationData.guestEmail) {
        return;
    }

    const reservationId = snapshot.id;
    const { propertyId, guestEmail } = reservationData;

    try {
        const propertyDoc = await db.doc(`properties/${propertyId}`).get();
        if (!propertyDoc.exists) {
            throw new Error(`Property ${propertyId} not found for email confirmation.`);
        }
        const propertyData = propertyDoc.data() as PropertyData;
        const nights = differenceInDays(reservationData.endDate.toDate(), reservationData.startDate.toDate());
        const numberOfGuests = (reservationData.adults || 0) + (reservationData.children || 0);

        const breakdownVars = {
            roomsTotal: reservationData.roomsTotal,
            extrasTotal: reservationData.extrasTotal,
            subtotal: reservationData.subtotal,
            discountAmount: reservationData.discountAmount,
            netAmount: reservationData.netAmount,
            taxAmount: reservationData.taxAmount,
        };

        const guestEmailVars = {
            guest_name: reservationData.guestName || "Valued Guest",
            reservation_code: reservationId,
            reservation_number: reservationData.reservationNumber,
            check_in_date: format(reservationData.startDate.toDate(), "PP"),
            check_out_date: format(reservationData.endDate.toDate(), "PP"),
            room_type: reservationData.roomTypeName || "N/A",
            room_number: reservationData.roomName || 'N/A',
            number_of_nights: nights,
            number_of_guests: numberOfGuests,
            total_price: `${propertyData.currency || '$'}${(reservationData.totalPrice || 0).toFixed(2)}`,
            ...breakdownVars,
        };
        
        await sendTemplatedEmail(propertyData, 'reservation_confirmation', guestEmail, guestEmailVars);
        
        logger.log(`Sent public booking confirmation for reservation ${reservationId} to ${guestEmail}.`);

    } catch (error) {
        logger.error(`Failed to send public booking confirmation for ${reservationId}:`, error);
    }
});


/**
 * Reusable logic for actions to be taken when an invoice is paid.
 * This can be triggered by creating a paid reservation or updating an invoice.
 * @param {PropertyData} propertyData The property data.
 * @param {InvoiceData | ReservationData} data The invoice or reservation data that was paid.
 */
async function onInvoicePaidLogic(propertyData: PropertyData, data: (InvoiceData | ReservationData) & { id: string }, transaction?: FirebaseFirestore.Transaction) {
    const { propertyId, guestId } = data;
    const amountPaid = 'amount' in data ? data.amount : data.totalPrice ?? 0;
    const invoiceNumber = 'invoiceNumber' in data ? data.invoiceNumber : data.reservationNumber;

    if (!guestId) {
        logger.log(`Invoice/Reservation ${data.id || ''} is missing guestId. Cannot process post-payment actions.`);
        return;
    }
    
    const guestRef = db.doc(`guests/${guestId}`);
    const guestDoc = transaction ? await transaction.get(guestRef) : await guestRef.get();

    if (!guestDoc.exists) {
        logger.log(`Guest ${guestId} not found.`);
        return;
    }
    
    const guestData = guestDoc.data();
    if (!guestData) return;
    
    // --- Loyalty Points Logic ---
    const reservationIsPaidWithPoints = 'paidWithPoints' in data && data.paidWithPoints;
    if (propertyData.loyaltyProgramSettings?.enabled && guestData?.loyaltyStatus === 'enrolled') {
        
        if (reservationIsPaidWithPoints) {
            const redemptionRate = propertyData.loyaltyProgramSettings.redemptionRate;
            if (redemptionRate && redemptionRate > 0 && amountPaid > 0) {
                const pointsRedeemed = parseFloat((amountPaid / redemptionRate).toFixed(2));
                if (pointsRedeemed > 0) {
                    const updatePayload = {
                        loyaltyPoints: FieldValue.increment(-pointsRedeemed),
                        totalPointsRedeemed: FieldValue.increment(pointsRedeemed),
                    };
                    if (transaction) {
                        transaction.update(guestRef, updatePayload);
                    } else {
                        await guestRef.update(updatePayload);
                    }
                    logger.log(`Redeemed ${pointsRedeemed.toFixed(2)} points for guest ${guestId}`);
                }
            }
        } else {
            const earningRate = propertyData.loyaltyProgramSettings.earningRate;
            if (earningRate !== undefined && earningRate > 0 && amountPaid > 0) {
                const pointsEarned = amountPaid / earningRate; 
                if (pointsEarned > 0) {
                    const historyRef = guestRef.collection("loyaltyHistory").doc();
                    const loyaltyHistoryEntry: LoyaltyHistoryEntry = {
                        date: FieldValue.serverTimestamp(),
                        change: pointsEarned,
                        reason: `Payment for Invoice: ${invoiceNumber}`,
                    };

                    const updatePayload = {
                        loyaltyPoints: FieldValue.increment(pointsEarned),
                        totalPointsEarned: FieldValue.increment(pointsEarned),
                    };

                    if (transaction) {
                        transaction.update(guestRef, updatePayload);
                        transaction.set(historyRef, loyaltyHistoryEntry);
                    } else {
                        const batch = db.batch();
                        batch.update(guestRef, updatePayload);
                        batch.set(historyRef, loyaltyHistoryEntry);
                        await batch.commit();
                    }
                    logger.log(`Awarded ${pointsEarned.toFixed(2)} points to guest ${guestId}`);
                }
            }
        }
    }


    if(transaction) {
        return; // Email notifications must happen outside the transaction
    }

    // --- In-App Notification Logic (can be outside transaction if needed) ---
    if (propertyData.notificationSettings?.payment_received?.channels?.inApp) {
        const notificationRef = db.collection("notifications").doc();
        await notificationRef.set({
            propertyId,
            title: "Payment Received",
            description: `Payment for Invoice ${invoiceNumber} of ${propertyData.currency || "$"}${amountPaid.toFixed(2)} recorded.`,
            type: "payment_received",
            relatedDocId: data.id,
            read: false,
            createdAt: Timestamp.now(),
        });
    }

    // --- Email Notification Logic ---
    if (guestData?.email && propertyData.notificationSettings?.payment_received?.channels?.email) {
        const emailVariables = {
            guest_name: guestData.fullName || "Valued Guest",
            invoice_number: invoiceNumber || "N/A",
            invoice_amount: `${propertyData.currency || "$"}${amountPaid.toFixed(2)}`,
        };
        await sendTemplatedEmail(propertyData, "payment_confirmation", guestData.email, emailVariables);
    }
}


/**
 * Creates a new payment record in Firestore.
 */
exports.createPayment = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request: CallableRequest<any>) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be authenticated.");
    }

    const {
        propertyId,
        amountReceived,
        paymentMethod,
        paymentDate,
        guestName,
        invoiceId,
        reservationNumber, // Now receiving reservationNumber
        notes,
    } = request.data;
    
    if (!propertyId || !amountReceived || !paymentMethod || !paymentDate || !guestName) {
        throw new HttpsError("invalid-argument", "Missing required fields for payment creation.");
    }
    
    let reservationId: string | null = null;
    let guestId: string | null = null;

    if (reservationNumber) {
        const resQuery = db.collection("reservations")
            .where("propertyId", "==", propertyId)
            .where("reservationNumber", "==", reservationNumber)
            .limit(1);
        const snapshot = await resQuery.get();
        if (!snapshot.empty) {
            reservationId = snapshot.docs[0].id;
            guestId = snapshot.docs[0].data().guestId || null;
        } else {
            logger.warn(`Could not find reservation with number: ${reservationNumber}`);
        }
    }


    try {
        const newPaymentRef = db.collection(`payments/${propertyId}`).doc();
        const paymentData = {
            propertyId,
            guestName,
            amountPaid: Number(amountReceived),
            paymentMethod,
            date: paymentDate, // Expecting "yyyy-MM-dd"
            status: "Paid", // Manual payments are considered paid
            invoiceId: invoiceId || null,
            reservationId: reservationId, // Store the resolved reservationId
            reservationNumber: reservationNumber || null,
            notes: notes || `Manual payment recorded by ${request.auth.token.name || request.auth.uid}`,
            createdAt: FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
            guestId,
        };

        await newPaymentRef.set(paymentData);

        return { success: true, paymentId: newPaymentRef.id };

    } catch (error) {
        logger.error("Error creating manual payment:", error);
        throw new HttpsError("internal", "Could not record the payment.");
    }
});

/**
 * Handles processing a refund for a given payment.
 */
exports.createRefund = onCall({ memory: "512MiB" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated.");
  }
  
  const uid = request.auth.uid;
  const staffDoc = await db.collection("staff").doc(uid).get();
  if (!staffDoc.exists || staffDoc.data()?.permissions?.finance !== true) {
    throw new HttpsError("permission-denied", "You do not have permission to process refunds.");
  }

  const { propertyId, originalPaymentId, refundAmount, reason } = request.data;
  if (!propertyId || !originalPaymentId || !refundAmount || !reason) {
    throw new HttpsError("invalid-argument", "Missing required fields for refund.");
  }
  
  const originalPaymentRef = db.doc(`properties/${propertyId}/payments/${originalPaymentId}`);
  
  try {
    await db.runTransaction(async (transaction) => {
      const originalPaymentDoc = await transaction.get(originalPaymentRef);
      if (!originalPaymentDoc.exists) {
        throw new HttpsError("not-found", "Original payment not found.");
      }
      
      const originalPaymentData = originalPaymentDoc.data() as PaymentData;
      if (originalPaymentData.status !== "Paid") {
          throw new HttpsError("failed-precondition", "Only 'Paid' payments can be refunded.");
      }
      if (refundAmount > originalPaymentData.amountPaid) {
          throw new HttpsError("invalid-argument", "Refund amount cannot exceed the original payment amount.");
      }
      
      // 1. Create a new "refund" payment record
      const newRefundRef = db.collection(`properties/${originalPaymentData.propertyId}/payments`).doc();
      const refundPaymentData: PaymentData = {
          ...originalPaymentData,
          id: newRefundRef.id,
          amountPaid: -Math.abs(refundAmount), // Ensure it's a negative value
          status: 'Refunded',
          isRefund: true,
          originalPaymentId: originalPaymentId,
          notes: `Refund for payment ${originalPaymentData.paymentNumber || originalPaymentId}. Reason: ${reason}`,
          createdAt: Timestamp.now(),
      };
      transaction.set(newRefundRef, refundPaymentData);
      
      // 2. Update the original payment status
      transaction.update(originalPaymentRef, { status: 'Refunded' });
      
      // 3. Update associated invoice if it exists
      if (originalPaymentData.invoiceId) {
        const invoiceRef = db.doc(`invoices/${originalPaymentData.invoiceId}`);
        transaction.update(invoiceRef, { 
            amount: FieldValue.increment(-Math.abs(refundAmount)),
            paymentStatus: 'Refunded', // Or logic for partial refund
        });
      }
    });
    
    return { success: true, message: "Refund processed successfully." };
    
  } catch (error: any) {
    logger.error("Error creating refund:", error);
    if (error instanceof HttpsError) {
        throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred while processing the refund.");
  }
});


/**
 * Triggered when an invoice is updated, to sync its status with the reservation.
 * If the new status is 'Paid', it also triggers post-payment logic like loyalty points.
 */
exports.onInvoicePaid = onDocumentUpdated("invoices/{invoiceId}", async (event) => {
    const beforeData = event.data?.before.data() as InvoiceData | undefined;
    const afterData = event.data?.after.data() as InvoiceData | undefined;

    if (!beforeData || !afterData || beforeData.paymentStatus === afterData.paymentStatus) {
        return;
    }
    
    const { propertyId, reservationId, paymentStatus } = afterData;

    try {
        const batch = db.batch();
        
        // Sync Invoice status change to Reservation
        if (reservationId) {
            const reservationRef = db.doc(`reservations/${reservationId}`);
            batch.update(reservationRef, { paymentStatus: paymentStatus });
        }

        // If the invoice is now marked as "Paid"
        if (afterData.paymentStatus === "Paid" && beforeData.paymentStatus !== "Paid") {
            const propertyDoc = await db.doc(`properties/${propertyId}`).get();
            if (propertyDoc.exists) {
                const propertyData = propertyDoc.data() as PropertyData;
                // This call must be outside a transaction to allow email sending
                await onInvoicePaidLogic(propertyData, { ...afterData, id: event.params.invoiceId });
            }

            // Also ensure the related Payment record is updated to 'Paid'
            if (reservationId) {
                const paymentsQuery = db.collection(`properties/${propertyId}/payments`)
                    .where("reservationId", "==", reservationId)
                    .limit(1);
                const paymentSnapshot = await paymentsQuery.get();
                if (!paymentSnapshot.empty) {
                    const paymentDocRef = paymentSnapshot.docs[0].ref;
                    batch.update(paymentDocRef, {
                        status: 'Paid',
                        amountPaid: afterData.amount, // Set amount from invoice
                    });
                }
            }
        }
        
        await batch.commit();

    } catch (error) {
        logger.error(`Failed to process status sync for invoice ${event.params.invoiceId}:`, error);
    }
});


/**
 * Triggered when a payment is updated. If status becomes 'Paid', it syncs
 * the status with the corresponding Reservation and Invoice.
 */
exports.onPaymentUpdate = onDocumentUpdated("payments/{paymentId}", async (event) => {
    const beforeData = event.data?.before.data() as PaymentData;
    const afterData = event.data?.after.data() as PaymentData;
    const paymentId = event.params.paymentId;

    if (!afterData || beforeData?.status === "Paid" || afterData.status !== "Paid") {
        logger.log(`Payment ${paymentId} status not updated to "Paid". No action.`);
        return;
    }

    const { propertyId, invoiceId, reservationId } = afterData;

    try {
        const batch = db.batch();

        if (invoiceId) {
            const invoiceRef = db.doc(`invoices/${invoiceId}`);
            batch.update(invoiceRef, { paymentStatus: 'Paid', updatedAt: FieldValue.serverTimestamp() });
        }
        
        if (reservationId) {
            const reservationRef = db.doc(`reservations/${reservationId}`);
            batch.update(reservationRef, { paymentStatus: 'Paid', updatedAt: FieldValue.serverTimestamp() });
        }

        await batch.commit();

        logger.log(`Synced "Paid" status from payment ${paymentId} to related documents.`);

        // Now, trigger the post-payment logic using the invoice data
        if (invoiceId) {
            const invoiceDoc = await db.doc(`invoices/${invoiceId}`).get();
            if (invoiceDoc.exists) {
                const propertyDoc = await db.doc(`properties/${propertyId}`).get();
                if (propertyDoc.exists) {
                    await onInvoicePaidLogic(
                        propertyDoc.data() as PropertyData, 
                        { id: invoiceId, ...invoiceDoc.data() } as InvoiceData
                    );
                }
            }
        }

    } catch (error) {
        logger.error(`Error syncing payment status for payment ${paymentId}:`, error);
    }
});


/**
 * Triggered on reservation update. Syncs payment status changes and handles cancellations.
 */
exports.onReservationUpdate = onDocumentUpdated("reservations/{reservationId}",
  async (event) => {
    const beforeData = event.data?.before.data() as ReservationData;
    const afterData = event.data?.after.data() as ReservationData;
    if (!beforeData || !afterData) {
      return;
    }
    const reservationId = event.params.reservationId;

    // --- Handle Payment Status Change ---
    if (beforeData.paymentStatus !== afterData.paymentStatus) {
        const { propertyId, guestId, totalPrice, paidWithPoints, paymentStatus } = afterData;

        // Update the associated invoice
        const invoiceDocRef = db.doc(`invoices/${reservationId}`);
        await invoiceDocRef.update({ paymentStatus: paymentStatus });
        
        // If status changed to 'Paid', handle post-payment logic
        if (paymentStatus === "Paid" && beforeData.paymentStatus !== "Paid") {
          const paymentsQuery = db.collection(`properties/${propertyId}/payments`).where("reservationId", "==", reservationId).limit(1);
          const paymentSnapshot = await paymentsQuery.get();
          
          if (!paymentSnapshot.empty) {
            const paymentDocRef = paymentSnapshot.docs[0].ref;
            const paymentUpdateData: any = { status: 'Paid', amountPaid: totalPrice };
            if (paidWithPoints) {
                paymentUpdateData.paymentMethod = 'Loyalty Points';
            }
            await paymentDocRef.update(paymentUpdateData);
          }
          
          if (guestId) {
            try {
              const propertyDoc = await db.doc(`properties/${propertyId}`).get();
              if (propertyDoc.exists) {
                const propertyData = propertyDoc.data() as PropertyData;
                await onInvoicePaidLogic(propertyData, { ...afterData, id: reservationId });
              }
            } catch (error) {
              logger.error(`Failed to process loyalty points for reservation ${reservationId} on payment status update:`, error);
            }
          }
        }
    }


    // --- Handle Reservation Cancellation ---
    if (beforeData.status !== "Canceled" && afterData.status === "Canceled") {
      const {propertyId, guestName, guestEmail, reservationNumber, startDate, endDate} = afterData;

      try {
        const propDoc = await db.doc(`properties/${propertyId}`).get();
        if (!propDoc.exists) {
          throw new Error(`Property ${propertyId} not found.`);
        }
        const propertyData = propDoc.data() as PropertyData;
        const notificationSettings = propertyData.notificationSettings || {};

        if (notificationSettings.cancellation?.channels?.inApp) {
          const notificationRef = db.collection("notifications").doc();
          await notificationRef.set({
            propertyId,
            title: "Reservation Cancelled",
            description: `Reservation ${reservationNumber || reservationId.substring(0, 8)} for ${guestName} has been cancelled.`,
            type: "cancellation",
            relatedDocId: reservationId,
            read: false,
            createdAt: Timestamp.now(),
          });
        }
        
        // --- Send INTERNAL email alert to property ---
        if (propertyData.email && notificationSettings.cancellation?.channels?.email) {
            const emailVariables = {
                guest_name: guestName || "Valued Guest",
                reservation_number: reservationNumber || reservationId,
                check_in_date: format(startDate.toDate(), "PP"),
                check_out_date: format(endDate.toDate(), "PP"),
            };
            await sendTemplatedEmail(
                propertyData,
                "internal_cancellation_alert", // Use the new internal template
                propertyData.email, // Send to property email
                emailVariables
            );
        }

        // --- Send EXTERNAL email to guest (using a different template) ---
        if (guestEmail && notificationSettings.cancellation?.channels?.email) {
          const emailVariables = {
            guest_name: guestName || "Valued Guest",
            reservation_code: reservationNumber || reservationId,
          };
          await sendTemplatedEmail(
            propertyData,
            "reservation_cancellation", // This is the guest-facing template
            guestEmail, // Send to guest email
            emailVariables,
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : JSON.stringify(error);
        logger.error(
          `Failed to process cancellation for reservation ${reservationId}:`,
          errorMessage,
        );
      }
    }
  });


/**
 * Creates a user in Firebase Auth and a corresponding staff document in
 * Firestore. Must be called by an authenticated admin user.
 */
exports.createStaffUser = onCall({ memory: "512MiB" }, async (request: CallableRequest<{
    email: string;
    password?: string;
    fullName: string;
    role: string;
    permissions: unknown;
    propertyId: string;
    phone?: string;
  }>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated.");
    }
    const adminUid = request.auth.uid;
    const adminDoc = await db.collection("staff").doc(adminUid).get();
    
    if (!adminDoc.exists) {
        throw new HttpsError("not-found", "Admin user profile not found.");
    }
    const adminData = adminDoc.data() as StaffData;
    if (adminData.permissions?.staffManagement !== true) {
      throw new HttpsError("permission-denied", "Must have staff permissions.");
    }

    const {
      email, password, fullName, role, permissions, propertyId, phone,
    } = request.data;
    if (
      !email || !password || !fullName || !role || !permissions || !propertyId
    ) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    try {
      const userRecord = await getAuth().createUser({
        email: email,
        password: password,
        displayName: fullName,
        emailVerified: false,
      });

      const staffDocRef = db.collection("staff").doc(userRecord.uid);
      await staffDocRef.set({
        uid: userRecord.uid,
        fullName,
        email,
        role,
        permissions,
        propertyId,
        phone: phone || "",
        status: "Active",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: adminUid,
      });
      return {success: true, uid: userRecord.uid};
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message: string };
      logger.error("Error creating staff user:", firebaseError);
      if (firebaseError.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "Email is already in use.");
      }
      if (firebaseError.code === "auth/invalid-password") {
        throw new HttpsError(
          "invalid-argument", "Password must be >= 6 chars.",
        );
      }
      throw new HttpsError("internal", firebaseError.message);
    }
  });

/**
* Creates or updates a non-login staff member record in Firestore.
*/
exports.saveStaffMember = onRequest({ memory: "512MiB", region: "europe-west1" }, async (request, response) => {
  // This wrapper is essential for handling preflight OPTIONS requests.
  corsHandler(request, response, async () => {
    // We only want to execute logic for POST requests.
    if (request.method !== 'POST') {
      response.status(405).send({ error: 'Method Not Allowed' });
      return;
    }
    
    // Manually checking auth tokens for onRequest functions.
    if (!request.headers.authorization || !request.headers.authorization.startsWith('Bearer ')) {
      response.status(403).send({ error: 'Unauthorized' });
      return;
    }

    const idToken = request.headers.authorization.split('Bearer ')[1];
    
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      response.status(403).send({ error: 'Unauthorized' });
      return;
    }

    const adminUid = decodedToken.uid;
    const adminDoc = await db.collection("staff").doc(adminUid).get();
    
    if (!adminDoc.exists || !adminDoc.data()?.permissions?.staffManagement) {
      response.status(403).send({ error: 'Permission Denied' });
      return;
    }

    const { staffData, staffId } = request.body.data;

    if (!staffData || !staffData.fullName || !staffData.propertyId) {
      response.status(400).send({ error: 'Missing required staff data.' });
      return;
    }
    
    const payload: any = { ...staffData };

    try {
      if (staffId) {
        // Update existing staff member
        const staffDocRef = db.collection("staff").doc(staffId);
        payload.updatedAt = FieldValue.serverTimestamp();
        await staffDocRef.update(payload);
        response.status(200).send({ data: { success: true, id: staffId } });
      } else {
        // Create new staff member
        const newStaffDocRef = db.collection("staff").doc();
        payload.createdAt = FieldValue.serverTimestamp();
        payload.updatedAt = FieldValue.serverTimestamp();
        await newStaffDocRef.set(payload);
        response.status(200).send({ data: { success: true, id: newStaffDocRef.id } });
      }
    } catch (error) {
      logger.error("Error creating/updating staff member:", error);
      response.status(500).send({ error: 'Failed to save staff member record.' });
    }
  });
});


/**
 * Verifies SMTP credentials by attempting to create a connection.
 */
exports.verifySmtp = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request: CallableRequest<{
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
  }>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated.");
    }
    
    const staffDoc = await db.collection("staff").doc(request.auth.uid).get();
    if (!staffDoc.exists) {
        throw new HttpsError("not-found", "User staff profile not found.");
    }
    const staffData = staffDoc.data() as StaffData;
    if (staffData.permissions?.settings !== true) {
        throw new HttpsError("permission-denied", "Must have settings permissions.");
    }

    const {smtpHost, smtpPort, smtpUser, smtpPass} = request.data;
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      throw new HttpsError("invalid-argument", "Missing SMTP credentials.");
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    try {
      await transporter.verify();
      logger.log("SMTP Connection Verified for user:", request.auth.uid);
      return {success: true, message: "SMTP connection verified successfully!"};
    } catch (error) {
      logger.error(
        "SMTP Verification Failed for user:", request.auth.uid, error,
      );
      const message =
        error instanceof Error ?
        error.message :
        "An unknown error occurred during verification.";
      const errorMessage = `SMTP verification failed: ${message}`;
      throw new HttpsError("internal", errorMessage);
    }
  });


/**
 * Verifies IMAP credentials by attempting to connect and then disconnecting.
 */
exports.verifyImap = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User not authenticated.");
    }

    const staffDoc = await db.collection("staff").doc(request.auth.uid).get();
    if (!staffDoc.exists || staffDoc.data()?.permissions?.guests !== true) {
        throw new HttpsError("permission-denied", "User does not have permission.");
    }

    const { imapHost, imapPort, imapUser, imapPass, useTls } = request.data;
    if (!imapHost || !imapPort || !imapUser || !imapPass) {
        throw new HttpsError("invalid-argument", "Missing required IMAP credential fields.");
    }

    const config = {
        imap: {
            user: imapUser,
            password: imapPass,
            host: imapHost,
            port: imapPort,
            tls: useTls,
            authTimeout: 5000,
        },
    };

    try {
        const connection = await imaps.connect(config);
        await connection.end();
        logger.log("IMAP Connection Verified for user:", request.auth.uid);
        return { success: true, message: "IMAP connection verified!" };
    } catch (error) {
        logger.error("IMAP Verification Failed:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new HttpsError("internal", `IMAP verification failed: ${message}`);
    }
});


/**
 * Saves communication settings to the property document in Firestore.
 */
exports.saveCommunicationSettings = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request: CallableRequest<{
    imapSettings?: any;
    smtpSettings?: any;
}>) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be authenticated.");
    }
    const uid = request.auth.uid;
    const staffDoc = await db.collection("staff").doc(uid).get();
    
    if (!staffDoc.exists) {
        throw new HttpsError("not-found", "User staff profile not found.");
    }
    const staffData = staffDoc.data() as StaffData;
    if (staffData?.permissions?.settings !== true) {
        throw new HttpsError("permission-denied", "Must have settings permissions.");
    }
    const propertyId = staffDoc.data()?.propertyId;
    if (!propertyId) {
        throw new HttpsError("failed-precondition", "User is not associated with a property.");
    }

    const { imapSettings, smtpSettings } = request.data;
    if (!imapSettings && !smtpSettings) {
        throw new HttpsError("invalid-argument", "Missing communication settings.");
    }
    
    const propRef = db.doc(`properties/${propertyId}`);
    const dataToUpdate: {[key: string]: any} = {
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (imapSettings) {
      if (!imapSettings.imapHost || !imapSettings.imapPort || !imapSettings.imapUser || !imapSettings.imapPass) {
        throw new HttpsError("invalid-argument", "Missing required IMAP fields.");
      }
      dataToUpdate['imapConfiguration'] = {
            host: imapSettings.imapHost,
            port: Number(imapSettings.imapPort),
            user: imapSettings.imapUser,
            pass: imapSettings.imapPass, // Warning: Plaintext.
            useTls: imapSettings.useTls,
      };
    }
    
    if (smtpSettings) {
       if (!smtpSettings.smtpHost || !smtpSettings.smtpPort || !smtpSettings.smtpUser || !smtpSettings.smtpPass) {
        throw new HttpsError("invalid-argument", "Missing required SMTP fields.");
      }
       dataToUpdate['emailConfiguration'] = {
            smtpHost: smtpSettings.smtpHost,
            smtpPort: Number(smtpSettings.smtpPort),
            smtpUser: smtpSettings.smtpUser,
            smtpPass: smtpSettings.smtpPass, // Warning: Plaintext.
            fromName: smtpSettings.fromName,
      };
    }
    
    try {
        await propRef.update(dataToUpdate);
        return {success: true, message: "Communication settings saved successfully."};
    } catch (error) {
        logger.error("Error saving communication settings:", error);
        throw new HttpsError("internal", "Failed to save settings to the database.");
    }
});


/**
 * Sends an invoice email to a guest using configured SMTP settings.
 */
exports.sendInvoiceByEmail = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request: CallableRequest<{
    propertyId: string;
    invoice: InvoiceData;
    recipientEmail: string;
    pdfDataUri: string;
  }>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated.");
    }

    const {
      propertyId, invoice, recipientEmail, pdfDataUri,
    } = request.data;
    if (!propertyId || !invoice || !recipientEmail || !pdfDataUri) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    const propDocRef = db.doc(`properties/${propertyId}`);
    const propDocSnap = await propDocRef.get();
    if (!propDocSnap.exists) {
      throw new HttpsError("not-found", "Property configuration not found.");
    }
    const propertyData = propDocSnap.data() as PropertyData;

    // Fetch reservation data to get more details for variables
    let reservationData: ReservationData | null = null;
    if (invoice.reservationId) {
        const resDocRef = db.doc(`reservations/${invoice.reservationId}`);
        const resDocSnap = await resDocRef.get();
        if (resDocSnap.exists) {
            reservationData = resDocSnap.data() as ReservationData;
        }
    }
    
    const currencySymbol = propertyData.currency || "$";
    const nights = reservationData ? differenceInDays(reservationData.endDate.toDate(), reservationData.startDate.toDate()) : (invoice.numberOfNights || 0);
    const guests = reservationData ? ((reservationData.adults || 0) + (reservationData.children || 0)) : (invoice.numberOfGuests || 0);
    let extrasText = "";
    if (reservationData?.selectedExtras && reservationData.selectedExtras.length > 0) {
        extrasText += "\n\n--- Extras ---";
        reservationData.selectedExtras.forEach((extra) => {
            const { price: unitPrice, quantity, unit, name } = extra;
            let itemTotal = 0;
            switch(unit) {
                case 'one_time':
                case 'per_booking':
                case 'one_time_per_room':
                    itemTotal = unitPrice * quantity;
                    break;
                case 'per_night':
                case 'per_night_per_room':
                    itemTotal = unitPrice * nights * quantity;
                    break;
                case 'per_guest':
                case 'one_time_per_guest':
                    itemTotal = unitPrice * guests * quantity;
                    break;
                case 'per_night_per_guest':
                    itemTotal = unitPrice * nights * guests * quantity;
                    break;
                default:
                    itemTotal = unitPrice * quantity;
            }
            extrasText += `\n- ${name} (x${quantity}): ${currencySymbol}${itemTotal.toFixed(2)}`;
        });
    }

    const emailVariables: {[key: string]: string | number | undefined} = {
        guest_name: invoice.guestOrCompany || "Valued Guest",
        reservation_code: reservationData?.id || invoice.reservationId || "N/A",
        reservation_number: reservationData?.reservationNumber || invoice.reservationId?.substring(0, 8),
        check_in_date: invoice.checkInDate ? format(parseISO(invoice.checkInDate), "PP") : (reservationData ? format(reservationData.startDate.toDate(), "PP") : "N/A"),
        check_out_date: invoice.checkOutDate ? format(parseISO(invoice.checkOutDate), "PP") : (reservationData ? format(reservationData.endDate.toDate(), "PP") : "N/A"),
        room_type: invoice.roomTypeName || reservationData?.roomTypeName || "N/A",
        room_number: reservationData?.roomName || "N/A",
        number_of_nights: nights,
        number_of_guests: guests,
        price_per_night: `${currencySymbol}${(invoice.pricePerNight || 0).toFixed(2)}`,
        total_price: `${currencySymbol}${invoice.amount.toFixed(2)}`,
        total_taxes: `${currencySymbol}${(invoice.taxAmount || 0).toFixed(2)}`,
        invoice_number: invoice.invoiceNumber,
        invoice_amount: `${currencySymbol}${invoice.amount.toFixed(2)}`,
        invoice_due_date: invoice.dueDate ? format(parseISO(invoice.dueDate), 'PP') : "N/A",
        extras: extrasText,
    };
    
    const attachments: nodemailer.SendMailOptions['attachments'] = [
      {
        filename: `invoice-${invoice.invoiceNumber}.pdf`,
        path: pdfDataUri,
      },
    ];

    try {
        await sendTemplatedEmail(propertyData, 'invoice_email', recipientEmail, emailVariables, attachments);
        logger.log(`Invoice email sent successfully to ${recipientEmail}.`);
        return { success: true, message: "Email sent successfully!" };
    } catch (error) {
        logger.error("Error sending invoice email via sendTemplatedEmail:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new HttpsError("internal", `Failed to send email: ${errorMessage}`);
    }
  });


/**
 * Sends a reply email using configured SMTP settings.
 */
exports.sendReplyByEmail = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be authenticated.");
    }
    const {propertyId, to, subject, htmlBody, attachments} = request.data;
    if (!propertyId || !to || !subject || !htmlBody) {
        throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    const propDocRef = db.doc(`properties/${propertyId}`);
    const propDocSnap = await propDocRef.get();
    if (!propDocSnap.exists) {
        throw new HttpsError("not-found", "Property configuration not found.");
    }

    const propertyData = propDocSnap.data() as PropertyData;
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
        logger.log(`Reply email sent successfully to ${to}.`);
        return {success: true, message: "Email sent successfully!"};
    } catch (error) {
        logger.error("Error sending reply email:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new HttpsError("internal", `Failed to send email: ${errorMessage}`);
    }
});


/**
 * Sends an email composed by a staff member.
 */
exports.sendComposedEmail = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request) => {
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

    const propertyData = propDocSnap.data() as PropertyData;
    const emailConfig = propertyData.emailConfiguration;

    if (!emailConfig?.smtpHost || !emailConfig.smtpUser || !emailConfig.smtpPass) {
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


/**
 * Deletes a staff user from Firebase Auth and their Firestore document.
 */
exports.deleteStaffUser = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request: CallableRequest<{uid: string}>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated.");
    }
    const adminUid = request.auth.uid;
    const adminDoc = await db.collection("staff").doc(adminUid).get();

    if (!adminDoc.exists) {
        throw new HttpsError("not-found", "Admin user profile not found.");
    }
    const adminData = adminDoc.data() as StaffData;
    if (adminData.permissions?.staffManagement !== true) {
      throw new HttpsError("permission-denied", "Must have staff permissions.");
    }

    const uidToDelete = request.data.uid;
    if (!uidToDelete || typeof uidToDelete !== "string") {
      throw new HttpsError("invalid-argument", "Function must have 'uid'.");
    }
    if (uidToDelete === adminUid) {
      throw new HttpsError(
        "permission-denied", "Cannot delete your own account.",
      );
    }
    // Attempt to delete user and staff document in parallel or sequence
    try {
      await getAuth().deleteUser(uidToDelete);
      logger.log(
        `Successfully deleted user ${uidToDelete} from Firebase Auth.`,
      );

      const staffDocRef = db.collection("staff").doc(uidToDelete);
      await staffDocRef.delete();
      logger.log(`Successfully deleted staff document for ${uidToDelete}.`);
      return {
        success: true,
        message: `Successfully deleted staff member ${uidToDelete}.`,
      };
    } catch (error) {
      const firebaseError = error as { message?: string };
      logger.error(`Error deleting staff user ${uidToDelete}:`, error);
      const errorMessage =
        firebaseError.message ||
        "An unexpected error occurred while deleting the user.";
      throw new HttpsError("internal", errorMessage);
    }
  });


exports.fetchImageProxy = onRequest({ region: 'europe-west1', memory: '512MiB' }, (request, response) => {
  // This should be the first thing in the function
  corsHandler(request, response, async () => {
    // Only allow POST requests for the actual function logic.
    if (request.method !== 'POST') {
      response.status(405).send({ error: 'Method Not Allowed' });
      return;
    }
    
    // Correctly access the URL from request.body.data for `httpsCallable`
    const url = request.body.data?.url;
    if (!url) {
      response.status(400).send({ error: "An image URL must be provided in the data payload."});
      return;
    }

    try {
      const bucket = getStorage().bucket();
      const decodedUrl = decodeURIComponent(url);
      const pathRegex = /o\/(.*?)\?alt=media/;
      const match = decodedUrl.match(pathRegex);

      if (!match || !match[1]) {
        throw new Error('Invalid Firebase Storage URL format. Could not extract file path.');
      }

      const filePath = match[1];
      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      if (!exists) {
          response.status(404).send({ error: `File not found at path: ${filePath}`});
          return;
      }

      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType || 'image/png';
      const [buffer] = await file.download();
      const base64 = buffer.toString('base64');
      const dataUri = `data:${contentType};base64,${base64}`;

      response.status(200).send({ data: { dataUri } });

    } catch (error: any) {
      logger.error("Error converting image to data URI:", error);
      response.status(500).send({ error: error.message || "Failed to process image." });
    }
  });
});


/**
 * Deletes a conversation and all its messages.
 */
exports.deleteConversation = onCall({ region: 'europe-west1', memory: '512MiB' },
  async (request: CallableRequest<{conversationId: string}>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated.");
    }
    const uid = request.auth.uid;
    const {conversationId} = request.data;
    if (!conversationId) {
      throw new HttpsError("invalid-argument", "Must have 'conversationId'.");
    }

    const conversationRef = db.doc(`conversations/${conversationId}`);
    const conversationDoc = await conversationRef.get();
    if (!conversationDoc.exists) {
      throw new HttpsError("not-found", "Conversation not found.");
    }
    const conversationData = conversationDoc.data();
    if (!conversationData?.participants.includes(uid)) {
      throw new HttpsError("permission-denied", "Not a participant.");
    }

    try {
      const messagesRef = conversationRef.collection("messages");
      const messagesSnapshot = await messagesRef.get();
      const batch = db.batch();
      messagesSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      batch.delete(conversationRef);
      await batch.commit();
      logger.log("Conversation", conversationId, "deleted by user", uid);
      return {success: true};
    } catch (error) {
      logger.error(`Error deleting conversation ${conversationId}:`, error);
      throw new HttpsError("internal", "Failed to delete conversation.");
    }
  });


/**
 * [PUBLIC] Checks room type availability for a given date range.
 */
exports.checkAvailability = onRequest({ region: 'europe-west1', memory: '512MiB' }, async (request, response) => {
    corsHandler(request, response, async () => {
        if (request.method !== 'POST') {
            response.status(405).send({ error: 'Method Not Allowed' });
            return;
        }

        const { propertySlug, startDate, endDate, adults, children, } = request.body.data;
        if (!propertySlug || !startDate || !endDate) {
            response.status(400).send({ error: "Missing required fields." });
            return;
        }
        
        const propertyQuery = db.collection("properties").where("slug", "==", propertySlug).limit(1);
        const propertySnapshot = await propertyQuery.get();
        if (propertySnapshot.empty) {
            response.status(404).send({ error: "Property not found." });
            return;
        }
        const propertyId = propertySnapshot.docs[0].id;
        
        const requestedFrom = startOfDay(parseISO(startDate));
        const requestedTo = startOfDay(parseISO(endDate));

        if (!isValid(requestedFrom) || !isValid(requestedTo)) {
            response.status(400).send({ error: "Invalid date format provided. Please use ISO 8601 format." });
            return;
        }

        if (requestedFrom >= requestedTo) {
            response.status(400).send({ error: "End date must be after start." });
            return;
        }
        try {
          // Fetch all necessary data in parallel
          const roomsQuery = db.collection("rooms")
            .where("propertyId", "==", propertyId);
          const roomTypesQuery = db.collection("roomTypes")
            .where("propertyId", "==", propertyId);
          const ratePlansQuery = db.collection("ratePlans")
            .where("propertyId", "==", propertyId);
          const reservationsQuery = db.collection("reservations")
            .where("propertyId", "==", propertyId)
            .where("status", "in", ["Confirmed", "Pending", "Checked-in"]);
          const availabilitySettingsPromise = db.collection("availability")
            .where("propertyId", "==", propertyId).get();

          const [
            roomsSnapshot,
            roomTypesSnapshot,
            ratePlansSnapshot,
            reservationsSnapshot,
            availabilitySettingsSnapshot,
          ] = await Promise.all([
            roomsQuery.get(),
            roomTypesQuery.get(),
            ratePlansQuery.get(),
            reservationsQuery.get(),
            availabilitySettingsPromise,
          ]);
          const allRooms = roomsSnapshot.docs.map((d) => ({
            id: d.id, ...d.data(),
          } as BackendRoom));
          const allRoomTypes = roomTypesSnapshot.docs.map((d) => ({
            id: d.id, ...d.data(),
          } as BackendRoomType));
          const allRatePlans = ratePlansSnapshot.docs.map((d) => ({
            id: d.id, ...d.data(),
          } as BackendRatePlan));
          const existingReservations = reservationsSnapshot.docs.map((d) => {
            const data = d.data();
            return {
              ...data,
              id: d.id,
              startDate: (data.startDate as Timestamp).toDate(),
              endDate: (data.endDate as Timestamp).toDate(),
            } as BackendReservation;
          });
          const availabilitySettings = availabilitySettingsSnapshot.docs
            .map((d) => d.data() as BackendAvailabilitySetting);
            
          const results = [];
          const totalGuests = (adults || 0) + (children || 0);
          for (const rt of allRoomTypes) {
            if (totalGuests > rt.maxGuests) continue;
            const physicalRoomsForType = allRooms
              .filter((r) => r.roomTypeId === rt.id);
            if (physicalRoomsForType.length === 0) continue;

            const daysInReqRange = eachDayOfInterval({
              start: requestedFrom, end: addDays(requestedTo, -1),
            });
            
            const availablePhysicalRooms = physicalRoomsForType.filter((room) => {
                // For a room to be available, EVERY day in the range must be available
                return daysInReqRange.every(day => {
                    const dayStart = startOfDay(day);

                    // 1. Check against existing reservations
                    const isBooked = existingReservations.some((res) => 
                        res.roomId === room.id && 
                        dayStart >= startOfDay(res.startDate) &&
                        dayStart < startOfDay(res.endDate)
                    );
                    if (isBooked) return false;

                    // 2. Check against availability settings (new strict logic)
                    const applicableSettings = availabilitySettings
                        .filter(s => 
                            (s.roomId === room.id || (s.roomTypeId === rt.id && !s.roomId)) &&
                            isWithinInterval(dayStart, { start: parseISO(s.startDate), end: parseISO(s.endDate) })
                        )
                        .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

                    if (applicableSettings.length > 0) {
                        const latestSetting = applicableSettings[0];
                        // If the latest applicable setting is a block, it's unavailable.
                        // If it's 'available', it passes this check.
                        return latestSetting.status === 'available';
                    }

                    // 3. If no settings apply for this day, it is considered unavailable by default.
                    return false;
                });
            });


            if (availablePhysicalRooms.length > 0) {
                const ratePlansForType = allRatePlans.filter(rp => {
                    if (rp.roomTypeId !== rt.id) return false;
                    if (!rp.startDate || !rp.endDate) return true; // Always valid if no dates
                    const planStart = (rp.startDate as Timestamp).toDate();
                    const planEnd = (rp.endDate as Timestamp).toDate();
                    return startOfDay(planStart) <= requestedTo && startOfDay(planEnd) >= requestedFrom;
                });

                if (ratePlansForType.length === 0) continue;

                // Find the cheapest rate among all valid plans for the "From" price
                let cheapestRate = Infinity;
                ratePlansForType.forEach(rp => {
                    let currentRate = rt.baseRate ?? 0;
                     if (rp.pricingMethod === 'per_night') {
                        currentRate = rp.basePrice ?? currentRate;
                    } else if (rp.pricingMethod === 'per_guest') {
                        const guests = adults || 1;
                        if (rp.pricingPerGuest) {
                            currentRate = rp.pricingPerGuest[guests.toString()] ?? rp.pricingPerGuest['1'] ?? currentRate;
                        }
                    }
                    if (currentRate < cheapestRate) {
                        cheapestRate = currentRate;
                    }
                });

                results.push({
                    ...rt,
                    availableUnits: availablePhysicalRooms.length,
                    availableRooms: availablePhysicalRooms.map((r) => ({
                      id: r.id, name: r.name,
                    })),
                    cheapestRate: cheapestRate === Infinity ? (rt.baseRate ?? 0) : cheapestRate,
                    ratePlans: ratePlansForType, // Return all valid rate plans
                });
            }
          }
          response.send({ data: { availableRoomTypes: results } });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "An unknown error occurred.";
          logger.error("Error checking availability:", errorMessage);
          response.status(500).send({ error: "An unexpected error occurred." });
        }
    });
});

/**
 * [PUBLIC] Creates a reservation from the public booking page.
 */
exports.createBookingFromPage = onRequest({ region: 'europe-west1', memory: "512MiB" }, async (request, response) => {
  corsHandler(request, response, async () => {
      if (request.method !== 'POST') {
          return response.status(405).send({ error: "Method Not Allowed" });
      }

      const { propertySlug, guestData, bookingState } = request.body.data;

      if (!propertySlug || !guestData || !bookingState || !bookingState.selections || bookingState.selections.length === 0) {
          return response.status(400).send({ error: "Missing required data." });
      }

      const { selections, dateRange, guests, ...pricingDetails } = bookingState;

      const propertyQuery = db.collection("properties").where("slug", "==", propertySlug).limit(1);
      const propertySnapshot = await propertyQuery.get();
      if (propertySnapshot.empty) {
          return response.status(404).send({ error: "Property not found." });
      }
      
      const propertyId = propertySnapshot.docs[0].id;
      const propertyData = propertySnapshot.docs[0].data() as PropertyData;
      const defaultStatus = propertyData.bookingPageSettings?.defaultBookingStatus || "Pending";
      
      const mainSelection = selections[0];
      const requestedFrom = startOfDay(parseISO(dateRange.from));
      const requestedTo = parseISO(dateRange.to);

      try {
          const allGuestsSnapshot = await db.collection("guests")
              .where("propertyId", "==", propertyId)
              .get();

          const existingGuest = allGuestsSnapshot.docs.find(doc =>
              doc.data().email?.toLowerCase() === guestData.email.toLowerCase()
          );

          const { newReservationId } = await db.runTransaction(async (transaction) => {
              const reservationsQuery = db.collection("reservations")
                  .where("roomId", "==", mainSelection.roomId)
                  .where("status", "in", ["Confirmed", "Pending", "Checked-in"]);
              const reservationsSnapshot = await transaction.get(reservationsQuery);
              if (reservationsSnapshot.docs.some(d => requestedFrom < (d.data().endDate as Timestamp).toDate() && requestedTo > (d.data().startDate as Timestamp).toDate())) {
                  throw new HttpsError("failed-precondition", "This room is no longer available for the selected dates.");
              }

              let guestId;
              if (existingGuest) {
                  guestId = existingGuest.id;
              } else {
                  const newGuestRef = db.collection("guests").doc();
                  transaction.set(newGuestRef, {
                      fullName: guestData.fullName, email: guestData.email, phone: guestData.phone,
                      nationality: guestData.country || "", propertyId, loyaltyStatus: 'not-enrolled', loyaltyPoints: 0, totalPointsEarned: 0, totalPointsRedeemed: 0,
                      createdAt: FieldValue.serverTimestamp(),
                  });
                  guestId = newGuestRef.id;
              }
              
              const newReservationRef = db.collection("reservations").doc();
              const reservationId = newReservationRef.id;

              const payload: ReservationData = {
                  id: reservationId,
                  propertyId,
                  guestId,
                  guestName: guestData.fullName,
                  guestEmail: guestData.email,
                  guestPhone: guestData.phone,
                  guestCountry: guestData.country,
                  roomId: mainSelection.roomId,
                  roomName: mainSelection.roomName,
                  roomTypeId: mainSelection.roomTypeId,
                  roomTypeName: mainSelection.roomTypeName,
                  ratePlanId: mainSelection.ratePlanId,
                  ratePlanName: mainSelection.ratePlanName,
                  startDate: Timestamp.fromDate(requestedFrom),
                  endDate: Timestamp.fromDate(requestedTo),
                  adults: guests.adults,
                  children: guests.children,
                  status: defaultStatus,
                  paymentStatus: "Pending",
                  paidWithPoints: false,
                  source: "Direct",
                  notes: guestData.notes,
                  createdAt: FieldValue.serverTimestamp(),
                  
                  selectedExtras: bookingState.selectedExtras || [],
                  roomsTotal: pricingDetails.roomsTotal ?? 0,
                  extrasTotal: pricingDetails.extrasTotal ?? 0,
                  subtotal: pricingDetails.subtotal ?? 0,
                  discountAmount: pricingDetails.discountAmount ?? 0,
                  netAmount: pricingDetails.netAmount ?? 0,
                  taxAmount: pricingDetails.taxAmount ?? 0,
                  totalPrice: pricingDetails.totalPrice ?? 0,
                  priceBeforeDiscount: pricingDetails.priceBeforeDiscount ?? 0,
                  promotionApplied: bookingState.appliedPromotion || null,
                  packageInfo: mainSelection.packageDetails || null,
                  isCheckedOut: false
              };
              
              transaction.set(newReservationRef, payload);
              return { newReservationId: reservationId };
          });
          
          return response.status(200).send({ data: { success: true, reservationId: newReservationId } });

      } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "An unknown error.";
          logger.error("Booking transaction failed:", errorMessage);
          if (error instanceof HttpsError) {
              return response.status(400).send({ error: error.message, code: error.code });
          } else {
              return response.status(500).send({ error: "Could not complete the booking." });
          }
      }
  });
});



/**
 * [PUBLIC] Fetches all necessary data for the booking page.
 */
exports.fetchBookingPageData = onRequest({ region: 'europe-west1', memory: '512MiB' }, async (request, response) => {
    corsHandler(request, response, async () => {
        if (request.method !== 'POST') {
            response.status(405).send({ error: 'Method Not Allowed' });
            return;
        }
        
        const { propertySlug } = request.body.data;
        if (!propertySlug || typeof propertySlug !== "string") {
            response.status(400).send({ error: "Missing 'propertySlug'." });
            return;
        }

        try {
            const propertyQuery = db.collection("properties").where("slug", "==", propertySlug).limit(1);
            const propertyQuerySnapshot = await propertyQuery.get();
            if (propertyQuerySnapshot.empty) {
                response.status(404).send({ error: "Property not found." });
                return;
            }
            const propertyId = propertyQuerySnapshot.docs[0].id;

            const propertyPromise = db.doc(`properties/${propertyId}`).get();
            const ratePlansPromise = db
                .collection("ratePlans")
                .where("propertyId", "==", propertyId)
                .get();
            const promotionsPromise = db
                .collection("promotions")
                .where("propertyId", "==", propertyId)
                .where("active", "==", true)
                .get();
            const packagesPromise = db
                .collection("packages")
                .where("propertyId", "==", propertyId)
                .where("active", "==", true)
                .get();
            const servicesPromise = db
                .collection("services")
                .where("propertyId", "==", propertyId)
                .where("active", "==", true)
                .get();
            const mealPlansPromise = db
                .collection("mealPlans")
                .where("propertyId", "==", propertyId)
                .where("active", "==", true)
                .get();

            const [
                propertySnap,
                ratePlansSnap,
                promotionsSnap,
                packagesSnap,
                servicesSnap,
                mealPlansSnap,
            ] = await Promise.all([
                propertyPromise,
                ratePlansPromise,
                promotionsPromise,
                packagesPromise,
                servicesPromise,
                mealPlansPromise,
            ]);

            const property = propertySnap.exists ?
                { id: propertySnap.id, ...propertySnap.data() } :
                null;
            const ratePlans = ratePlansSnap.docs.map((d) => ({
                id: d.id, ...d.data(),
            }));
            const promotions = promotionsSnap.docs.map((d) => {
                const data = d.data();
                return {
                    id: d.id, ...data,
                    startDate: (data.startDate as Timestamp).toDate().toISOString(),
                    endDate: (data.endDate as Timestamp).toDate().toISOString(),
                };
            });
            const packages = packagesSnap.docs.map((d) => ({
                id: d.id, ...d.data(),
            }));
            const services = servicesSnap.docs.map((d) => ({
                id: d.id, ...d.data(),
            }));
            const mealPlans = mealPlansSnap.docs.map((d) => ({
                id: d.id, ...d.data(),
            }));
            
            response.send({
                data: {
                    success: true, 
                    property,
                    ratePlans,
                    promotions,
                    packages,
                    services,
                    mealPlans,
                }
            });

        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "An unknown error.";
            logger.error("Error fetching booking page data:", errorMessage);
            response.status(500).send({ success: false, error: "An unexpected error occurred." });
        }
    });
});



/**
 * Fetches emails from the configured IMAP server.
 */
exports.fetchEmails = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated to fetch emails.");
  }
  const uid = request.auth.uid;
  try {
    const staffDoc = await db.collection("staff").doc(uid).get();

    if (!staffDoc.exists || staffDoc.data()?.permissions?.guests !== true) {
      throw new HttpsError("permission-denied", "User does not have permission.");
    }

    const propertyId = staffDoc.data()?.propertyId;
    if (!propertyId) {
      throw new HttpsError("failed-precondition", "User is not associated with a property.");
    }
    
    const propDoc = await db.doc(`properties/${propertyId}`).get();
    if (!propDoc.exists || !propDoc.data()?.imapConfiguration) {
      throw new HttpsError("not-found", "IMAP settings not configured for this property.");
    }

    const imapConfig = (propDoc.data() as PropertyData).imapConfiguration!;
    if (!imapConfig.host || imapConfig.host === '127.0.0.1') {
        logger.warn(`IMAP host is not configured or is set to localhost for property ${propertyId}. Skipping email fetch.`);
        return []; // Return empty array if not configured properly
    }
    const config = {
      imap: {
        user: imapConfig.user,
        password: imapConfig.pass,
        host: imapConfig.host,
        port: Number(imapConfig.port),
        tls: imapConfig.useTls,
        authTimeout: 5000,
      },
    };

    let connection;
    try {
      connection = await imaps.connect(config);
      await connection.openBox("INBOX");
      const searchCriteria = ["ALL"]; 
      const fetchOptions = { bodies: [""], markSeen: false, struct: true };
      const messages = await connection.search(searchCriteria, fetchOptions);
      const emails = [];

      for (const item of messages) {
        const all = item.parts.find((part) => part.which === "");
        if (all) {
          try {
            const parsed = await simpleParser(all.body);
            const sender = parsed.from?.value[0];
            
            const emailData: any = {
              uid: item.attributes.uid,
              from: { name: sender?.name || "Unknown", email: sender?.address || "unknown" },
              subject: parsed.subject || "No Subject",
              date: parsed.date?.toISOString() || new Date().toISOString(),
              snippet: parsed.text?.substring(0, 100) || "",
              body: parsed.html || parsed.textAsHtml || parsed.text || "",
              unread: !item.attributes.flags.includes("\Seen"),
            };
            
            if (parsed.attachments && parsed.attachments.length > 0) {
                emailData.attachments = parsed.attachments.map((att) => ({
                    filename: att.filename || 'untitled',
                    contentType: att.contentType || 'application/octet-stream',
                    dataUri: `data:${att.contentType};base64,${att.content.toString("base64")}`,
                    size: att.size,
                }));
            }
  
            emails.push(emailData);
          } catch (parseError) {
              logger.error(`Failed to parse email with UID ${item.attributes.uid}:`, parseError);
          }
        }
      }
      await connection.end();
      return emails.reverse();
    } catch (error) {
      if (connection) {
        await connection.end();
      }
      throw error; // Propagate error to be caught by the outer catch block
    }
  } catch (error) {
    logger.error("Error processing fetchEmails request:", error);
    if (error instanceof HttpsError) {
        throw error; // Re-throw HttpsError as is
    }
    const message = error instanceof Error ? error.message : "An unknown internal error occurred.";
    throw new HttpsError("internal", message);
  }
});


/**
 * Marks a specific email as read on the IMAP server.
 */
exports.markEmailAsRead = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User not authenticated.");
    }
    const uid = request.auth.uid;
    const { messageUid } = request.data;
    if (!messageUid) {
        throw new HttpsError("invalid-argument", "Missing required 'messageUid' field.");
    }
    
    try {
        const staffDoc = await db.collection("staff").doc(uid).get();
        if (!staffDoc.exists || staffDoc.data()?.permissions?.guests !== true) {
            throw new HttpsError("permission-denied", "User does not have permission.");
        }
        const propertyId = staffDoc.data()?.propertyId;
        if (!propertyId) {
            throw new HttpsError("failed-precondition", "User is not associated with a property.");
        }
        const propDoc = await db.doc(`properties/${propertyId}`).get();
        if (!propDoc.exists || !propDoc.data()?.imapConfiguration) {
            throw new HttpsError("not-found", "IMAP settings not configured.");
        }

        const imapConfig = (propDoc.data() as PropertyData).imapConfiguration!;
        const config = {
            imap: { user: imapConfig.user, password: imapConfig.pass, host: imapConfig.host, port: Number(imapConfig.port), tls: imapConfig.useTls, authTimeout: 5000 },
        };
        
        let connection;
        try {
            connection = await imaps.connect(config);
            await connection.openBox("INBOX");
            await connection.addFlags(messageUid, "\Seen");
            await connection.end();
            logger.log(`Marked email UID ${messageUid} as read for user ${uid}.`);
            return { success: true };
        } catch (error) {
            if (connection) {
                await connection.end();
            }
            throw error;
        }

    } catch (error) {
        logger.error(`Error marking email as read for UID ${messageUid}:`, error);
        if (error instanceof HttpsError) {
            throw error;
        }
        const message = error instanceof Error ? error.message : "An unknown internal error occurred.";
        throw new HttpsError("internal", message);
    }
});


/**
 * Sends a templated email to a guest for a specific reservation.
 */
exports.sendTemplatedEmailToGuest = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be authenticated.");
    }

    const { reservationId, templateType } = request.data as { reservationId: string, templateType: EmailTemplateType };
    if (!reservationId || !templateType) {
        throw new HttpsError("invalid-argument", "Missing reservationId or templateType.");
    }

    try {
        const resDocRef = db.doc(`reservations/${reservationId}`);
        const resDocSnap = await resDocRef.get();
        if (!resDocSnap.exists) {
            throw new HttpsError("not-found", "Reservation not found.");
        }
        const reservationData = resDocSnap.data() as ReservationData;
        
        if (!reservationData.guestEmail) {
            throw new HttpsError("failed-precondition", "Reservation does not have a guest email.");
        }

        const propertyId = reservationData.propertyId;
        const propDocRef = db.doc(`properties/${propertyId}`);
        const propDocSnap = await propDocRef.get();
        if (!propDocSnap.exists) {
            throw new HttpsError("not-found", "Property configuration not found.");
        }
        const propertyData = { id: propDocSnap.id, ...propDocSnap.data() } as PropertyData;
        
        const invDocRef = db.doc(`invoices/${reservationId}`);
        const invDocSnap = await invDocRef.get();
        const invoiceData = invDocSnap.exists ? { id: invDocSnap.id, ...invDocSnap.data() } as Invoice : null;
        
        const currencySymbol = propertyData.currency || "$";
        const nights = differenceInDays(reservationData.endDate.toDate(), reservationData.startDate.toDate());
        const guests = (reservationData.adults || 0) + (reservationData.children || 0);

        const breakdownVars = {
            roomsTotal: reservationData.roomsTotal,
            extrasTotal: reservationData.extrasTotal,
            subtotal: reservationData.subtotal,
            discountAmount: reservationData.discountAmount,
            netAmount: reservationData.netAmount,
            taxAmount: reservationData.taxAmount,
        };

        const emailVariables: {[key: string]: string | number | undefined} = {
            guest_name: reservationData.guestName || "Valued Guest",
            reservation_code: reservationData.id,
            reservation_number: reservationData.reservationNumber || reservationData.id.substring(0, 8),
            check_in_date: format(reservationData.startDate.toDate(), "PP"),
            check_out_date: format(reservationData.endDate.toDate(), "PP"),
            room_type: reservationData.roomTypeName || "N/A",
            number_of_nights: nights,
            number_of_guests: guests,
            price_per_night: `${currencySymbol}${((reservationData.totalPrice || 0) / (nights || 1)).toFixed(2)}`,
            total_price: `${currencySymbol}${(reservationData.totalPrice || 0).toFixed(2)}`,
            total_taxes: `${currencySymbol}${(invoiceData?.taxAmount || 0).toFixed(2)}`,
            room_number: reservationData.roomName || 'N/A',
            invoice_number: invoiceData?.invoiceNumber,
            invoice_amount: `${currencySymbol}${(invoiceData?.amount || 0).toFixed(2)}`,
            invoice_due_date: (invoiceData?.dueDate) ? format(parseISO(invoiceData.dueDate), 'PP') : "N/A",
            ...breakdownVars,
        };

        let extrasText = "";
        if (reservationData.selectedExtras && reservationData.selectedExtras.length > 0) {
            extrasText += "\n\n--- Extras ---";
            const guestsForExtras = (reservationData.adults || 0) + (reservationData.children || 0);
            reservationData.selectedExtras.forEach((extra) => {
                const { price: unitPrice, quantity, unit, name } = extra;
                let itemTotal = 0;
                switch(unit) {
                    case 'one_time':
                    case 'per_booking':
                    case 'one_time_per_room':
                        itemTotal = unitPrice * quantity;
                        break;
                    case 'per_night':
                    case 'per_night_per_room':
                        itemTotal = unitPrice * nights * quantity;
                        break;
                    case 'per_guest':
                    case 'one_time_per_guest':
                        itemTotal = unitPrice * guestsForExtras * quantity;
                        break;
                    case 'per_night_per_guest':
                        itemTotal = unitPrice * nights * guestsForExtras * quantity;
                        break;
                    default:
                        itemTotal = unitPrice * quantity;
                }
                extrasText += `\n- ${name} (x${quantity}): ${currencySymbol}${itemTotal.toFixed(2)}`;
            });
        }
        emailVariables['extras'] = extrasText;

        const attachments: nodemailer.SendMailOptions['attachments'] = [];

        if (templateType === 'invoice_email' && invoiceData) {
            const pdf = await generateInvoicePdf(invoiceData, propertyData, reservationData as unknown as Reservation);
            const pdfDataUri = pdf.output('datauristring');
            attachments.push({
                filename: `invoice-${invoiceData.invoiceNumber}.pdf`,
                path: pdfDataUri,
            });
        }
        
        await sendTemplatedEmail(propertyData, templateType, reservationData.guestEmail, emailVariables, attachments);

        return { success: true };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        logger.error(`Error sending templated email for reservation ${reservationId}:`, errorMessage);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError("internal", `Failed to send email: ${errorMessage}`);
    }
});

/**
 * Creates a guest profile from an existing reservation's details.
 */
exports.createGuestFromReservation = onCall({ memory: "512MiB" }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated.");
    }
    const { reservationId } = request.data;
    if (!reservationId) {
        throw new HttpsError("invalid-argument", "Reservation ID is required.");
    }

    try {
        const reservationRef = db.doc(`reservations/${reservationId}`);
        
        return await db.runTransaction(async (transaction) => {
            const resDoc = await transaction.get(reservationRef);
            if (!resDoc.exists) {
                throw new HttpsError("not-found", "Reservation not found.");
            }
            const reservationData = resDoc.data() as ReservationData;

            if (reservationData.guestId) {
                throw new HttpsError("already-exists", "This reservation is already linked to a guest profile.");
            }
            if (!reservationData.guestEmail) {
                throw new HttpsError("failed-precondition", "Reservation must have an email to create a linked guest profile.");
            }

            // Check if guest already exists with this email
            const guestQuery = db.collection("guests")
                .where("email", "==", reservationData.guestEmail)
                .where("propertyId", "==", reservationData.propertyId);
            const guestSnapshot = await transaction.get(guestQuery);
            if (!guestSnapshot.empty) {
                const existingGuestId = guestSnapshot.docs[0].id;
                transaction.update(reservationRef, { guestId: existingGuestId });
                return { success: true, message: `Reservation linked to existing guest ${existingGuestId}.` };
            }

            // Create new guest if they don't exist
            const newGuestRef = db.collection("guests").doc();
            transaction.set(newGuestRef, {
                fullName: reservationData.guestName,
                email: reservationData.guestEmail,
                phone: reservationData.guestPhone || "",
                nationality: reservationData.guestCountry || "",
                propertyId: reservationData.propertyId,
                loyaltyStatus: 'not-enrolled',
                loyaltyPoints: 0,
                totalPointsEarned: 0,
                totalPointsRedeemed: 0,
                createdAt: FieldValue.serverTimestamp(),
            });

            // Update the reservation with the new guestId
            transaction.update(reservationRef, { guestId: newGuestRef.id });
            
            return { success: true, message: "Guest profile created successfully." };
        });

    } catch (error) {
        logger.error(`Error in createGuestFromReservation for reservation ${reservationId}:`, error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError("internal", "An unexpected error occurred while creating the guest profile.");
    }
});

import { onSchedule } from "firebase-functions/v2/scheduler";
exports.generateMonthlySalaryExpenses = onSchedule("0 0 1 * *", async (event) => {
    logger.log("Running monthly salary expense generation job.");
    const now = new Date();
    const currentMonth = format(now, 'yyyy-MM');
    const firstDayOfMonth = format(startOfMonth(now), 'yyyy-MM-dd');
    
    const propertiesSnapshot = await db.collection("properties").get();
    for (const propertyDoc of propertiesSnapshot.docs) {
        const propertyId = propertyDoc.id;
        
        const staffQuery = db.collection('staff')
            .where('propertyId', '==', propertyId)
            .where('status', '==', 'Active') // Corrected from 'Actif'
            .where('salary', '>', 0);
        const staffSnapshot = await staffQuery.get();

        if (staffSnapshot.empty) {
            logger.log(`No active staff with salary found for property ${propertyId}. Skipping.`);
            continue;
        }

        let totalSalary = 0;
        const staffCount = staffSnapshot.size;
        staffSnapshot.forEach(doc => {
            totalSalary += doc.data().salary;
        });

        const expenseId = `salary_${currentMonth}_${propertyId}`;
        const expenseRef = db.collection('expenses').doc(expenseId);
        const doc = await expenseRef.get();

        if (!doc.exists) {
            const expenseData = {
                expenseName: `Salaires du personnel`,
                expenseType: 'Fixe',
                category: 'Salaires',
                amount: totalSalary,
                date: firstDayOfMonth,
                notes: `Généré automatiquement pour les salaires de ${staffCount} employés.`,
                propertyId: propertyId,
                autoGenerated: true,
                createdAt: FieldValue.serverTimestamp(),
            };
            await expenseRef.set(expenseData);
            logger.log(`Scheduled salary expense for ${staffCount} staff in property ${propertyId}. Total: ${totalSalary}`);
        } else {
            logger.log(`Salary expense for ${currentMonth} in property ${propertyId} already exists. Skipping.`);
        }
    }
    logger.log("Finished monthly salary expense generation job.");
});


exports.manuallyTriggerSalaryExpenses = onCall({ region: 'europe-west1', memory: "512MiB" }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be authenticated.");
    }
    
    const adminUid = request.auth.uid;
    const adminDoc = await db.collection("staff").doc(adminUid).get();
    
    if (!adminDoc.exists || adminDoc.data()?.permissions?.finance !== true) {
        throw new HttpsError("permission-denied", "Must have finance permissions.");
    }
    const propertyId = adminDoc.data()?.propertyId;
    if (!propertyId) {
        throw new HttpsError("failed-precondition", "User is not associated with a property.");
    }

    logger.log("Manually triggering monthly salary expense generation job for property", propertyId);

    const now = new Date();
    const currentMonth = format(now, 'yyyy-MM');
    const firstDayOfMonth = format(startOfMonth(now), 'yyyy-MM-dd');
    
    const staffQuery = db.collection('staff')
        .where('propertyId', '==', propertyId)
        .where('status', '==', 'Active') // Corrected from 'Actif'
        .where('salary', '>', 0);
    const staffSnapshot = await staffQuery.get();

    if (staffSnapshot.empty) {
        logger.log(`No active staff with salary found for property ${propertyId}.`);
        return { success: true, message: "No active staff with salaries found to import.", expensesCreated: 0 };
    }

    let totalSalary = 0;
    const staffCount = staffSnapshot.size;
    const staffPositions = new Set<string>();
    staffSnapshot.forEach(doc => {
        const data = doc.data();
        totalSalary += data.salary;
        if(data.role) {
            staffPositions.add(data.role);
        }
    });

    const expenseId = `salary_${currentMonth}_${propertyId}`;
    const expenseRef = db.collection('expenses').doc(expenseId);
    const doc = await expenseRef.get();

    if (!doc.exists) {
        const expenseData = {
            expenseName: `Salaires du personnel`,
            expenseType: 'Fixe',
            category: 'Salaires',
            amount: totalSalary,
            date: firstDayOfMonth,
            notes: `Salaires pour ${staffCount} employés. Positions: ${Array.from(staffPositions).join(', ')}.`,
            propertyId: propertyId,
            autoGenerated: true,
            createdAt: FieldValue.serverTimestamp(),
        };
        await expenseRef.set(expenseData);
        logger.log(`Created manual salary expense for ${staffCount} staff in property ${propertyId}. Total: ${totalSalary}`);
        return { success: true, message: `A single expense record was created for ${staffCount} salaries.`, expensesCreated: 1 };
    } else {
        logger.log(`Salary expense for ${currentMonth} in property ${propertyId} already exists. Skipping.`);
        return { success: true, message: "Salary expense for this month already exists.", expensesCreated: 0 };
    }
});


exports.updateGuestStatsOnReservationComplete = onDocumentUpdated("reservations/{reservationId}", async (event) => {
    const beforeData = event.data?.before.data() as ReservationData | undefined;
    const afterData = event.data?.after.data() as ReservationData | undefined;

    // Trigger only on moving to 'Completed' status
    if (!beforeData || !afterData || beforeData.status === 'Completed' || afterData.status !== 'Completed' || !afterData.guestEmail) {
        return;
    }

    // CRITICAL FIX: Do not award points if the reservation was paid with points.
    // The deduction is already handled by onInvoicePaidLogic. This prevents a "double-dip" where points are spent and then re-earned.
    if (afterData.paidWithPoints) {
        logger.log(`Reservation ${event.params.reservationId} was paid with points. Skipping loyalty point award on completion.`);
        return;
    }

    const { guestEmail, totalPrice, startDate, endDate, propertyId, reservationNumber } = afterData;

    try {
        const propertyDoc = await db.doc(`properties/${propertyId}`).get();
        if (!propertyDoc.exists) {
            logger.error(`Property ${propertyId} not found.`);
            return;
        }
        const propertyData = propertyDoc.data() as PropertyData;
        const guestQuery = db.collection("guests").where("propertyId", "==", propertyId).where("email", "==", guestEmail).limit(1);

        await db.runTransaction(async (transaction) => {
            const guestSnapshot = await transaction.get(guestQuery);
            if (guestSnapshot.empty) {
                logger.log(`No guest profile found for email ${guestEmail}. Cannot update stats or loyalty.`);
                return;
            }

            const guestDoc = guestSnapshot.docs[0];
            const guestRef = guestDoc.ref;
            const guestData = guestDoc.data();
            const nights = differenceInDays(endDate.toDate(), startDate.toDate());

            const statsUpdatePayload: { [key: string]: any } = {
                totalNights: FieldValue.increment(nights > 0 ? nights : 1),
                totalSpent: FieldValue.increment(totalPrice || 0),
                lastStayDate: endDate,
            };
            
            const loyaltySettings = propertyData.loyaltyProgramSettings;
            if (loyaltySettings?.enabled && guestData.loyaltyStatus === 'enrolled') {
                const earningRate = loyaltySettings.earningRate;
                if (earningRate && earningRate > 0 && totalPrice && totalPrice > 0) {
                    const pointsEarned = totalPrice / earningRate;
                    if (pointsEarned > 0) {
                        statsUpdatePayload.loyaltyPoints = FieldValue.increment(pointsEarned);
                        statsUpdatePayload.totalPointsEarned = FieldValue.increment(pointsEarned);
                        
                        const historyRef = guestRef.collection("loyaltyHistory").doc();
                        const loyaltyHistoryEntry: LoyaltyHistoryEntry = {
                            date: FieldValue.serverTimestamp(),
                            change: pointsEarned,
                            reason: `Points earned from stay: ${reservationNumber || event.params.reservationId}`,
                        };
                        transaction.set(historyRef, loyaltyHistoryEntry);
                        logger.log(`Awarded ${pointsEarned.toFixed(2)} loyalty points to guest ${guestDoc.id}`);
                    }
                }
            }
            
            transaction.update(guestRef, statsUpdatePayload);
        });

        logger.log(`Successfully updated stats for guest ${guestEmail} based on reservation ${event.params.reservationId}`);
    } catch (error) {
        logger.error(`Error updating guest stats for reservation ${event.params.reservationId}:`, error);
    }
});