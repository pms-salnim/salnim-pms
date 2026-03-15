
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import * as nodemailer from "nodemailer";
import type { FirestoreUser } from "../types/firestoreUser";


export const verifySmtp = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request: CallableRequest<{
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
    const staffData = staffDoc.data() as FirestoreUser;
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
