
import type { Timestamp } from 'firebase/firestore';

export interface SeasonalRate {
  id: string; // Firestore document ID
  propertyId: string;
  name: string; // e.g., "Christmas Special", "Summer High Season"
  ratePlanId: string; // ID of the rate plan this rule applies to
  
  startDate: Date; // Firestore Timestamp on save, Date in component
  endDate: Date; // Firestore Timestamp on save, Date in component

  // A seasonal rule can override either type of pricing.
  // The system will check the parent rate plan's `pricingMethod`
  // to decide which of these values to use.
  basePrice?: number; // Override for 'per_night' rate plans
  pricingPerGuest?: Record<string, number>; // Override for 'per_guest' rate plans
  
  active: boolean; // Controls if the seasonal rate is currently applied

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
