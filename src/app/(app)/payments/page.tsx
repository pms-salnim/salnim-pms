
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';

// --- Type Definitions for Payments & Invoices Section ---

export interface InvoiceLineItem {
  id: string; // Used for React keys, not stored in Firestore
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string; // Firestore document ID
  propertyId: string;
  invoiceNumber: string;
  guestOrCompany: string;
  guestId?: string; // Optional link to a guest document
  guestEmail?: string;
  guestPhone?: string;
  reservationId?: string; // Optional link to a reservation document
  dateIssued: string; // Stored as ISO string "yyyy-MM-dd"
  dueDate: string; // Stored as ISO string "yyyy-MM-dd"
  amount: number;
  paymentStatus: 'Draft' | 'Pending' | 'Paid' | 'Overdue' | 'Refunded' | 'Partial';
  lineItems: Omit<InvoiceLineItem, 'id'>[]; // Don't store the React key 'id'
  notes?: string;
  
  // New fields for detailed PDF generation
  roomTypeName?: string;
  checkInDate?: string; // ISO string "yyyy-MM-dd"
  checkOutDate?: string; // ISO string "yyyy-MM-dd"
  numberOfNights?: number;
  numberOfGuests?: number;
  pricePerNight?: number;
  subtotal: number;
  taxAmount: number;
  discountType?: 'fixed' | 'percentage';
  discountValue?: number;
  discountAmount?: number;
  
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
}


export interface Payment {
  id: string; // Firestore document ID
  propertyId: string;
  paymentNumber?: string; 
  transactionId?: string; 
  date: string; // Stored as ISO string "yyyy-MM-dd"
  guestName: string; 
  guestId?: string;
  reservationId?: string;
  reservationNumber?: string;
  invoiceId?: string;
  amountPaid: number;
  paymentMethod: "Credit Card" | "Cash" | "Bank Transfer" | "Online Payment" | "Other" | "Loyalty Points";
  status: 'Paid' | 'Pending' | 'Refunded' | 'Failed';
  notes?: string;
  isRefund?: boolean; // New field to distinguish refunds
  originalPaymentId?: string; // New field to link refund to original payment
}


// --- Page Component ---

export default function PaymentsRootPage() {
  const router = useRouter();
  useEffect(() => {
    // Redirect to the dashboard
    router.replace('/payments/dashboard');
  }, [router]);

  return (
      <div className="flex h-full items-center justify-center">
        <Icons.Spinner className="h-8 w-8 animate-spin" /> 
        <p className="ml-2">Loading Payments...</p>
      </div>
  );
}

    