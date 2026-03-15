
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getAuth } from "firebase-admin/auth";
import { db } from "../firebase";

export const deleteStaffUser = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be authenticated.");
    }
    const adminUid = request.auth.uid;
    const adminDoc = await db.collection("staff").doc(adminUid).get();
    if (!adminDoc.exists || !adminDoc.data()?.permissions?.staffManagement) {
        throw new HttpsError("permission-denied", "Must have staff permissions.");
    }

    const uidToDelete = request.data.uid;
    if (!uidToDelete || typeof uidToDelete !== "string") {
        throw new HttpsError("invalid-argument", "Function must have 'uid'.");
    }
    if (uidToDelete === adminUid) {
        throw new HttpsError("permission-denied", "Cannot delete your own account.");
    }
    
    try {
        await getAuth().deleteUser(uidToDelete);
        logger.log(`Successfully deleted user ${uidToDelete} from Firebase Auth.`);

        const staffDocRef = db.collection("staff").doc(uidToDelete);
        await staffDocRef.delete();
        logger.log(`Successfully deleted staff document for ${uidToDelete}.`);

        return {
            success: true,
            message: `Successfully deleted staff member ${uidToDelete}.`,
        };
    } catch (error: any) {
        logger.error(`Error deleting staff user ${uidToDelete}:`, error);
        const errorMessage = error.message || "An unexpected error occurred while deleting the user.";
        throw new HttpsError("internal", errorMessage);
    }
});
