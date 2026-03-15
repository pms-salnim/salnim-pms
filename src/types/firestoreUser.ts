
import type { Timestamp } from 'firebase/firestore';
import type { StaffRole, Permissions } from './staff';

export type PropertyType = "Hotel" | "Resort" | "Apartment" | "Villa";

export interface FirestoreUser {
  uid: string;
  fullName: string;
  email: string;
  role: StaffRole;
  propertyId: string; 
  permissions: Permissions;
  
  country?: string; 
  city?: string;    
  address?: string; 
  phone?: string; 
  preferredLanguage?: 'en' | 'fr';

  status?: 'online' | 'offline' | 'on_break' | 'busy';
  last_active?: Timestamp;
  profile_picture?: string;

  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
