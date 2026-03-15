
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";

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
