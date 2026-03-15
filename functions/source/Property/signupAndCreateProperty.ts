
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { db } from "../firebase";
import { generateUniqueSlug } from "../lib/utils";
import { emailTemplateTypes, type EmailTemplate } from "../types/emailTemplate";


/**
 * [PUBLIC] Creates a new user, a new property with a unique slug,
 * and assigns the user as the admin of that property.
 */
export const signupAndCreateProperty = onCall({ memory: '512MiB', cors: true, region: 'europe-west1' }, async (request) => {
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

  // Generate unique slug
  const slug = await generateUniqueSlug(propertyName);

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
  const propertyDocRef = db.collection('properties').doc();
  const staffDocRef = db.doc(`staff/${uid}`);

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
