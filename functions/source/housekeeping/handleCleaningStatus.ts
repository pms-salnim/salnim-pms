import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import { Timestamp } from "firebase-admin/firestore";
import type { Reservation } from "../types/reservation";
import type { Room } from "../types/room";

interface HousekeepingTask {
  id?: string;
  propertyId: string;
  roomId: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  status: 'assigned' | 'in-progress' | 'completed' | 'inspected';
  priority: 'normal' | 'high' | 'urgent';
  estimatedTime: number; // minutes
  actualStartTime?: Timestamp;
  actualEndTime?: Timestamp;
  checklist: Array<{
    id: string;
    task: string;
    category: string;
  }>;
  completedChecks: string[];
  notes?: string;
  assignedTo: string;
  assignedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Handles cleaning status automation when a reservation is checked out.
 * 
 * Triggers when a reservation is updated with:
 * 1. Status changed to 'Completed'
 * 2. isCheckedOut set to true
 * 
 * Actions performed for each room:
 * - Mark room cleaning status as 'dirty'
 * - Create a housekeeping task for staff
 */
export const onReservationCheckout = onDocumentUpdated("reservations/{reservationId}", async (event) => {
  try {
    const beforeData = event.data?.before.data() as Reservation | undefined;
    const afterData = event.data?.after.data() as Reservation | undefined;

    if (!beforeData || !afterData) {
      return;
    }

    // Trigger only when:
    // 1. Reservation status changes to 'Completed'
    // 2. Guest is checked out
    // 3. Has rooms assigned
    if (
      beforeData.status === afterData.status ||
      afterData.status !== 'Completed' ||
      !afterData.isCheckedOut ||
      !afterData.rooms || 
      afterData.rooms.length === 0
    ) {
      return;
    }

    const { propertyId, guestName, reservationNumber, rooms } = afterData;

    logger.log(`Processing checkout for reservation ${event.params.reservationId}: Guest ${guestName}, ${rooms.length} room(s)`);

    // Process each room in the multi-room booking
    for (const room of rooms) {
      const { roomId, roomName, roomTypeId } = room;

      try {
        // Get room information
        const roomDoc = await db.doc(`rooms/${roomId}`).get();
        if (!roomDoc.exists) {
          logger.warn(`Room ${roomId} not found for reservation ${event.params.reservationId}`);
          continue;
        }

        const roomData = roomDoc.data() as Room;
        const roomNumber = roomData.name || roomName || 'Unknown';

        // Get room type information for task checklist
        let roomTypeName = 'Standard Room';
        let taskChecklist: Array<{ id: string; task: string; category: string }> = [];

        try {
          const roomTypeDoc = await db.doc(`roomTypes/${roomTypeId}`).get();
          if (roomTypeDoc.exists) {
            const roomTypeData = roomTypeDoc.data();
            roomTypeName = roomTypeData?.name || 'Standard Room';
            
            // Get room type's cleaning checklist
            if (roomTypeData?.cleaningChecklist) {
              taskChecklist = roomTypeData.cleaningChecklist;
            }
          }
        } catch (error) {
          logger.warn(`Could not fetch room type ${roomTypeId}:`, error);
        }

        await db.runTransaction(async (transaction) => {
          // Update room status to 'dirty'
          const roomRef = db.doc(`rooms/${roomId}`);
          transaction.update(roomRef, {
            cleaningStatus: 'dirty',
            lastStatusUpdate: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });

          logger.log(`Room ${roomNumber} marked as dirty`);

          // Create housekeeping task
          const taskRef = db.collection('housekeepingTasks').doc();
          const newTask: HousekeepingTask = {
            propertyId,
            roomId,
            roomNumber,
            roomTypeId,
            roomTypeName,
            status: 'assigned',
            priority: 'normal', // Could be 'urgent' for late checkout scenarios
            estimatedTime: 45, // Default estimate, adjust based on room type
            checklist: taskChecklist.length > 0 
              ? taskChecklist 
              : [
                  { id: '1', task: 'Change bed linens', category: 'Bedding' },
                  { id: '2', task: 'Clean bathroom', category: 'Bathroom' },
                  { id: '3', task: 'Vacuum floors', category: 'Flooring' },
                  { id: '4', task: 'Dust surfaces', category: 'Surfaces' },
                  { id: '5', task: 'Empty trash bins', category: 'General' },
                  { id: '6', task: 'Restock amenities', category: 'Amenities' },
                ],
            completedChecks: [],
            notes: `Checkout from ${guestName || 'Guest'} - Reservation #${reservationNumber || event.params.reservationId}`,
            assignedTo: '', // Will be assigned by manager
            assignedAt: Timestamp.now(),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          transaction.set(taskRef, newTask);

          logger.log(`Created housekeeping task ${taskRef.id} for room ${roomNumber}`);
        });
      } catch (error) {
        logger.error(`Error processing room ${room.roomId} for reservation ${event.params.reservationId}:`, error);
        // Continue processing other rooms
      }
    }

    logger.log(`Successfully processed checkout for reservation ${event.params.reservationId}`);
  } catch (error) {
    logger.error(`Unexpected error in onReservationCheckout:`, error);
  }
});
