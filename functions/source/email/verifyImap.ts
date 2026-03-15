
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import imaps from "imap-simple";
import type { FirestoreUser } from "../types/firestoreUser";


export const verifyImap = onCall({ 
    region: 'europe-west1', 
    memory: '512MiB'
}, async (request: CallableRequest<{
    imapHost: string;
    imapPort: number;
    imapUser: string;
    imapPass: string;
    useTls?: boolean;
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

    const { imapHost, imapPort, imapUser, imapPass, useTls } = request.data;
    logger.info('IMAP verification request:', { imapHost, imapPort, imapUser, useTls: !!useTls, hasPass: !!imapPass });
    
    if (!imapHost || !imapPort || !imapUser || !imapPass) {
        logger.warn('Missing IMAP fields:', { imapHost: !!imapHost, imapPort: !!imapPort, imapUser: !!imapUser, imapPass: !!imapPass });
        throw new HttpsError("invalid-argument", "Missing required IMAP credential fields.");
    }

    try {
        const config = {
            imap: {
                user: imapUser,
                password: imapPass,
                host: imapHost,
                port: imapPort,
                tls: useTls !== false,
                authTimeout: 5000,
            },
        };

        const connection = await imaps.connect(config);
        await connection.end();
        logger.log("IMAP Connection Verified for user:", request.auth.uid);
        return { success: true, message: "IMAP connection verified successfully!" };
    } catch (error: any) {
        logger.error("IMAP Verification Failed for user:", request.auth.uid, error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new HttpsError("internal", `IMAP verification failed: ${message}`);
    }
  });
