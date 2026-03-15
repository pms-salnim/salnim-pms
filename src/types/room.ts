
import type { Timestamp } from 'firebase/firestore';

export type OccupancyStatus = "empty" | "occupied";
export type CleaningStatus = "clean" | "dirty" | "in_progress" | "out_of_order";

// Legacy status type - kept for backwards compatibility
export type RoomStatus = "Available" | "Occupied" | "Maintenance" | "Cleaning" | "Dirty" | "Out of Order";

export const occupancyStatuses: OccupancyStatus[] = ["empty", "occupied"];
export const cleaningStatuses: CleaningStatus[] = ["clean", "dirty", "in_progress", "out_of_order"];
export const roomStatuses: RoomStatus[] = ["Available", "Occupied", "Maintenance", "Cleaning", "Dirty", "Out of Order"];


export interface Room {
  id: string; // Firestore document ID
  name: string; // e.g., "Room 101", "Deluxe King Suite" - This is the primary identifier
  roomNumber?: string; // Optional, if a more formal/numeric room number is needed and is different from 'name'
  roomTypeId: string; // Foreign key to RoomType collection
  propertyId: string;
  
  // New independent state fields
  occupancyStatus: OccupancyStatus; // empty | occupied
  cleaningStatus: CleaningStatus; // clean | dirty | in_progress | out_of_order
  
  // Legacy field - deprecating in favor of separate fields above
  status?: RoomStatus;
  
  floor?: string; // New field for floor number/name
  amenities?: string[]; // List of amenities like "WiFi", "AC", "Minibar"
  notes?: string; // Internal notes about the room
  
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
