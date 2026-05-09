
import type { Timestamp } from 'firebase/firestore';

export type PricingMethod = 'per_guest' | 'per_night';
export type AdjustmentType = 'none' | 'fixed' | 'percentage';

export interface RatePlan {
  id: string; // Firestore document ID
  planName: string; // e.g., "Standard Rate", "Flexible Rate"
  description?: string;
  propertyId: string;
  roomTypeId: string; // Links to a single RoomType ID
  
  pricingMethod: PricingMethod; // 'per_guest' or 'per_night'
  basePrice?: number; // Only used if pricingMethod is 'per_night'
  pricingPerGuest?: Record<string, number>; // Only used if pricingMethod is 'per_guest'

  cancellationPolicy?: string; // Text description of the cancellation policy
  default: boolean; // Is this the default rate plan for the room type?
  
  // New date range fields
  startDate?: Timestamp;
  endDate?: Timestamp | null; // null for open-ended

  // Base rate derivation fields
  is_derived_from_base?: boolean; // Whether this plan is derived from base rate
  adjustment_type?: AdjustmentType; // Type of adjustment: 'none', 'fixed', or 'percentage'
  adjustment_value?: number; // Value of adjustment (dollar amount or percentage)

  createdBy: string; // UID of the user who created the plan
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
