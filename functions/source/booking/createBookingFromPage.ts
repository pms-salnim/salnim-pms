
import { onRequest, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import {
  startOfDay,
  parseISO,
} from "date-fns";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { Property } from "../types/property";
import type { Reservation, ReservationRoom } from '../types/reservation';
import { checkMultipleRoomsAvailability } from "../lib/checkSupabaseAvailability";

/**
 * [PUBLIC] Creates a reservation from the public booking page.
 */
export const createBookingFromPage = onRequest({ 
  region: 'europe-west1', 
  memory: "512MiB",
  cors: true 
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).send({ error: "Method Not Allowed" });
        return;
    }

      const { propertySlug, guestData, bookingState } = request.body.data;

      if (!propertySlug || !guestData || !bookingState || !bookingState.selections || bookingState.selections.length === 0) {
          response.status(400).send({ error: "Missing required data." });
          return;
      }
      
      const { selections, dateRange, ...pricingDetails } = bookingState;

      const propertyQuery = db.collection("properties").where("slug", "==", propertySlug).limit(1);
      const propertySnapshot = await propertyQuery.get();
      if (propertySnapshot.empty) {
          response.status(404).send({ error: "Property not found." });
          return;
      }
      
      const propertyId = propertySnapshot.docs[0].id;
      const propertyData = propertySnapshot.docs[0].data() as Property;
      const defaultStatus = propertyData.bookingPageSettings?.defaultBookingStatus || "Pending";
      
      const requestedFrom = startOfDay(parseISO(dateRange.from));
      const requestedTo = parseISO(dateRange.to);

      // Pre-check Supabase availability to catch race conditions early
      const roomIds = selections.map((s: any) => s.roomId);
      const supabaseAvailability = await checkMultipleRoomsAvailability(
          roomIds,
          propertyId,
          requestedFrom,
          requestedTo
      );

      // Verify all selected rooms are available in Supabase
      for (const selection of selections) {
          if (supabaseAvailability[selection.roomId] !== true) {
              response.status(409).send({ 
                  error: `Room ${selection.roomName} is no longer available for the selected dates. Please check availability and try again.` 
              });
              return;
          }
      }

      try {
          const allGuestsSnapshot = await db.collection("guests")
              .where("propertyId", "==", propertyId)
              .get();

          const existingGuest = (guestData.email && guestData.email.trim() !== '') 
            ? allGuestsSnapshot.docs.find(doc => doc.data().email?.toLowerCase() === guestData.email.toLowerCase())
            : undefined;

          const { newReservationId } = await db.runTransaction(async (transaction) => {
              
              for (const selection of selections) {
                const reservationsQuery = db.collection("reservations")
                    .where("rooms.roomId", "==", selection.roomId)
                    .where("status", "in", ["Confirmed", "Pending", "Checked-in"]);
                const reservationsSnapshot = await transaction.get(reservationsQuery);
                if (reservationsSnapshot.docs.some(d => requestedFrom < (d.data().endDate as Timestamp).toDate() && requestedTo > (d.data().startDate as Timestamp).toDate())) {
                    throw new HttpsError("failed-precondition", `Room ${selection.roomName} is no longer available for the selected dates.`);
                }
              }

              let guestId: string | undefined;
              if (existingGuest) {
                  guestId = existingGuest.id;
              } else if (guestData.email || guestData.phone) { // Only create if we have contact info
                  const newGuestRef = db.collection("guests").doc();
                  transaction.set(newGuestRef, {
                      fullName: guestData.fullName, 
                      email: guestData.email || null, 
                      phone: guestData.phone || null,
                      nationality: guestData.country || "", 
                      propertyId, 
                      loyaltyStatus: 'not-enrolled',
                      loyaltyPoints: 0,
                      totalPointsEarned: 0,
                      totalPointsRedeemed: 0,
                      passportOrId: guestData.passportOrId || null, // Save passport/ID
                      createdAt: FieldValue.serverTimestamp(),
                  });
                  guestId = newGuestRef.id;
              }
              
              const newReservationRef = db.collection("reservations").doc();
              const reservationId = newReservationRef.id;

              const payload: Omit<Partial<Reservation>, 'createdAt'> & { createdAt: FieldValue } = {
                  id: reservationId,
                  propertyId,
                  guestId: guestId || null,
                  guestName: guestData.fullName,
                  guestEmail: guestData.email || null,
                  guestPhone: guestData.phone || null,
                  guestCountry: guestData.country,
                  
                  rooms: selections as ReservationRoom[],
                  
                  startDate: Timestamp.fromDate(requestedFrom) as unknown as Date,
                  endDate: Timestamp.fromDate(requestedTo) as unknown as Date,
                  
                  status: defaultStatus,
                  paymentStatus: "Pending",
                  paidWithPoints: false,
                  source: "Direct",
                  notes: guestData.notes,
                  createdAt: FieldValue.serverTimestamp(),
                  
                  roomsTotal: pricingDetails.roomsTotal ?? 0,
                  extrasTotal: pricingDetails.extrasTotal ?? 0,
                  subtotal: pricingDetails.subtotal ?? 0,
                  discountAmount: pricingDetails.discountAmount ?? 0,
                  netAmount: pricingDetails.netAmount ?? 0,
                  taxAmount: pricingDetails.taxAmount ?? 0,
                  totalPrice: pricingDetails.totalPrice ?? 0,
                  priceBeforeDiscount: pricingDetails.priceBeforeDiscount ?? 0,
                  promotionApplied: bookingState.appliedPromotion || null,
                  isCheckedOut: false,
                  partialPaymentAmount: 0,
              };
              
              transaction.set(newReservationRef, payload);
              return { newReservationId: reservationId };
          });
          
          response.status(200).send({ data: { success: true, reservationId: newReservationId } });

      } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "An unknown error.";
          logger.error("Booking transaction failed:", errorMessage);
          if (error instanceof HttpsError) {
              response.status(400).send({ error: error.message, code: error.code });
          } else {
              response.status(500).send({ error: "Could not complete the booking." });
          }
      }
});
