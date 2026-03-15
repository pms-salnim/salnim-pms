
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import { onInvoicePaidLogic } from "./onInvoicePaidLogic";
import type { Property } from "../types/property";
import type { Invoice } from "../types/payment";


/**
 * Triggered when an invoice is updated, to sync its status with the reservation.
 * If the new status is 'Paid', it also triggers post-payment logic like loyalty points.
 */
export const onInvoicePaid = onDocumentUpdated("invoices/{invoiceId}", async (event) => {
    const beforeData = event.data?.before.data() as Invoice | undefined;
    const afterData = event.data?.after.data() as Invoice | undefined;

    if (!beforeData || !afterData || beforeData.paymentStatus === afterData.paymentStatus) {
        return;
    }
    
    const { propertyId, reservationId, paymentStatus } = afterData;

    try {
        const batch = db.batch();
        
        // Sync Invoice status change to Reservation
        if (reservationId) {
            const reservationRef = db.doc(`reservations/${reservationId}`);
            batch.update(reservationRef, { paymentStatus: paymentStatus });
        }

        // If the invoice is now marked as "Paid"
        if (afterData.paymentStatus === "Paid" && beforeData.paymentStatus !== "Paid") {
            const propertyDoc = await db.doc(`properties/${propertyId}`).get();
            if (propertyDoc.exists) {
                const propertyData = propertyDoc.data() as Property;
                // This call must be outside a transaction to allow email sending
                await onInvoicePaidLogic(propertyData, { ...afterData, id: event.params.invoiceId });
            }

            // Also ensure the related Payment record is updated to 'Paid'
            if (reservationId) {
                const paymentsQuery = db.collection(`properties/${propertyId}/payments`)
                    .where("reservationId", "==", reservationId)
                    .limit(1);
                const paymentSnapshot = await paymentsQuery.get();
                if (!paymentSnapshot.empty) {
                    const paymentDocRef = paymentSnapshot.docs[0].ref;
                    batch.update(paymentDocRef, {
                        status: 'Paid',
                        amountPaid: afterData.amount, // Set amount from invoice
                    });
                }
            }
        }
        
        await batch.commit();

    } catch (error) {
        logger.error(`Failed to process status sync for invoice ${event.params.invoiceId}:`, error);
    }
});
