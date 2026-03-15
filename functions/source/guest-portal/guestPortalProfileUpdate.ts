import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";

export const guestPortalProfileUpdate = onRequest({
  region: 'europe-west1',
  memory: '256MiB',
  cors: ['https://app.salnimpms.com', 'http://localhost:3000']
}, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send({ error: 'Method Not Allowed' });
    return;
  }

  const bodyData = req.body.data || req.body;
  const cleanPropertySlug = bodyData.propertySlug?.toString().trim().toLowerCase();
  const cleanReservationNumber = bodyData.reservationNumber?.toString().trim();
  const updates = bodyData.updates || {};

  if (!cleanPropertySlug || !cleanReservationNumber) {
    res.status(400).send({ error: "Missing 'propertySlug' or 'reservationNumber'." });
    return;
  }

  // Validate updates object
  if (typeof updates !== 'object' || Array.isArray(updates)) {
    res.status(400).send({ error: 'Invalid updates format' });
    return;
  }

  // Rate limiting check (simple IP-based)
  const clientIp = req.headers['x-forwarded-for'] || req.ip || 'unknown';
  // Note: In production, implement proper rate limiting with Redis or Firestore
  // For now, log the attempt
  logger.info(`Profile update attempt from IP: ${clientIp}`);

  // Only allow these fields to be updated by guests
  const ALLOWED_FIELDS = ['guestName', 'guestEmail', 'guestPhone', 'guestCountry', 'guestPassportOrId'];

  try {
    const propertyQuery = await db.collection('properties').where('slug', '==', cleanPropertySlug).limit(1).get();
    if (propertyQuery.empty) {
      res.status(404).send({ error: 'Property not found' });
      return;
    }

    const propertyDoc = propertyQuery.docs[0];
    const propertyId = propertyDoc.id;

    const reservationQuery = await db.collection('reservations')
      .where('propertyId', '==', propertyId)
      .where('reservationNumber', '==', cleanReservationNumber)
      .limit(1).get();

    if (reservationQuery.empty) {
      res.status(404).send({ error: 'Reservation not found.' });
      return;
    }

    const reservationRef = reservationQuery.docs[0].ref;

    // Run transaction to validate and apply updates atomically
    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(reservationRef);
      if (!doc.exists) throw new Error('Reservation disappeared');
      const current = doc.data() as any;

      const guestProvided: Record<string, boolean> = (current.guestProvidedFields && typeof current.guestProvidedFields === 'object') ? current.guestProvidedFields : {};

      const toUpdate: any = {};
      const updatedFields: string[] = [];
      const rejectedFields: Record<string, string> = {};

      for (const key of ALLOWED_FIELDS) {
        if (!(key in updates)) continue;
        const newVal = updates[key];

        const currentVal = current[key];

        const isEmptyCurrent = currentVal === null || currentVal === undefined || (typeof currentVal === 'string' && currentVal.trim() === '');
        const wasGuestProvided = !!guestProvided[key];

        if (isEmptyCurrent || wasGuestProvided) {
          toUpdate[key] = newVal;
          updatedFields.push(key);
        } else {
          rejectedFields[key] = 'Field provided by PMS and cannot be overwritten';
        }
      }

      if (updatedFields.length === 0) {
        return { updatedFields, rejectedFields };
      }

      const newGuestProvided = { ...guestProvided };
      for (const f of updatedFields) newGuestProvided[f] = true;

      toUpdate.guestProvidedFields = newGuestProvided;
      toUpdate.updatedAt = new Date();

      tx.update(reservationRef, toUpdate);

      return { updatedFields, rejectedFields };
    });

    res.status(200).send({ success: true, result });
  } catch (error) {
    logger.error('Error in guestPortalProfileUpdate:', error);
    res.status(500).send({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});
