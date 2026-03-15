import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import type { CallableRequest } from "firebase-functions/v2/https";

/**
 * Creates a new payment record in Firestore.
 * Fix: Changed cors to true to let Firebase SDK handle preflight correctly for onCall.
 * The security is handled by the !request.auth check inside the function.
 */
export const createPayment = onCall(
    {
        region: 'europe-west1',
        memory: '512MiB',
        cors: true, // Setting to true is the recommended way for onCall to handle multiple origins
    },
    async (request: CallableRequest<any>) => {
        // 1. Authentication Check (Crucial since CORS is now open)
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
        }

        const {
            propertyId,
            amountReceived,
            paymentMethod,
            paymentDate,
            guestName,
            invoiceId,
            reservationNumber,
            notes,
        } = request.data;

        // 2. Data Validation
        if (!propertyId || !amountReceived || !paymentMethod || !paymentDate || !guestName) {
            throw new HttpsError("invalid-argument", "Missing required fields for payment creation.");
        }

        let reservationId: string | null = null;
        let guestId: string | null = null;

        // 3. Lookup Reservation if number provided
        if (reservationNumber) {
            try {
                const resQuery = db.collection("reservations")
                    .where("propertyId", "==", propertyId)
                    .where("reservationNumber", "==", reservationNumber)
                    .limit(1);

                const snapshot = await resQuery.get();

                if (!snapshot.empty) {
                    const resDoc = snapshot.docs[0];
                    reservationId = resDoc.id;
                    guestId = resDoc.data().guestId || null;
                } else {
                    logger.warn(`Could not find reservation with number: ${reservationNumber}`);
                }
            } catch (err) {
                logger.error("Error querying reservations:", err);
                // We continue even if lookup fails, but we log it
            }
        }

        // 4. Create Payment Record
        try {
            const newPaymentRef = db.collection(`properties/${propertyId}/payments`).doc();

            const paymentData = {
                propertyId,
                guestName,
                amountPaid: Number(amountReceived),
                paymentMethod,
                date: paymentDate, // "yyyy-MM-dd"
                status: "Paid",
                invoiceId: invoiceId || null,
                reservationId: reservationId,
                reservationNumber: reservationNumber || null,
                notes: notes || null,
                createdAt: FieldValue.serverTimestamp(),
                createdBy: request.auth.uid,
                guestId,
            };

            await newPaymentRef.set(paymentData);

            // 5. Update Reservation Payment Status
            if (reservationId) {
                try {
                    const resDoc = await db.collection("reservations").doc(reservationId).get();
                    
                    if (resDoc.exists) {
                        const resData = resDoc.data();
                        const totalPrice = resData?.totalPrice || 0;
                        
                        // Get all payments for this reservation
                        const paymentsSnapshot = await db.collection(`properties/${propertyId}/payments`)
                            .where("reservationId", "==", reservationId)
                            .get();
                        
                        // Calculate total paid (including the new payment we just created)
                        let totalPaid = Number(amountReceived); // Start with the new payment
                        paymentsSnapshot.docs.forEach(doc => {
                            if (doc.id !== newPaymentRef.id) { // Don't double-count the new payment
                                totalPaid += doc.data().amountPaid || 0;
                            }
                        });
                        
                        // Determine payment status
                        let newPaymentStatus = "Pending";
                        if (totalPaid >= totalPrice) {
                            newPaymentStatus = "Paid";
                        } else if (totalPaid > 0) {
                            newPaymentStatus = "Partial";
                        }
                        
                        // Update reservation with new payment status
                        await db.collection("reservations").doc(reservationId).update({
                            paymentStatus: newPaymentStatus,
                            updatedAt: FieldValue.serverTimestamp(),
                        });
                        
                        logger.info(`Reservation ${reservationId} payment status updated to ${newPaymentStatus}`);
                    }
                } catch (err) {
                    logger.error("Error updating reservation payment status:", err);
                    // Continue - the payment was created, but status update failed
                }
            }

            return {
                success: true,
                paymentId: newPaymentRef.id,
                activity: {
                    type: 'payment',
                    title: 'Payment Recorded',
                    details: {
                        amount: Number(amountReceived),
                        method: paymentMethod,
                        date: paymentDate,
                        notes: notes || null,
                        guestName: guestName,
                        reservationNumber: reservationNumber || null
                    },
                    description: `${guestName} paid ${amountReceived} via ${paymentMethod}`
                }
            };

        } catch (error) {
            logger.error("Error creating manual payment document:", error);
            throw new HttpsError("internal", "Could not record the payment in the database.");
        }
    }
);