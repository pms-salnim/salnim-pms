
import type { Timestamp } from 'firebase/firestore';
import type { Reservation } from '@/types/reservation';

export type { Reservation };

export type ReservationStatus = 'Pending' | 'Confirmed' | 'Canceled' | 'No-Show' | 'Checked-in' | 'Completed';

export interface SelectedExtra {
  id: string; // service or meal plan ID
  name: string;
  description?: string;
  price: number; // The price per unit
  unit: string; // e.g., 'one_time', 'per_night_per_guest'
  quantity: number;
  total: number; // The calculated total price for this extra
  type: 'service' | 'meal_plan';
}


export interface ReservationRoom {
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
  pricingMode?: 'rate_plan' | 'manual'; // New field
  manualPrice?: number; // New field
}
