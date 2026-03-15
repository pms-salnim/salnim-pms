
import type { Timestamp } from 'firebase/firestore';

export type DiscountType = 'percentage' | 'flat_rate';

export interface Promotion {
  id: string; // Firestore document ID
  propertyId: string;
  name: string;
  description?: string;
  
  ratePlanIds: string[]; // Array of Rate Plan IDs this promotion applies to

  discountType: DiscountType;
  discountValue: number; // The percentage or flat rate amount

  startDate: Timestamp;
  endDate: Timestamp;

  couponCode?: string | null; // Optional coupon code
  usageLimit?: number | null; // How many times a coupon can be used. null = unlimited
  timesUsed?: number; // Counter for usage

  active: boolean; // Status of the promotion

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
