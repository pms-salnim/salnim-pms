
import type { Timestamp } from 'firebase/firestore';

export type MaintenanceRequestStatus = 'Pending' | 'In Progress' | 'Resolved';

export const maintenanceRequestStatuses: MaintenanceRequestStatus[] = ['Pending', 'In Progress', 'Resolved'];

export interface MaintenanceRequest {
  id: string;
  propertyId: string;
  roomId: string;
  roomName: string;
  issue: string;
  status: MaintenanceRequestStatus;
  reportedBy: string; // User ID
  reportedByName?: string; // Denormalized name
  assignedTo?: string; // User ID
  assignedToName?: string; // Denormalized name
  createdAt: Timestamp;
  resolvedAt?: Timestamp;
}
