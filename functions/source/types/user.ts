
import type { StaffRole, Permissions } from "./staff";

export interface User {
  id: string;
  name: string;
  email: string;
  role?: StaffRole; 
  propertyId: string; // Ensure propertyId is not optional here if app logic relies on it
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  preferredLanguage?: 'en' | 'fr';
  permissions: Permissions;
}
