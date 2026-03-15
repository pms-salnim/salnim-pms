import { Firestore } from "firebase/firestore";

export interface Property {
  address: ReactI18NextChildren | Iterable<ReactI18NextChildren>;
  phone: string | null | undefined;
  bookingPageSettings: any;
  logoUrl: any;
  id(db: Firestore, arg1: string, id: any): import("@firebase/firestore").DocumentReference<import("@firebase/firestore").DocumentData, import("@firebase/firestore").DocumentData>;
  name?: string;
  primaryColor?: string;
  secondaryColor?: string;
  currency?: string;
  logo?: string;
}

export interface Room {
  id?: string;
  name: string;
}

export interface Reservation {
  guestCountry: string;
  guestPassportOrId: string;
  reservationNumber: string;
  id: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  startDate: string;
  endDate: string;
  adults?: number;
  children?: number;
  additionalGuests?: any[];
  actualCheckInTime?: string;
  actualCheckOutTime?: string;
  status?: string;
}

export interface PaymentSummary {
  totalAmount: number;
  totalPaid: number;
  remainingBalance: number;
  paymentStatus: string;
}

export interface GuestPortalData {
  property: Property;
  reservation: Reservation;
  rooms: Room[];
  services: any[];
  mealPlans: any[];
  packages?: any[];
  menus?: any[];
  payments: any[];
  summary: PaymentSummary;
}

export interface GuestPortalMessage {
  id: string;
  conversationId: string;
  senderType: 'guest' | 'property';
  senderId: string;
  senderName: string;
  message: string;
  timestamp: any;
  status: 'sent' | 'delivered' | 'read';
}

export interface GuestPortalConversation {
  id: string;
  propertyId: string;
  reservationId: string;
  guestName: string;
  roomName: string;
  roomType: string;
  reservationStatus: string;
  lastMessage?: {
    text: string;
    senderType: 'guest' | 'property';
    senderName: string;
    timestamp: any;
  };
  unreadCount: number;
  guestUnreadCount: number;
  isActive: boolean;
}

export interface GuestPortalProps {
  data: GuestPortalData;
  onLogout: () => void;
}