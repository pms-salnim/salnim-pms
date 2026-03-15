import type { Timestamp } from 'firebase/firestore';
import type { StaffRole } from './staff';

export type TaskStatus = 'Open' | 'In Progress' | 'Completed';
export const taskStatuses: TaskStatus[] = ['Open', 'In Progress', 'Completed'];

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export const taskPriorities: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

export interface Task {
  id: string; // Firestore document ID
  title: string;
  description?: string;
  
  // Assignment fields: one of these should be populated
  assigned_to_uid?: string | null;
  assigned_to_role?: StaffRole | null;
  
  // Denormalized fields for display
  assignedToName?: string;
  assignedToRoleDisplay?: StaffRole;
  
  created_by_uid: string;
  createdByName: string; // Denormalized name of creator
  
  property_id: string;
  
  room_id?: string | null; // Optional link to a specific room
  roomName?: string; // Denormalized room name
  roomTypeName?: string; // Denormalized room type name
  floor?: string; // Denormalized floor info

  priority: TaskPriority;
  status: TaskStatus;
  due_date?: Timestamp | null;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedByUid?: string;
  updatedByName?: string;

  // New fields for completion tracking
  completedAt?: Timestamp | null;
  completedByUid?: string | null;
  completedByName?: string | null;
  completedByRole?: StaffRole | null;
}
