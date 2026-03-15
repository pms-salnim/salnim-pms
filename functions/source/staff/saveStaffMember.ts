
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";

/**
* Creates or updates a non-login staff member record in Firestore.
*/
export const saveStaffMember = onRequest({ 
  memory: "512MiB", 
  region: "europe-west1",
  cors: true 
}, async (request, response) => {
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
        const staffDocRef = db.doc(`staff/${staffId}`);
        payload.updatedAt = FieldValue.serverTimestamp();
        await staffDocRef.update(payload);
        response.status(200).send({ data: { success: true, id: staffId } });
      } else {
        // Create new staff member
        const newStaffDocRef = db.doc(`staff/${db.collection('staff').doc().id}`);
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
