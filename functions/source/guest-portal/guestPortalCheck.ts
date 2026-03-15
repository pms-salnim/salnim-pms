import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
export const guestPortalCheck = onRequest({
    region: 'europe-west1',
    memory: '512MiB',
    cors: ['https://app.salnimpms.com', 'http://localhost:3000']
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' });
        return;
    }
    const bodyData = request.body.data || request.body;
    const cleanPropertySlug = bodyData.propertySlug?.toString().trim().toLowerCase();
    const cleanReservationNumber = bodyData.reservationNumber?.toString().trim();
    if (!cleanPropertySlug || !cleanReservationNumber) {
        response.status(400).send({ error: "Missing 'propertySlug' or 'reservationNumber'." });
        return;
    }
    try {
        const propertyQuery = await db.collection("properties").where("slug", "==", cleanPropertySlug).limit(1).get();
        if (propertyQuery.empty) {
            response.status(404).send({ error: "Property not found" });
            return;
        }
        const propertyDoc = propertyQuery.docs[0];
        const propertyId = propertyDoc.id;
        const property = propertyDoc.data();
        const reservationQuery = await db.collection("reservations")
            .where("propertyId", "==", propertyId)
            .where("reservationNumber", "==", cleanReservationNumber)
            .limit(1).get();
        if (reservationQuery.empty) {
            response.status(404).send({ error: "Reservation not found." });
            return;
        }
        const reservationDoc = reservationQuery.docs[0];
        const reservation = reservationDoc.data();
        const toDate = (ts: any) => ts?.toDate?.() || ts;
        
        // Calculate total adults and children from rooms array
        const totalAdults = (reservation.rooms || []).reduce((sum: number, room: any) => sum + (room.adults || 0), 0) || 1;
        const totalChildren = (reservation.rooms || []).reduce((sum: number, room: any) => sum + (room.children || 0), 0) || 0;
        
        const processedReservation = {
            ...reservation,
            id: reservationDoc.id,
            adults: totalAdults,
            children: totalChildren,
            additionalGuests: Array.isArray(reservation.additionalGuests) ? reservation.additionalGuests : [],
            startDate: toDate(reservation.startDate),
            endDate: toDate(reservation.endDate),
            createdAt: toDate(reservation.createdAt),
            updatedAt: toDate(reservation.updatedAt),
            actualCheckInTime: toDate(reservation.actualCheckInTime),
            actualCheckOutTime: toDate(reservation.actualCheckOutTime),
        };
        const roomIds: string[] = reservation.rooms?.map((r: any) => r.roomId) || [];
        const roomTypeIds: string[] = [...new Set(reservation.rooms?.map((r: any) => r.roomTypeId) || [])] as string[];
        const ratePlanIds: string[] = [...new Set(reservation.rooms?.map((r: any) => r.ratePlanId).filter(Boolean) || [])] as string[];
        const [roomsSnaps, roomTypesSnaps, ratePlansSnaps] = await Promise.all([
            Promise.all(roomIds.map((id: string) => db.doc(`rooms/${id}`).get())),
            Promise.all(roomTypeIds.map((id: string) => db.doc(`roomTypes/${id}`).get())),
            Promise.all(ratePlanIds.map((id: string) => db.doc(`ratePlans/${id}`).get()))
        ]);
        const roomsData = roomsSnaps.filter(s => s.exists).map((s, i) => ({ ...s.data(), id: s.id, reservationData: reservation.rooms[i] }));
        const roomTypesData = roomTypesSnaps.filter(s => s.exists).map(s => ({ ...s.data(), id: s.id }));
        const ratePlansData = ratePlansSnaps.filter(s => s.exists).map(s => ({ ...s.data(), id: s.id }));
        const serviceIds = [...new Set(reservation.rooms?.flatMap((r: any) => r.selectedExtras?.filter((e: any) => e.type === 'service').map((e: any) => e.id) || []) || [])];
        const mealPlanIds = [...new Set(reservation.rooms?.flatMap((r: any) => r.selectedExtras?.filter((e: any) => e.type === 'meal_plan').map((e: any) => e.id) || []) || [])];
        const [servicesSnaps, mealPlansSnaps] = await Promise.all([
            Promise.all(serviceIds.map(id => db.doc(`services/${id}`).get())),
            Promise.all(mealPlanIds.map(id => db.doc(`mealPlans/${id}`).get()))
        ]);
        const servicesData = servicesSnaps.filter(s => s.exists).map(s => ({ ...s.data(), id: s.id }));
        const mealPlansData = mealPlansSnaps.filter(s => s.exists).map(s => ({ ...s.data(), id: s.id }));
        const paymentsSnapshot = await db.collection(`properties/${propertyId}/payments`).where("reservationId", "==", reservationDoc.id).orderBy("createdAt", "desc").get();
        const payments = paymentsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, createdAt: toDate(doc.data().createdAt) }));
        const totalPaid = payments.filter((p: any) => p.status === 'Paid').reduce((sum: number, p: any) => sum + (p.amountPaid || 0), 0);
        const totalAmount = (reservation.totalPrice || 0);
        const remainingBalance = totalAmount - totalPaid;
        response.status(200).send({
            success: true,
            data: {
                property: { id: propertyId, ...property },
                reservation: processedReservation,
                rooms: roomsData,
                roomTypes: roomTypesData,
                ratePlans: ratePlansData,
                services: servicesData,
                mealPlans: mealPlansData,
                payments,
                summary: { totalAmount, totalPaid, remainingBalance, paymentStatus: remainingBalance <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'pending' }
            }
        });
    } catch (error) {
        logger.error("Error in guestPortalCheck:", error);
        response.status(500).send({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" });
    }
});