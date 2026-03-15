
import type { Timestamp } from 'firebase-admin/firestore';

export interface Property {
    id: string;
    name: string;
    address: string;
    phone?: string;
    email?: string;
    website?: string;
    currency?: string;
    bookingPageSettings?: {
        logoUrl?: string;
    };
    invoiceCustomization?: {
        logoUrl?: string;
        primaryColor?: string;
        footerText?: string;
        headerNotes?: string;
        includePropertyAddress?: boolean;
    };
    taxSettings?: {
        name?: string;
        rate?: number;
    };
}

export interface Reservation {
    id: string;
    guestEmail?: string;
    guestPhone?: string;
    reservationNumber?: string;
    promotionApplied?: {
        name: string;
    };
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string; 
  propertyId: string;
  invoiceNumber: string;
  guestOrCompany: string;
  guestId?: string; 
  reservationId?: string; 
  dateIssued: string;
  dueDate: string;
  amount: number;
  paymentStatus: 'Draft' | 'Pending' | 'Paid' | 'Overdue' | 'Refunded' | 'Partial';
  lineItems: InvoiceLineItem[]; 
  notes?: string;
  roomTypeName?: string;
  checkInDate?: string; 
  checkOutDate?: string; 
  numberOfNights?: number;
  numberOfGuests?: number;
  pricePerNight?: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  createdAt?: Timestamp; 
  updatedAt?: Timestamp; 
}
