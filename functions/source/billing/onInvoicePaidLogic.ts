
import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import type { Property } from "../types/property";
import type { Invoice as InvoiceData } from "../types/payment";
import type { Reservation } from "../types/reservation";
import { sendTemplatedEmail } from "../email/sendTemplatedEmail";

/**
 * Reusable logic for actions to be taken when an invoice is paid.
 * This can be triggered by creating a paid reservation or updating an invoice.
 * @param {Property} propertyData The property data.
 * @param {InvoiceData | Reservation} data The invoice or reservation data that was paid.
 */
export async function onInvoicePaidLogic(propertyData: Property, data: (InvoiceData | Reservation) & { id: string }, transaction?: FirebaseFirestore.Transaction) {
    const { propertyId, guestId } = data;
    const amountPaid = 'amount' in data ? data.amount : data.totalPrice ?? 0;
    const invoiceNumber = 'invoiceNumber' in data ? data.invoiceNumber : data.reservationNumber;

    if (!guestId) {
        logger.log(`Invoice/Reservation ${data.id || ''} is missing guestId. Cannot process post-payment actions.`);
        return;
    }
    
    const guestRef = db.doc(`guests/${guestId}`);
    const guestDoc = transaction ? await transaction.get(guestRef) : await guestRef.get();

    if (!guestDoc.exists) {
        logger.log(`Guest ${guestId} not found.`);
        return;
    }
    
    const guestData = guestDoc.data();
    if (!guestData) return;
    
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
    
    // --- Loyalty Points Logic ---
    // NOTE: Only handle point redemptions on any invoice payment.
    // Point earnings are awarded only when reservation is Completed AND checked out.
    const reservationIsPaidWithPoints = 'paidWithPoints' in data && data.paidWithPoints;
    if (propertyData.loyaltyProgramSettings?.enabled && guestData?.loyaltyStatus === 'enrolled' && reservationIsPaidWithPoints) {
        
        const redemptionRate = propertyData.loyaltyProgramSettings.redemptionRate;
        if (redemptionRate && redemptionRate > 0 && amountPaid > 0) {
            const pointsRedeemed = parseFloat((amountPaid / redemptionRate).toFixed(2));
            if (pointsRedeemed > 0) {
                const updatePayload = {
                    loyaltyPoints: FieldValue.increment(-pointsRedeemed),
                    totalPointsRedeemed: FieldValue.increment(pointsRedeemed),
                };
                if (transaction) {
                    transaction.update(guestRef, updatePayload);
                } else {
                    await guestRef.update(updatePayload);
                }
                logger.log(`Redeemed ${pointsRedeemed.toFixed(2)} points for guest ${guestId}`);
            }
        }
    }


    if(transaction) {
        return; // Email notifications must happen outside the transaction
    }

    // --- In-App Notification Logic (can be outside transaction if needed) ---
    if (propertyData.notificationSettings?.payment_received?.channels?.inApp) {
        const notificationRef = db.collection("notifications").doc();
        await notificationRef.set({
            propertyId,
            title: "Payment Received",
            description: `Payment for Invoice ${invoiceNumber} of ${propertyData.currency || "$"}${amountPaid.toFixed(2)} recorded.`,
            type: "payment_received",
            relatedDocId: data.id,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
        });
    }

    // --- Email Notification Logic ---
    if (guestData?.email && propertyData.notificationSettings?.payment_received?.channels?.email) {
        const emailVariables = {
            guest_name: guestData.fullName || "Valued Guest",
            invoice_number: invoiceNumber || "N/A",
            invoice_amount: `${propertyData.currency || "$"}${amountPaid.toFixed(2)}`,
        };
        await sendTemplatedEmail(propertyData, "payment_confirmation", guestData.email, emailVariables);
    }
}
