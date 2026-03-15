
import type { Timestamp } from 'firebase/firestore';

export type MealPlanUnit = "per_night_per_guest" | "per_night_per_room" | "one_time_per_guest" | "one_time_per_room";

export const mealPlanUnits: MealPlanUnit[] = ["per_night_per_guest", "per_night_per_room", "one_time_per_guest", "one_time_per_room"];

export interface MealPlan {
  id: string;
  propertyId: string;
  name: string; // e.g., "Full American Breakfast", "Half Board"
  description?: string;
  price: number;
  unit: MealPlanUnit;
  taxable: boolean;
  active: boolean;
  
  // Optional Fields
  menuUrl?: string | null; // Link to a PDF or hosted menu
  imageUrl?: string | null;
  
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
