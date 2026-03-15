
import type { Timestamp } from 'firebase/firestore';

// Renamed from AvailabilityOverride to AvailabilitySetting
// and updated fields to match the new Firestore structure.
export interface AvailabilitySetting {
  id: string; // Firestore document ID
  propertyId: string;
  roomTypeId: string;
  roomId?: string | null; // If defined, applies to a specific room; otherwise applies to all rooms in the type
  startDate: string;      // Start date of the block (format: YYYY-MM-DD)
  endDate: string;        // End date of the block (inclusive, format: YYYY-MM-DD)
  status: 'blocked' | 'available'; // Status of the availability block
  createdBy?: string;      // UID of the user who made the change
  notes?: string | null;   // Optional reason or notes

  createdAt?: Timestamp;
  updatedAt?: Timestamp; // Optional for consistency
}
