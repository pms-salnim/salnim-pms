
import type { Timestamp } from 'firebase/firestore';

export type PackageCategory = 'stay_package' | 'experience_package' | 'seasonal_offer' | 'custom';
export type PricingType = 'fixed_price' | 'discounted_bundle' | 'per_night_surcharge';
export type PricingLogic = 'per_guest' | 'per_room';

export const packageCategories: { value: PackageCategory; label: string }[] = [
  { value: 'stay_package', label: 'Stay Package' },
  { value: 'experience_package', label: 'Experience Package' },
  { value: 'seasonal_offer', label: 'Seasonal Offer' },
  { value: 'custom', label: 'Custom' },
];

export const pricingTypes: { value: PricingType; label: string }[] = [
  { value: 'fixed_price', label: 'Fixed Package Price' },
  { value: 'discounted_bundle', label: 'Discounted Bundle' },
  { value: 'per_night_surcharge', label: 'Per Night Surcharge' },
];

export interface IncludedService {
  serviceId: string;
  quantity: number;
  mandatory: boolean;
}

export interface Package {
  id: string;
  propertyId: string;
  
  // Basics
  name: string;
  shortDescription?: string;
  fullDescription?: string;
  images?: string[];
  packageCategory: PackageCategory;
  
  // Room Rules
  applicableRoomTypes: string[];
  minimumNights: number;
  maximumNights?: number | null;
  
  // Meal Plans
  includedMealPlanId?: string | null;
  allowMealPlanUpgrade: boolean;
  
  // Services & Experiences
  includedServices: IncludedService[];
  
  // Pricing
  pricingType: PricingType;
  packagePrice: number;
  discountDisplay?: string;
  pricingLogic: PricingLogic;
  
  // Availability & Booking Rules
  validFrom?: Timestamp | null;
  validTo?: Timestamp | null;
  blackoutDates?: string[];
  advanceBookingDays?: number;
  cancellationPolicy?: string;
  stackableWithOffers: boolean;
  
  // Visibility & Channels
  visibleOnBooking: boolean;
  visibleInGuestPortal: boolean;
  autoApply: boolean;
  featured: boolean;
  status: 'Draft' | 'Active' | 'Archived';
  
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// Legacy support - will be deprecated
export type PackageType = 'fixed_nights' | 'per_guest_per_night' | 'per_night';
export const packageTypes: { value: PackageType; label: string }[] = [
  { value: 'fixed_nights', label: 'Fixed number of nights' },
  { value: 'per_night', label: 'Per night (flat rate)' },
  { value: 'per_guest_per_night', label: 'Per guest per night' },
];
