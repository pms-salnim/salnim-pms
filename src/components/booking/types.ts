

export interface GuestSelection {
  adults: number;
  children: number;
  rooms: number;
}

export interface SelectedRoom {
  selectionId: string; // A unique ID for the selection in the cart, e.g., 'roomtypeid-rateplanid-timestamp'
  roomId: string; 
  roomName: string; 
  roomTypeId: string;
  roomTypeName: string;
  ratePlanId: string;
  ratePlanName: string;
  guests: {
    adults: number;
    children: number;
  };
  nights: number;
  price: number; // Final price *after* discount
  priceBeforeDiscount?: number;
  promotionApplied?: {
    id: string;
    name: string;
    discountAmount: number;
  };
  packageDetails?: {
    id: string;
    name: string;
    includedServiceIds: string[];
    includedMealPlanIds: string[];
  };
}
