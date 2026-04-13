
export type DiscountType = 'percentage' | 'flat_rate';
export type PromotionType = 'automatic' | 'coupon';

export interface Promotion {
  id: string;
  propertyId: string;
  name: string;
  description?: string;
  
  ratePlanIds: string[]; // Array of Rate Plan IDs this promotion applies to

  promotionType: PromotionType; // 'automatic' or 'coupon'
  discountType: DiscountType;
  discountValue: number; // The percentage or flat rate amount

  startDate: Date | string;
  endDate: Date | string;

  couponCode?: string | null; // Optional coupon code
  usageLimit?: number | null; // How many times a coupon can be used. null = unlimited
  timesUsed?: number; // Counter for usage

  active: boolean; // Status of the promotion

  createdAt?: Date | string;
  updatedAt?: Date | string;
}
