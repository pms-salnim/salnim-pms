import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { format, addDays, differenceInDays } from "date-fns";
import { db } from "../firebase";
import { cleanFirestoreData } from "../lib/firestoreUtils";
import type { Reservation, ReservationRoom, SelectedExtra } from '../types/reservation';
import type { Property } from '../types/property';
import type { Invoice } from '../types/payment';
import type { Folio } from '../types/folio';

/**
 * Triggered on new reservation creation.
 * Handles invoice generation, notification creation, and property updates atomically.
 */
export const handleReservationCreate = onDocumentCreated("reservations/{reservationId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        logger.log("No data associated with the event");
        return;
    }
    const reservationData = snapshot.data() as Reservation;
    const { propertyId, guestEmail, guestPhone, guestPassportOrId, startDate, endDate, paymentStatus, partialPaymentAmount } = reservationData;
    const reservationId = snapshot.id;

    if (!propertyId || !startDate || !endDate) {
        logger.error("Reservation is missing required fields (propertyId, dates).", { id: reservationId });
        return;
    }

    const propertyRef = db.doc(`properties/${propertyId}`);

    try {
        await db.runTransaction(async (transaction) => {
            // ====== PHASE 1: ALL READS FIRST ======
            const propertyDoc = await transaction.get(propertyRef);
            if (!propertyDoc.exists) {
                throw new Error(`Property ${propertyId} not found.`);
            }
            const propertyData = propertyDoc.data() as Property;

            const updatedReservationData = { ...reservationData };
            
            // Ensure guestId is explicitly set to null if undefined
            if (updatedReservationData.guestId === undefined) {
                updatedReservationData.guestId = null;
            }

            // Read: Guest lookup if needed
            let guestIdToLink: string | null = null;
            let guestSnapshot: any = null;
            let existingGuestData: any = null;
            
            if ((guestEmail && guestEmail.trim() !== '') || (guestPhone && guestPhone.trim() !== '')) {
                if (!updatedReservationData.guestId) {
                    const guestQuery = guestEmail
                        ? db.collection("guests").where("email", "==", guestEmail).where("propertyId", "==", propertyId).limit(1)
                        : db.collection("guests").where("phone", "==", guestPhone).where("propertyId", "==", propertyId).limit(1);

                    guestSnapshot = await transaction.get(guestQuery);
                    
                    if (!guestSnapshot.empty) {
                        guestIdToLink = guestSnapshot.docs[0].id;
                        existingGuestData = guestSnapshot.docs[0].data();
                    }
                }
            }

            // Read: Generate unique reservation number
            const prefix = propertyData.invoiceCustomization?.prefix || "R-";
            const generateNineDigit = () => String(Math.floor(100000000 + Math.random() * 900000000));

            let newReservationNumber: string | null = null;
            const maxAttempts = 10;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const candidate = `${prefix}${generateNineDigit()}`;
                const existingQuery = db.collection('reservations')
                    .where('reservationNumber', '==', candidate)
                    .where('propertyId', '==', propertyId)
                    .limit(1);
                const existingSnap = await transaction.get(existingQuery);
                if (existingSnap.empty) {
                    newReservationNumber = candidate;
                    break;
                }
            }

            // Fallback if no unique number found
            if (!newReservationNumber) {
                const timeBased = String(Date.now() % 1000000000).padStart(9, '0');
                newReservationNumber = `${prefix}${timeBased}`;
            }
            
            // ====== PHASE 2: ALL WRITES AFTER ALL READS ======
            
            // Write: Create or update guest
            if ((guestEmail && guestEmail.trim() !== '') || (guestPhone && guestPhone.trim() !== '')) {
                if (!updatedReservationData.guestId && !guestIdToLink) {
                    // Create new guest
                    const newGuestRef = db.collection("guests").doc();
                    transaction.set(newGuestRef, {
                        fullName: updatedReservationData.guestName,
                        email: guestEmail || "",
                        phone: updatedReservationData.guestPhone || "",
                        nationality: updatedReservationData.guestCountry || "",
                        passportOrId: guestPassportOrId || "",
                        propertyId: propertyId,
                        loyaltyStatus: 'not-enrolled',
                        reservations: [reservationId],
                        createdAt: FieldValue.serverTimestamp(),
                    });
                    guestIdToLink = newGuestRef.id;
                } else if (guestIdToLink && guestSnapshot && !guestSnapshot.empty) {
                    // Update existing guest
                    transaction.update(guestSnapshot.docs[0].ref, {
                        phone: updatedReservationData.guestPhone || existingGuestData.phone,
                        passportOrId: guestPassportOrId || existingGuestData.passportOrId,
                        nationality: updatedReservationData.guestCountry || existingGuestData.nationality,
                        reservations: FieldValue.arrayUnion(reservationId),
                    });
                }
                
                if (guestIdToLink) {
                    updatedReservationData.guestId = guestIdToLink;
                }
            }

            // Prepare invoice data
            const reservationStartDate = (updatedReservationData.startDate as unknown as Timestamp).toDate();
            const reservationEndDate = (updatedReservationData.endDate as unknown as Timestamp).toDate();
            const lineItems: Invoice['lineItems'] = [];
            const nights = differenceInDays(reservationEndDate, reservationStartDate);

            updatedReservationData.rooms.forEach((room: ReservationRoom) => {
                // Add the room itself as a line item
                const nightly = (room.price && nights > 0) ? room.price / nights : room.price;
                lineItems.push({
                    description: `Room Accommodation - ${nights > 0 ? nights : 1} night(s) @ ${nightly.toFixed(2)}`,
                    quantity: nights > 0 ? nights : 1,
                    unitPrice: nightly,
                    total: room.price
                });

                // Add selected extras for this room
                (room.selectedExtras || []).forEach((extra: SelectedExtra) => {
                    lineItems.push({
                        description: `  - ${extra.name}`,
                        quantity: extra.quantity,
                        unitPrice: extra.price,
                        total: extra.total,
                    });
                });
            });


            const newInvoiceRef = db.doc(`invoices/${reservationId}`);
            const invoiceDocData: Invoice = {
                id: newInvoiceRef.id,
                propertyId, invoiceNumber: newReservationNumber,
                guestOrCompany: updatedReservationData.guestName || "N/A",
                guestId: updatedReservationData.guestId ?? null,
                guestEmail: updatedReservationData.guestEmail,
                guestPhone: updatedReservationData.guestPhone,
                reservationId: reservationId,
                dateIssued: format(new Date(), "yyyy-MM-dd"),
                dueDate: format(addDays(new Date(), 30), "yyyy-MM-dd"),
                amount: updatedReservationData.totalPrice || 0,
                paymentStatus: (paymentStatus === "Paid" || reservationData.paidWithPoints) ? "Paid" : paymentStatus || 'Pending',
                subtotal: updatedReservationData.subtotal || 0,
                taxAmount: updatedReservationData.taxAmount || 0,
                discountAmount: updatedReservationData.discountAmount || 0,
                lineItems: lineItems,
                createdAt: FieldValue.serverTimestamp(),
            };
            
            // Write: Create invoice
            transaction.set(newInvoiceRef, invoiceDocData);

            // Write: Create main guest folio
            const folioId = `main-guest-folio`;
            const newFolioRef = db.doc(
              `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}`
            );
            const folioData: Folio = {
              id: folioId,
              reservationId,
              type: "GUEST",
              name: "Main Folio",
              currency: propertyData.currency || "USD",
              status: "OPEN",
              createdAt: new Date(),
              createdBy: "system",
              isPrimary: true,
            };
            transaction.set(newFolioRef, folioData);

            // Write: Update reservation with invoice ID, guest ID, and reservation number
            transaction.update(snapshot.ref, {
                invoiceId: newInvoiceRef.id,
                reservationNumber: newReservationNumber,
                guestId: updatedReservationData.guestId ?? null,
            });

            // ====== CREATE LEDGER ENTRIES ======
            // STEP 1: Create CHARGE ledger entry for the entire reservation
            // Use the first room's rate plan price per night for the description
            const totalReservationAmount = updatedReservationData.totalPrice || 0;
            const firstRoom = updatedReservationData.rooms[0];
            const pricePerNight = firstRoom && nights > 0 ? firstRoom.price / nights : (firstRoom?.price || 0);
            const chargeDescription = `Room Accommodation - ${nights > 0 ? nights : 1} night(s) @ ${pricePerNight.toFixed(2)}`;

            const chargeId = `LEX-${reservationId}-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 8)
              .toUpperCase()}`;

            const timestamp = Timestamp.now();
            const chargeEntry = cleanFirestoreData({
              id: chargeId,
              folioId: `main-guest-folio`,
              type: "CHARGE",
              source: 'SYSTEM',
              amount: totalReservationAmount,
              direction: "DEBIT",
              description: chargeDescription,
              category: 'Room Accommodation',
              taxBreakdown: [],
              createdAt: timestamp.toDate(),
              createdBy: "system",
              postingDate: format(timestamp.toDate(), "yyyy-MM-dd"),
              isRefunded: false,
              deleted: false,
              immutable: true,
            });

            const chargeRef = db.doc(
              `properties/${propertyId}/reservations/${reservationId}/folios/main-guest-folio/ledger/${chargeId}`
            );
            transaction.set(chargeRef, chargeEntry);

            logger.log(`Charge ledger entry created during reservation creation`, {
              reservationId,
              chargeId,
              amount: totalReservationAmount,
            });

            // STEP 2: Create payment record if needed
            // NOTE: Do NOT create payment records for "Pending" status reservations
            // Only create if explicitly paid, partially paid (with amount > 0), or paid with points
            const shouldCreatePayment = paymentStatus === "Paid" || (paymentStatus === 'Partial' && (partialPaymentAmount || 0) > 0) || updatedReservationData.paidWithPoints;
            if (shouldCreatePayment) {
                const newPaymentRef = db.collection(`properties/${propertyId}/payments`).doc();

                let amountPaid = 0;
                if (updatedReservationData.paidWithPoints) {
                    amountPaid = updatedReservationData.totalPrice || 0;
                } else if (paymentStatus === 'Paid') {
                    amountPaid = updatedReservationData.totalPrice || 0;
                } else if (paymentStatus === 'Partial') {
                    amountPaid = partialPaymentAmount || 0;
                }

                // Use the payment method from the reservation if available, otherwise determine from payment status
                let paymentMethod = 'N/A';
                if (updatedReservationData.paidWithPoints) {
                    paymentMethod = 'Loyalty Points';
                } else if (updatedReservationData.paymentMethod) {
                    // Use the payment method selected during reservation creation
                    paymentMethod = updatedReservationData.paymentMethod;
                } else if (amountPaid > 0) {
                    paymentMethod = 'Credit Card';
                }

                if (updatedReservationData.source !== 'Direct') {
                    paymentMethod = 'Other';
                }

                transaction.set(newPaymentRef, {
                    propertyId,
                    guestName: updatedReservationData.guestName || "N/A",
                    amountPaid,
                    paymentMethod: paymentMethod,
                    date: format(new Date(), "yyyy-MM-dd"),
                    status: 'Paid',
                    invoiceId: newInvoiceRef.id,
                    reservationId,
                    reservationNumber: newReservationNumber,
                    notes: "Payment added during reservation creation",
                    createdAt: FieldValue.serverTimestamp(),
                    guestId: updatedReservationData.guestId ?? null,
                });

                // IMPORTANT: Also create ledger entry for the payment
                // This ensures the folio balance is tracked correctly
                const paymentLedgerId = `LEX-${reservationId}-${Date.now() + 1}-${Math.random()
                  .toString(36)
                  .substring(2, 8)
                  .toUpperCase()}`;

                const paymentSource = updatedReservationData.paidWithPoints ? 'LOYALTY_POINTS' : paymentMethod;
                const paymentDescription = `Room Accommodation - ${nights > 0 ? nights : 1} night(s) @ ${pricePerNight.toFixed(2)}\n${paymentMethod}`;

                const paymentTimestamp = Timestamp.now();
                const paymentEntry = cleanFirestoreData({
                  id: paymentLedgerId,
                  folioId: `main-guest-folio`,
                  type: "PAYMENT",
                  source: paymentSource,
                  amount: amountPaid,
                  direction: "CREDIT",
                  description: paymentDescription,
                  category: paymentMethod,
                  taxBreakdown: [],
                  createdAt: paymentTimestamp.toDate(),
                  createdBy: "system",
                  postingDate: format(paymentTimestamp.toDate(), "yyyy-MM-dd"),
                  isRefunded: false,
                  deleted: false,
                  immutable: true,
                });

                const paymentLedgerRef = db.doc(
                  `properties/${propertyId}/reservations/${reservationId}/folios/main-guest-folio/ledger/${paymentLedgerId}`
                );
                transaction.set(paymentLedgerRef, paymentEntry);

                logger.log(`Ledger entry created for payment during reservation creation`, {
                  reservationId,
                  paymentLedgerId,
                  amount: amountPaid,
                  method: paymentMethod,
                });
            } else {
                // For "Pending" status reservations, log that no payment record was created
                logger.log(`Reservation ${reservationId} has status "${paymentStatus}" - no payment record created.`);
            }

            // Write: Create notification if needed
            const notificationSettings = propertyData.notificationSettings || {};
            if (notificationSettings.new_reservation?.channels?.inApp) {
                const newNotificationRef = db.collection("notifications").doc();
                const primaryRoomName = updatedReservationData.rooms[0]?.roomTypeName || 'a room';
                transaction.set(newNotificationRef, {
                    propertyId, title: "New Reservation", description: `${updatedReservationData.guestName} booked ${primaryRoomName}.`,
                    type: "new_reservation", relatedDocId: reservationId, read: false, createdAt: FieldValue.serverTimestamp(),
                });
            }
        });

        logger.log(`Successfully processed reservation ${reservationId}`);
    } catch (error) {
        logger.error(`Failed to process reservation ${reservationId}:`, error);
    }
});
