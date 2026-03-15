
import type { Timestamp } from 'firebase/firestore';

export type ReservationStatus = 'Pending' | 'Confirmed' | 'Canceled' | 'No-Show' | 'Checked-in' | 'Completed';

export interface SelectedExtra {
  id: string; // service or meal plan ID
  name: string;
  price: number;
  unit: string; // e.g., 'one_time', 'per_night_per_guest'
  quantity: number;
  total: number;
  type: 'service' | 'meal_plan';
}

export interface ReservationRoom {
  pricingMode: string;
  roomTypeId: string;
  roomTypeName: string;
  roomId: string;
  roomName: string;
  ratePlanId: string;
  ratePlanName: string;
  price: number;
  adults: number;
  children: number;
  selectedExtras?: SelectedExtra[];
}

export interface Reservation {
  roomId: string;
  id: string;
  propertyId: string; // Foreign key to Property
  guestId: string | null; // Foreign key to Guest, can be null if guest details are embedded
  guestName?: string; // Denormalized for easier display
  guestEmail?: string;
  guestPassportOrId?: string;
  
  guestPhone?: string;
  guestCountry?: string; // New field for guest's country
  
  // New `rooms` array for multi-room bookings
  rooms: ReservationRoom[];

  source?: 'Direct' | 'Walk-in' | 'OTA';
  startDate: Timestamp | Date; // Firestore Timestamp on save, Date in component
  endDate: Timestamp | Date; // Firestore Timestamp on save, Date in component
  status: ReservationStatus;
  reservationNumber?: string; // User-friendly reservation number
  color?: string; // Optional color for the reservation bar
  totalPrice?: number;
  priceBeforeDiscount?: number; // The price before any promotions were applied.
  notes?: string;
  paymentStatus?: 'Pending' | 'Paid' | 'Partial' | 'Refunded';
  partialPaymentAmount?: number;
  paidWithPoints?: boolean;
  createdAt?: Timestamp | Date; // Firestore Timestamp on save, Date in component
  updatedAt?: Timestamp | Date; // Firestore Timestamp on save, Date in component
  actualCheckInTime?: Timestamp | Date;
  actualCheckOutTime?: Timestamp | Date;
  isCheckedOut: boolean;
  selectedExtras?: SelectedExtra[];
  promotionApplied?: {
    id: string;
    name: string;
    discountAmount: number;
    discountType: 'percentage' | 'flat_rate';
    discountValue: number;
  };
  packageInfo?: {
    id: string;
    name: string;
    includedServiceIds: string[];
    includedMealPlanIds: string[];
  };
  // Fields from ReservationData that might be missing
  roomsTotal?: number;
  extrasTotal?: number;
  subtotal?: number;
  discountAmount?: number;
  netAmount?: number;
  taxAmount?: number;

  // Legacy / convenience denormalized fields used across components
  roomName?: string;
  roomTypeName?: string;
  adults?: number;
  children?: number;
}
