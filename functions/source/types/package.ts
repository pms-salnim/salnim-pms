
import type { Timestamp } from 'firebase/firestore';

export type PackageType = 'fixed_nights' | 'per_guest_per_night' | 'per_night';

export const packageTypes: { value: PackageType; label: string }[] = [
  { value: 'fixed_nights', label: 'Fixed number of nights' },
  { value: 'per_night', label: 'Per night (flat rate)' },
  { value: 'per_guest_per_night', label: 'Per guest per night' },
];

export interface Package {
  id: string; // Firestore document ID
  propertyId: string;
  name: string;
  description?: string;
  
  packageType: PackageType;
  price: number;
  numberOfNights?: number | null; // Required only if packageType is 'fixed_nights'
  numberOfGuests: number; // For 'fixed_nights' it's the exact number. For others, it's the maximum allowed.

  // IDs of included items
  includedRoomTypeIds: string[];
  includedServiceIds: string[];
  includedMealPlanIds: string[];
  
  imageUrl?: string;

  active: boolean; // Status of the package

  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
