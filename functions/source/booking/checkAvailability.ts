
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import {
  startOfDay,
  parseISO,
  isValid,
  eachDayOfInterval,
  addDays,
  isWithinInterval,
} from "date-fns";
import type { Timestamp } from "firebase-admin/firestore";
import type { Room, RoomType, RatePlan, AvailabilitySetting, ReservationRoom } from "../types/index";
import { checkMultipleRoomsAvailability } from "../lib/checkSupabaseAvailability";

/**
 * [PUBLIC] Checks room type availability for a given date range.
 */
export const checkAvailability = onRequest({ 
  region: 'europe-west1', 
  memory: '512MiB',
  cors: true 
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' });
        return;
    }

        const { propertySlug, startDate, endDate, adults, children, } = request.body.data;
        if (!propertySlug || !startDate || !endDate) {
            response.status(400).send({ error: "Missing required fields." });
            return;
        }
        
        const propertyQuery = db.collection("properties").where("slug", "==", propertySlug).limit(1);
        const propertySnapshot = await propertyQuery.get();
        if (propertySnapshot.empty) {
            response.status(404).send({ error: "Property not found." });
            return;
        }
        const propertyId = propertySnapshot.docs[0].id;
        
        const requestedFrom = startOfDay(parseISO(startDate));
        const requestedTo = startOfDay(parseISO(endDate));

        if (!isValid(requestedFrom) || !isValid(requestedTo)) {
            response.status(400).send({ error: "Invalid date format provided. Please use ISO 8601 format." });
            return;
        }

        if (requestedFrom >= requestedTo) {
            response.status(400).send({ error: "End date must be after start." });
            return;
        }
        try {
          // Fetch all necessary data in parallel
          const roomsQuery = db.collection("rooms")
            .where("propertyId", "==", propertyId);
          const roomTypesQuery = db.collection("roomTypes")
            .where("propertyId", "==", propertyId);
          const ratePlansQuery = db.collection("ratePlans")
            .where("propertyId", "==", propertyId);
          const reservationsQuery = db.collection("reservations")
            .where("propertyId", "==", propertyId)
            .where("status", "in", ["Confirmed", "Pending", "Checked-in"]);
          const availabilitySettingsPromise = db.collection("availability")
            .where("propertyId", "==", propertyId).get();

          const [
            roomsSnapshot,
            roomTypesSnapshot,
            ratePlansSnapshot,
            reservationsSnapshot,
            availabilitySettingsSnapshot,
          ] = await Promise.all([
            roomsQuery.get(),
            roomTypesQuery.get(),
            ratePlansQuery.get(),
            reservationsQuery.get(),
            availabilitySettingsPromise,
          ]);
          const allRooms: Room[] = roomsSnapshot.docs.map((d) => ({
            id: d.id, ...d.data(),
          } as Room));
          const allRoomTypes: RoomType[] = roomTypesSnapshot.docs.map((d) => ({
            id: d.id, ...d.data(),
          } as RoomType));
          const allRatePlans: RatePlan[] = ratePlansSnapshot.docs.map((d) => ({
            id: d.id, ...d.data(),
          } as RatePlan));
          const existingReservations = reservationsSnapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              startDate: (data.startDate as Timestamp).toDate(),
              endDate: (data.endDate as Timestamp).toDate(),
              rooms: (data.rooms || [{ roomId: data.roomId }]) as ReservationRoom[], // Handle both old and new format
              status: data.status,
            };
          });
          const availabilitySettings: AvailabilitySetting[] = availabilitySettingsSnapshot.docs
            .map((d) => d.data() as AvailabilitySetting);
            
          const results: any[] = [];
          const totalGuests = (adults || 0) + (children || 0);
          for (const rt of allRoomTypes) {
            if (totalGuests > rt.maxGuests) continue;
            const physicalRoomsForType = allRooms
              .filter((r) => r.roomTypeId === rt.id);
            if (physicalRoomsForType.length === 0) continue;

            const daysInReqRange = eachDayOfInterval({
              start: requestedFrom, end: addDays(requestedTo, -1),
            });
            
            const availablePhysicalRooms = physicalRoomsForType.filter((room: Room) => {
                // For a room to be available, EVERY day in the range must be available
                return daysInReqRange.every(day => {
                    const dayStart = startOfDay(day);

                    // 1. Check against existing reservations
                    const isBooked = existingReservations.some((res) => 
                      res.rooms.some((r) => r.roomId === room.id) &&
                      dayStart >= startOfDay(res.startDate) && 
                      dayStart < startOfDay(res.endDate)
                    );
                    if (isBooked) return false;

                    // 2. Check against availability settings (new strict logic)
                    const applicableSettings = availabilitySettings
                        .filter((s: AvailabilitySetting) => 
                            (s.roomId === room.id || (s.roomTypeId === rt.id && !s.roomId)) &&
                            isWithinInterval(dayStart, { start: parseISO(s.startDate), end: parseISO(s.endDate) })
                        )
                        .sort((a: AvailabilitySetting, b: AvailabilitySetting) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

                    if (applicableSettings.length > 0) {
                        const latestSetting = applicableSettings[0];
                        return latestSetting.status === 'available';
                    }

                    // 3. If no settings apply for this day, it is considered unavailable by default.
                    return false;
                });
            });


            if (availablePhysicalRooms.length > 0) {
                // 4. Check against Supabase availability calendar as additional validation layer
                const supabaseAvailableRooms = await checkMultipleRoomsAvailability(
                    availablePhysicalRooms.map((r: Room) => r.id),
                    propertyId,
                    requestedFrom,
                    requestedTo
                );

                // Filter to only rooms available in both Firestore and Supabase
                const finalAvailableRooms = availablePhysicalRooms.filter((r: Room) => 
                    supabaseAvailableRooms[r.id] === true
                );

                if (finalAvailableRooms.length === 0) continue;

                const ratePlansForType = allRatePlans.filter((rp: RatePlan) => {
                    if (rp.roomTypeId !== rt.id) return false;
                    if (!rp.startDate || !rp.endDate) return true; // Always valid if no dates
                    const planStart = (rp.startDate as Timestamp).toDate();
                    const planEnd = (rp.endDate as Timestamp).toDate();
                    return startOfDay(planStart) <= requestedTo && startOfDay(planEnd) >= requestedFrom;
                });

                if (ratePlansForType.length === 0) continue;

                let cheapestRate = Infinity;
                ratePlansForType.forEach((rp: RatePlan) => {
                    let currentRate = rt.baseRate ?? 0;
                     if (rp.pricingMethod === 'per_night') {
                        currentRate = rp.basePrice ?? currentRate;
                    } else if (rp.pricingMethod === 'per_guest') {
                        const guests = adults || 1;
                        if (rp.pricingPerGuest) {
                            currentRate = rp.pricingPerGuest[guests.toString()] ?? rp.pricingPerGuest['1'] ?? currentRate;
                        }
                    }
                    if (currentRate < cheapestRate) {
                        cheapestRate = currentRate;
                    }
                });

                results.push({
                    ...rt,
                    availableUnits: finalAvailableRooms.length,
                    availableRooms: finalAvailableRooms.map((r: Room) => ({
                      id: r.id, name: r.name,
                    })),
                    cheapestRate: cheapestRate === Infinity ? (rt.baseRate ?? 0) : cheapestRate,
                    ratePlans: ratePlansForType,
                });
            }
          }
          response.send({ data: { availableRoomTypes: results } });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "An unknown error occurred.";
          logger.error("Error checking availability:", errorMessage);
          response.status(500).send({ error: "An unexpected error occurred." });
        }
});
