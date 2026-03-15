
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import { format, parseISO, differenceInDays } from "date-fns";
import { sendTemplatedEmail } from "./sendTemplatedEmail";
import type { Property } from "../types/property";
import type { Invoice } from "../types/payment";
import type { Reservation, ReservationRoom } from "../types/reservation";

export const sendInvoiceByEmail = onCall({ region: 'europe-west1', memory: '512MiB' }, async (request: CallableRequest) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated.");
    }
    
    if (!request.data) {
        throw new HttpsError("invalid-argument", "Request payload is missing.");
    }

    const {
      propertyId, invoice, recipientEmail, pdfDataUri,
    } = request.data as { propertyId: string; invoice: Invoice; recipientEmail: string; pdfDataUri: string; };

    if (!propertyId || !invoice || !recipientEmail || !pdfDataUri) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    const propDocRef = db.doc(`properties/${propertyId}`);
    const propDocSnap = await propDocRef.get();

    if (!propDocSnap.exists) {
      throw new HttpsError("not-found", "Property configuration not found.");
    }

    const propertyData = propDocSnap.data() as Property;

    // Fetch reservation data to get more details for variables
    let reservationData: Reservation | null = null;
    if (invoice.reservationId) {
        const resDocRef = db.doc(`reservations/${invoice.reservationId}`);
        const resDocSnap = await resDocRef.get(); // Corrected to use .get() method
        if (resDocSnap.exists) {
            const data = resDocSnap.data();
            // Ensure dates are converted from Timestamps if they exist
            if (data) {
                reservationData = {
                    ...data,
                    id: resDocSnap.id,
                    startDate: (data.startDate as any)?.toDate ? (data.startDate as any).toDate() : new Date(data.startDate),
                    endDate: (data.endDate as any)?.toDate ? (data.endDate as any).toDate() : new Date(data.endDate),
                } as Reservation;
            }
        }
    }
    
    const currencySymbol = propertyData.currency || "$";
    const nights = reservationData ? differenceInDays(reservationData.endDate, reservationData.startDate) : (invoice.numberOfNights || 0);
    
    const rooms = reservationData?.rooms;
    const guests = (rooms && Array.isArray(rooms) && rooms.length > 0 && rooms[0]) 
        ? ((rooms[0].adults || 0) + (rooms[0].children || 0)) 
        : (invoice.numberOfGuests || 0);
    
    let extrasText = "";
    if (Array.isArray(reservationData?.rooms) && reservationData?.rooms?.some(room => room.selectedExtras && room.selectedExtras.length > 0)) {
        extrasText += "\n\n--- Extras ---";
        reservationData.rooms.forEach(room => {
            (room.selectedExtras || []).forEach(extra => {
                extrasText += `\n- ${extra.name} (x${extra.quantity}): ${currencySymbol}${extra.total.toFixed(2)}`;
            });
        });
    }


    const emailVariables: {[key: string]: string | number | undefined} = {
        guest_name: invoice.guestOrCompany || "Valued Guest",
        reservation_code: (reservationData?.id) || invoice.reservationId || "N/A",
        reservation_number: (reservationData?.reservationNumber) || (invoice.reservationId?.substring(0, 8)),
        check_in_date: invoice.checkInDate ? format(parseISO(invoice.checkInDate), "PP") : (reservationData ? format(reservationData.startDate, "PP") : "N/A"),
        check_out_date: invoice.checkOutDate ? format(parseISO(invoice.checkOutDate), "PP") : (reservationData ? format(reservationData.endDate, "PP") : "N/A"),
        room_type: invoice.roomTypeName || (Array.isArray(reservationData?.rooms) && reservationData?.rooms.map((r: ReservationRoom) => r.roomTypeName).join(', ')) || "N/A",
        room_number: (Array.isArray(reservationData?.rooms) && reservationData?.rooms.map((r: ReservationRoom) => r.roomName).join(', ')) || "N/A",
        number_of_nights: nights,
        number_of_guests: guests,
        price_per_night: `${currencySymbol}${(invoice.pricePerNight || 0).toFixed(2)}`,
        total_price: `${currencySymbol}${invoice.amount.toFixed(2)}`,
        total_taxes: `${currencySymbol}${(invoice.taxAmount || 0).toFixed(2)}`,
        invoice_number: invoice.invoiceNumber,
        invoice_amount: `${currencySymbol}${invoice.amount.toFixed(2)}`,
        invoice_due_date: invoice.dueDate ? format(parseISO(invoice.dueDate), 'PP') : "N/A",
        extras: extrasText,
    };
    
    const attachments = [
      {
        filename: `invoice-${invoice.invoiceNumber}.pdf`,
        path: pdfDataUri,
      },
    ];

    try {
        await sendTemplatedEmail(propertyData, 'invoice_email', recipientEmail, emailVariables, attachments);
        logger.log(`Invoice email sent successfully to ${recipientEmail}.`);
        return { success: true, message: "Email sent successfully!" };
    } catch (error) {
        logger.error("Error sending invoice email via sendTemplatedEmail:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new HttpsError("internal", `Failed to send email: ${errorMessage}`);
    }
  });
