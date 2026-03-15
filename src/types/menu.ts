import type { Timestamp } from 'firebase/firestore';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'ftour' | 'snacks' | 'custom';

export type DietaryTag = 'vegetarian' | 'vegan' | 'halal' | 'gluten-free' | 'dairy-free' | 'nut-free';

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  dietaryTags?: DietaryTag[];
  allergens?: string[];
  displayOrder: number;
}

export interface MenuSection {
  id: string;
  title: string;
  displayOrder: number;
  items: MenuItem[];
}

export interface Menu {
  id: string;
  name: string;
  mealType: MealType;
  shortDescription?: string;
  language?: string;
  
  // Linked meal plans
  linkedMealPlans: string[]; // array of meal plan IDs
  defaultForMealPlans?: string[]; // meal plan IDs where this is the default menu
  
  // Menu content
  sections: MenuSection[];
  
  // Availability
  availableDays?: string[]; // ['monday', 'tuesday', ...] or empty for daily
  validDateRange?: { start: string; end: string } | null;
  isSeasonal?: boolean;
  
  // Visibility
  visibleInGuestPortal: boolean;
  visibleDuringBooking: boolean;
  status: 'draft' | 'active';
  
  // Metadata
  propertyId: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
