
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import type { Reservation } from "../types/reservation";

export const createGuestFromReservation = onCall({ memory: "512MiB" }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated.");
    }
    const { reservationId } = request.data;
    if (!reservationId) {
        throw new HttpsError("invalid-argument", "Reservation ID is required.");
    }

    try {
        const reservationRef = db.doc(`reservations/${reservationId}`);
        
        return await db.runTransaction(async (transaction) => {
            const resDoc = await transaction.get(reservationRef);
            if (!resDoc.exists) {
                throw new HttpsError("not-found", "Reservation not found.");
            }
            const reservationData = resDoc.data() as Reservation;

            if (reservationData.guestId) {
                throw new HttpsError("already-exists", "This reservation is already linked to a guest profile.");
            }
            // Only create if there's an email or a phone number.
            if (!reservationData.guestEmail && !reservationData.guestPhone) {
                throw new HttpsError("failed-precondition", "Reservation must have an email or phone number to create a linked guest profile.");
            }
            
            let query;
            if(reservationData.guestEmail) {
                query = db.collection("guests")
                    .where("email", "==", reservationData.guestEmail)
                    .where("propertyId", "==", reservationData.propertyId);
            } else if(reservationData.guestPhone) {
                 query = db.collection("guests")
                    .where("phone", "==", reservationData.guestPhone)
                    .where("propertyId", "==", reservationData.propertyId);
            } else {
                 throw new HttpsError("failed-precondition", "Cannot search for guest without email or phone.");
            }

            const guestSnapshot = await transaction.get(query);
            if (!guestSnapshot.empty) {
                const existingGuestId = guestSnapshot.docs[0].id;
                transaction.update(reservationRef, { guestId: existingGuestId });
                return { success: true, message: `Reservation linked to existing guest ${existingGuestId}.` };
            }

            // Create new guest if they don't exist
            const newGuestRef = db.collection("guests").doc();
            transaction.set(newGuestRef, {
                fullName: reservationData.guestName,
                email: reservationData.guestEmail || '',
                phone: reservationData.guestPhone || '',
                nationality: reservationData.guestCountry || '',
                passportOrId: reservationData.guestPassportOrId || '',
                propertyId: reservationData.propertyId,
                loyaltyStatus: 'not-enrolled',
                loyaltyPoints: 0,
                totalPointsEarned: 0,
                totalPointsRedeemed: 0,
                createdAt: FieldValue.serverTimestamp(),
            });

            // Update the reservation with the new guestId
            transaction.update(reservationRef, { guestId: newGuestRef.id });
            
            return { success: true, message: "Guest profile created successfully." };
        });

    } catch (error) {
        logger.error(`Error in createGuestFromReservation for reservation ${reservationId}:`, error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError("internal", "An unexpected error occurred while creating the guest profile.");
    }
});
