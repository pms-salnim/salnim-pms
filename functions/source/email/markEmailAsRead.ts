
import { onRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import { FieldValue } from "firebase-admin/firestore";
import imaps from "imap-simple";

exports.markEmailAsRead = onRequest({ region: 'europe-west1', memory: '512MiB', cors: true }, async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.status(204).send('');
        return;
    }

    if (!req.headers.authorization?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'User not authenticated.' });
        return;
    }

    const { messageUid } = req.body || {};
    if (!messageUid) {
        res.status(400).json({ error: "Missing required 'messageUid' field." });
        return;
    }

    try {
        const idToken = req.headers.authorization.split('Bearer ')[1];
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        const staffDoc = await db.collection("staff").doc(uid).get();
        if (!staffDoc.exists || staffDoc.data()?.permissions?.guests !== true) {
            res.status(403).json({ error: 'User does not have permission.' });
            return;
        }
        const propertyId = staffDoc.data()?.propertyId;
        if (!propertyId) {
            res.status(403).json({ error: 'User is not associated with a property.' });
            return;
        }
        const propDoc = await db.doc(`properties/${propertyId}`).get();
        if (!propDoc.exists || !propDoc.data()?.imapConfiguration) {
            res.status(404).json({ error: 'IMAP settings not configured.' });
            return;
        }

        const imapConfig = propDoc.data()?.imapConfiguration;
        const resolvedImapHost = imapConfig?.imapHost ?? imapConfig?.host;
        const resolvedImapUser = imapConfig?.imapUser ?? imapConfig?.user;
        const resolvedImapPass = imapConfig?.imapPass ?? imapConfig?.pass;
        const resolvedImapPort = imapConfig?.imapPort ?? imapConfig?.port;
        const resolvedUseTls = imapConfig?.useTls;

        if (!resolvedImapHost || !resolvedImapUser || !resolvedImapPass) {
            res.status(400).json({ error: 'IMAP settings not configured.' });
            return;
        }

        const config = {
            imap: { user: resolvedImapUser, password: resolvedImapPass, host: resolvedImapHost, port: Number(resolvedImapPort || 993), tls: resolvedUseTls !== false, authTimeout: 5000 },
        };

        const emailsRef = db.collection('properties').doc(propertyId).collection('emails');

        let connection;
        try {
            connection = await imaps.connect(config);
            await connection.openBox("INBOX");
            await connection.addFlags(messageUid, "\\Seen");
            await connection.end();
            await emailsRef.doc(String(messageUid)).set({
                unread: false,
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            logger.log(`Marked email UID ${messageUid} as read for user ${uid}.`);
            res.status(200).json({ success: true });
        } catch (error) {
            if (connection) {
                await connection.end();
            }
            throw error;
        }
    } catch (error) {
        logger.error(`Error marking email as read for UID ${messageUid}:`, error);
        const message = error instanceof Error ? error.message : "An unknown internal error occurred.";
        res.status(500).json({ error: message });
    }
});
