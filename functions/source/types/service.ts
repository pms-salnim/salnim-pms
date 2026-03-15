
import type { Timestamp } from 'firebase/firestore';

export type ServiceUnit = "per_booking" | "per_night" | "per_guest" | "one_time";

export const serviceUnits: ServiceUnit[] = ["one_time", "per_booking", "per_night", "per_guest"];

export interface Service {
  id: string;
  propertyId: string;
  name: string;
  description?: string;
  price: number;
  unit: ServiceUnit;
  taxable: boolean;
  active: boolean;
  imageUrl?: string;
  applicableTo?: {
    roomTypeIds?: string[];
  };
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
