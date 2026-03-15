
import type { Icons } from "@/components/icons";
import type { Timestamp } from "firebase/firestore";

export interface GuestTag {
  id: string;
  label: string;
  icon?: keyof typeof Icons;
}

export const guestTagsOptions: GuestTag[] = [
    { id: "vip", label: "VIP", icon: "Star" },
    { id: "repeat", label: "Repeat Guest", icon: "Repeat" },
    { id: "business", label: "Business", icon: "UsersRound" }, 
    { id: "leisure", label: "Leisure", icon: "UsersRound" },
    { id: "special-needs", label: "Special Needs", icon: "HelpCircle" },
];

export interface Guest {
  id: string; // Firestore document ID
  fullName: string;
  email: string;
  phone: string;
  nationality: string;
  country?: string; // Can be used interchangeably with nationality
  passportOrId?: string; // New optional field
  
  // Aggregated Stats
  lastStayDate?: string | Timestamp | Date; 
  totalNights?: number;
  totalSpent?: number;

  tags?: GuestTag[]; // Keep as is, can be an array of objects or strings
  propertyId: string; // Essential for scoping
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  
  // Loyalty Info
  loyaltyStatus?: 'enrolled' | 'not-enrolled'; // Enrollment status for loyalty program
  loyaltyPoints?: number;
  spendForNextPoint?: number;
  totalPointsEarned?: number;
  totalPointsRedeemed?: number;
  
  // Fields for GuestForm
  firstName?: string;
  lastName?: string;
  gender?: string;
  birthdate?: string | Date; // For form input, store as string or convert
  address?: string;
  internalNotes?: string;
}
