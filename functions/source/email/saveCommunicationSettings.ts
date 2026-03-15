
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import { FieldValue } from "firebase-admin/firestore";

// A minimal interface to satisfy type requirements for the staff document data.
interface StaffData {
  permissions?: {
    settings?: boolean;
  };
  propertyId?: string;
}

export const saveCommunicationSettings = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request: CallableRequest<{
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
