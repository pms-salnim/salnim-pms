
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import { FieldValue } from "firebase-admin/firestore";
import { onInvoicePaidLogic } from "./onInvoicePaidLogic";
import type { Property } from "../types/property";
import type { Invoice } from "../types/payment";
import type { Payment as PaymentData } from "../types/payment";


/**
 * Triggered when a payment is updated. If status becomes 'Paid', it syncs
 * the status with the corresponding Reservation and Invoice.
 */
export const onPaymentUpdate = onDocumentUpdated("payments/{paymentId}", async (event) => {
    const beforeData = event.data?.before.data() as PaymentData | undefined;
    const afterData = event.data?.after.data() as PaymentData | undefined;
    const paymentId = event.params.paymentId;

    if (!afterData || beforeData?.status === "Paid" || afterData.status !== "Paid") {
        logger.log(`Payment ${paymentId} status not updated to "Paid". No action.`);
        return;
    }

    const { propertyId, invoiceId, reservationId } = afterData;

    try {
        const batch = db.batch();

        if (invoiceId) {
            const invoiceRef = db.doc(`invoices/${invoiceId}`);
            batch.update(invoiceRef, { paymentStatus: 'Paid', updatedAt: FieldValue.serverTimestamp() });
        }
        
        if (reservationId) {
            const reservationRef = db.doc(`reservations/${reservationId}`);
            batch.update(reservationRef, { paymentStatus: 'Paid', updatedAt: FieldValue.serverTimestamp() });
        }

        await batch.commit();

        logger.log(`Synced "Paid" status from payment ${paymentId} to related documents.`);

        // Now, trigger the post-payment logic using the invoice data
        if (invoiceId) {
            const invoiceDoc = await db.doc(`invoices/${invoiceId}`).get();
            if (invoiceDoc.exists) {
                const propertyDoc = await db.doc(`properties/${propertyId}`).get();
                if (propertyDoc.exists) {
                    await onInvoicePaidLogic(
                        propertyDoc.data() as Property, 
                        { id: invoiceId, ...invoiceDoc.data() } as Invoice
                    );
                }
            }
        }

    } catch (error) {
        logger.error(`Error syncing payment status for payment ${paymentId}:`, error);
    }
});
