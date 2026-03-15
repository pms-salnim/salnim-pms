
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import { format, differenceInDays } from "date-fns";
import { sendTemplatedEmail } from "../email/sendTemplatedEmail";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { Reservation } from "../types/reservation";
import type { Property } from "../types/property";
import type { Invoice } from "../types/payment";


/**
 * [NEW] Triggered on new reservation creation from the public booking page.
 * Sends a confirmation email to the guest.
 */
export const sendPublicBookingConfirmation = onDocumentCreated("reservations/{reservationId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        return;
    }
    const reservationData = snapshot.data() as Reservation;
    
    // Only proceed if the reservation is from the public booking page.
    if (reservationData.source !== 'Direct' || !reservationData.guestEmail) {
        return;
    }

    const reservationId = snapshot.id;
    const { propertyId, guestEmail } = reservationData;

    try {
        const propertyDoc = await db.doc(`properties/${propertyId}`).get();
        if (!propertyDoc.exists) {
            throw new Error(`Property ${propertyId} not found for email confirmation.`);
        }
        const propertyData = propertyDoc.data() as Property;
        const nights = differenceInDays((reservationData.endDate as unknown as Timestamp).toDate(), (reservationData.startDate as unknown as Timestamp).toDate());
        const numberOfGuests = (reservationData.rooms[0]?.adults || 0) + (reservationData.rooms[0]?.children || 0);

        const breakdownVars = {
            roomsTotal: reservationData.roomsTotal,
            extrasTotal: reservationData.extrasTotal,
            subtotal: reservationData.subtotal,
            discountAmount: reservationData.discountAmount,
            netAmount: reservationData.netAmount,
            taxAmount: reservationData.taxAmount,
        };

        const guestEmailVars = {
            guest_name: reservationData.guestName || "Valued Guest",
            reservation_code: reservationId,
            reservation_number: reservationData.reservationNumber,
            check_in_date: format((reservationData.startDate as unknown as Timestamp).toDate(), "PP"),
            check_out_date: format((reservationData.endDate as unknown as Timestamp).toDate(), "PP"),
            room_type: reservationData.rooms.map((r: { roomTypeName: any; }) => r.roomTypeName).join(', '),
            room_number: reservationData.rooms.map((r: { roomName: any; }) => r.roomName).join(', '),
            number_of_nights: nights,
            number_of_guests: numberOfGuests,
            total_price: `${propertyData.currency || '$'}${(reservationData.totalPrice || 0).toFixed(2)}`,
            ...breakdownVars,
        };
        
        await sendTemplatedEmail(propertyData, 'reservation_confirmation', guestEmail, guestEmailVars);
        
        logger.log(`Sent public booking confirmation for reservation ${reservationId} to ${guestEmail}.`);

    } catch (error) {
        logger.error(`Failed to send public booking confirmation for ${reservationId}:`, error);
    }
});


/**
 * Reusable logic for actions to be taken when an invoice is paid.
 * This can be triggered by creating a paid reservation or updating an invoice.
 * @param {Property} propertyData The property data.
 * @param {Invoice | Reservation} data The invoice or reservation data that was paid.
 */
export async function onInvoicePaidLogic(propertyData: Property, data: (Invoice | Reservation) & { id: string }, transaction?: FirebaseFirestore.Transaction) {
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
    // NOTE: Only handle point redemptions on booking creation.
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
