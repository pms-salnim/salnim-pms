
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import { FieldValue, type Timestamp, type Transaction } from "firebase-admin/firestore";
import { differenceInDays } from "date-fns";
import type { Property } from "../types/property";
import type { LoyaltyHistoryEntry } from "../types/loyalty";
import type { Reservation } from '../types/reservation';


exports.updateGuestStatsOnReservationComplete = onDocumentUpdated("reservations/{reservationId}", async (event) => {
    const beforeData = event.data?.before.data() as Reservation | undefined;
    const afterData = event.data?.after.data() as Reservation | undefined;

    // Trigger only on moving to 'Completed' status AND guest is checked out
    if (!beforeData || !afterData || beforeData.status === 'Completed' || afterData.status !== 'Completed' || !afterData.isCheckedOut || !afterData.guestEmail) {
        return;
    }

    // CRITICAL FIX: Do not award points if the reservation was paid with points.
    // The deduction is already handled by onInvoicePaidLogic. This prevents a "double-dip" where points are spent and then re-earned.
    if (afterData.paidWithPoints) {
        logger.log(`Reservation ${event.params.reservationId} was paid with points. Skipping loyalty point award on completion.`);
        return;
    }

    const { guestEmail, totalPrice, startDate, endDate, propertyId, reservationNumber } = afterData;

    try {
        const propertyDoc = await db.doc(`properties/${propertyId}`).get();
        if (!propertyDoc.exists) {
            logger.error(`Property ${propertyId} not found.`);
            return;
        }
        const propertyData = propertyDoc.data() as Property;
        const guestQuery = db.collection("guests").where("propertyId", "==", propertyId).where("email", "==", guestEmail).limit(1);

        await db.runTransaction(async (transaction: Transaction) => {
            const guestSnapshot = await transaction.get(guestQuery);
            if (guestSnapshot.empty) {
                logger.log(`No guest profile found for email ${guestEmail}. Cannot update stats or loyalty.`);
                return;
            }

            const guestDoc = guestSnapshot.docs[0];
            const guestRef = guestDoc.ref;
            const guestData = guestDoc.data();
            const nights = differenceInDays((endDate as unknown as Timestamp).toDate(), (startDate as unknown as Timestamp).toDate());

            // Initialize loyalty fields if missing (backward compatibility)
            if (!guestData.loyaltyStatus) {
                guestData.loyaltyStatus = 'not-enrolled';
            }
            if (guestData.loyaltyPoints === undefined) {
                guestData.loyaltyPoints = 0;
            }
            if (guestData.totalPointsEarned === undefined) {
                guestData.totalPointsEarned = 0;
            }
            if (guestData.totalPointsRedeemed === undefined) {
                guestData.totalPointsRedeemed = 0;
            }

            const statsUpdatePayload: { [key: string]: any } = {
                totalNights: FieldValue.increment(nights > 0 ? nights : 1),
                totalSpent: FieldValue.increment(totalPrice || 0),
                lastStayDate: endDate,
            };
            
            const loyaltySettings = propertyData.loyaltyProgramSettings;
            if (loyaltySettings?.enabled && guestData.loyaltyStatus === 'enrolled') {
                const earningRate = loyaltySettings.earningRate;
                if (earningRate && earningRate > 0 && totalPrice && totalPrice > 0) {
                    const pointsEarned = totalPrice / earningRate;
                    if (pointsEarned > 0) {
                        statsUpdatePayload.loyaltyPoints = FieldValue.increment(pointsEarned);
                        statsUpdatePayload.totalPointsEarned = FieldValue.increment(pointsEarned);
                        
                        const historyRef = guestRef.collection("loyaltyHistory").doc();
                        const loyaltyHistoryEntry: Omit<LoyaltyHistoryEntry, 'id' | 'date'> & { date: FieldValue } = {
                            date: FieldValue.serverTimestamp(),
                            change: pointsEarned,
                            reason: `Points earned from stay: ${reservationNumber || event.params.reservationId}`,
                        };
                        transaction.set(historyRef, loyaltyHistoryEntry);
                        logger.log(`Awarded ${pointsEarned.toFixed(2)} loyalty points to guest ${guestDoc.id}`);
                    }
                }
            }
            
            transaction.update(guestRef, statsUpdatePayload);
        });

        logger.log(`Successfully updated stats for guest ${guestEmail} based on reservation ${event.params.reservationId}`);
    } catch (error) {
        logger.error(`Error updating guest stats for reservation ${event.params.reservationId}:`, error);
    }
});
