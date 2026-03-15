
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import type { FirestoreUser } from "../types/firestoreUser";
import type { Permissions } from "../types/staff";

export const createStaffUser = onCall({ memory: '512MiB' }, async (request: CallableRequest<{
    email: string;
    password?: string;
    fullName: string;
    role: string;
    permissions: Permissions;
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
    const adminData = adminDoc.data() as FirestoreUser;
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

      const staffDocRef = db.doc(`staff/${userRecord.uid}`);
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
