
export interface InvoiceLineItem {
    id: string; 
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }
  
  export interface Invoice {
    guestEmail?: string;
    guestPhone?: string;
    id: string; 
    propertyId: string;
    invoiceNumber: string;
    guestOrCompany: string;
    guestId?: string | null; 
    reservationId?: string; 
    dateIssued: string; // Stored as ISO string "yyyy-MM-dd"
    dueDate: string; // Stored as ISO string "yyyy-MM-dd"
    amount: number;
    paymentStatus: 'Draft' | 'Pending' | 'Paid' | 'Overdue' | 'Refunded' | 'Partial';
    lineItems: Omit<InvoiceLineItem, 'id'>[]; 
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
    
    createdAt?: any; 
    updatedAt?: any; 
  }
  
  
  export interface Payment {
    id: string; // Firestore document ID
    propertyId: string;
    paymentNumber?: string; 
    transactionId?: string; 
    date: string; // Stored as ISO string "yyyy-MM-dd"
    guestName: string; 
    guestId?: string | null;
    reservationId?: string;
    reservationNumber?: string;
    invoiceId?: string;
    amountPaid: number;
    paymentMethod: "Credit Card" | "Cash" | "Bank Transfer" | "Online Payment" | "Other" | "Loyalty Points";
    status: 'Paid' | 'Pending' | 'Refunded' | 'Failed';
    notes?: string;
    isRefund?: boolean; // New field to distinguish refunds
    originalPaymentId?: string; // New field to link refund to original payment
    createdAt?: any;
  }
