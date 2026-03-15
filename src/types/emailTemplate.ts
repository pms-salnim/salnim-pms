
import type { Timestamp } from "firebase-admin/firestore";

export type EmailTemplateStatus = 'draft' | 'live' | 'disabled';

export type EmailTemplateType = 
  | "reservation_confirmation"
  | "booking_confirmation"
  | "reservation_modification"
  | "reservation_cancellation"
  | "payment_confirmation"
  | "bank_transfer_info"
  | "mail_order_info"
  | "invoice_email"
  | "internal_new_reservation"  // New internal template
  | "internal_cancellation_alert"; // New internal template

export interface EmailTemplate {
  id: string; // Composite key like: `${type}_${propertyId}`
  propertyId: string;
  type: EmailTemplateType;
  subject: string;
  body: string;
  status: EmailTemplateStatus;
  lastEditedAt?: Timestamp;
  lastEditedBy?: string; // Staff member's name or UID
}

export const emailTemplateTypes: {
    type: EmailTemplateType;
    name: string;
    description: string;
    defaultSubject: string;
    defaultBody: string;
}[] = [
    { 
        type: "reservation_confirmation", 
        name: "Reservation Information Email", 
        description: "Sent to the guest automatically when a reservation is made or manually triggered.",
        defaultSubject: "Your Reservation Details – {{property_name}}",
        defaultBody: "Hello {{guest_name}},\n\nThank you for booking with {{property_name}}!\nHere are your reservation details:\n\nReservation Information:\n- Reservation Number: {{reservation_number}}\n- Check-in: {{check_in_date}}\n- Check-out: {{check_out_date}}\n- Number of Nights: {{number_of_nights}}\n- Number of Guests: {{number_of_guests}}\n\nAccommodation:\n- Room Type: {{room_type}}\n- Room Number: {{room_number}}\n- Extras: {{extras}}\n\n{{price_breakdown}}\n\nProperty Information:\n- Address: {{property_address}}\n- Phone: {{property_phone}}\n- Email: {{property_email}}\n\nIf you have any questions about your reservation, feel free to contact us.\nWe look forward to welcoming you soon!\n\nBest regards,\nThe {{property_name}} Team"
    },
    {
        type: "booking_confirmation",
        name: "Booking Confirmation",
        description: "Sent to the guest when their booking is successfully created from the booking page.",
        defaultSubject: "Your Booking Confirmation - {{property_name}}",
        defaultBody: "Dear {{guest_name}},\n\nThis email confirms your booking with {{property_name}}.\n\nReservation Code: {{reservation_code}}\nCheck-in: {{check_in_date}}\nCheck-out: {{check_out_date}}\n\nWe look forward to your stay!\n\nBest regards,\nThe team at {{property_name}}"
    },
    { 
        type: "reservation_modification", 
        name: "Reservation Modification",
        description: "Sent to the guest when their reservation details are modified by staff.",
        defaultSubject: "Your Reservation has been Updated",
        defaultBody: "Dear {{guest_name}},\n\nYour reservation ({{reservation_code}}) has been modified. Please review the updated details."
    },
    { 
        type: "reservation_cancellation", 
        name: "Reservation Cancellation",
        description: "Sent to the guest when their reservation is cancelled.",
        defaultSubject: "Your Reservation has been Cancelled",
        defaultBody: "Dear {{guest_name}},\n\nWe have processed the cancellation for your reservation ({{reservation_code}}). We hope to see you another time."
    },
    { 
        type: "payment_confirmation", 
        name: "Payment Confirmation",
        description: "Sent automatically to the guest when an invoice is marked as paid.",
        defaultSubject: "Payment Confirmation – {{reservation_code}}",
        defaultBody: "Hello {{guest_name}},\n\nWe are pleased to inform you that your payment has been successfully received for your reservation at {{property_name}}.\n\nPayment details:\n• Reservation Code: {{reservation_code}}\n• Invoice Number: {{invoice_number}}\n• Amount Paid: {{invoice_amount}}\n• Due Date (if applicable): {{invoice_due_date}}\n\nReservation details:\n• Check-in Date: {{check_in_date}}\n• Check-out Date: {{check_out_date}}\n• Room Type: {{room_type}} (Room #{{room_number}})\n• Number of Nights: {{number_of_nights}}\n• Number of Guests: {{number_of_guests}}\n\nThank you for your payment! We look forward to welcoming you soon.\n\nBest regards,\nThe {{property_name}} Team"
    },
    { 
        type: "bank_transfer_info", 
        name: "Bank Transfer Info",
        description: "Provides payment instructions for guests paying via bank transfer.",
        defaultSubject: "Bank Transfer Information – {{reservation_code}}",
        defaultBody: "Hello {{guest_name}},\n\nThank you for your reservation.\nPlease find below the details to complete your payment via bank transfer:\n\nPayment details:\n• Reservation Code: {{reservation_code}}\n• Invoice Number: {{invoice_number}}\n• Amount Due: {{invoice_amount}}\n• Due Date: {{invoice_due_date}}\n\nBank Transfer Instructions:\n• Account Name: [Your Account Name]\n• IBAN: [Your IBAN]\n• BIC/SWIFT: [Your SWIFT Code]\n• Bank Name: [Your Bank Name]\n• Reference: {{reservation_code}}\n\nReservation details:\n• Check-in Date: {{check_in_date}}\n• Check-out Date: {{check_out_date}}\n• Room Type: {{room_type}} (Room #{{room_number}})\n• Number of Nights: {{number_of_nights}}\n• Number of Guests: {{number_of_guests}}\n\nPlease make sure to include the reservation code in the transfer reference.\nYour booking will be confirmed once we receive the payment.\n\nBest regards,\nThe {{property_name}} Team"
    },
    { 
        type: "mail_order_info", 
        name: "Mail Order Info",
        description: "Sent with a form for guests to provide credit card details securely.",
        defaultSubject: "Action Required: Complete Your Booking Payment",
        defaultBody: "Dear {{guest_name}},\n\nTo finalize your reservation, please fill out the secure mail order form linked below.\n\n[Link to Mail Order Form]"
    },
    { 
        type: "invoice_email", 
        name: "Invoice Email",
        description: "Sent manually to guests with their PDF invoice attached.",
        defaultSubject: "Your Invoice {{invoice_number}}",
        defaultBody: "Hello {{guest_name}},\n\nPlease find attached your invoice for your recent reservation.\n\nInvoice Details:  \n• Invoice Number: {{invoice_number}}  \n• Invoice Amount: {{invoice_amount}}  \n• Due Date: {{invoice_due_date}}  \n\nIf you have any questions regarding this invoice, feel free to contact us.\n\nBest regards,  \nThe {{property_name}} Team"
    },
    { 
        type: "internal_new_reservation", 
        name: "INTERNAL - New Reservation Alert",
        description: "Sent to the property when a new reservation is received.",
        defaultSubject: "New Reservation Alert: {{guest_name}} - {{room_type}}",
        defaultBody: "A new reservation has been made:\n\nGuest: {{guest_name}}\nReservation #: {{reservation_number}}\nDates: {{check_in_date}} to {{check_out_date}} ({{number_of_nights}} nights)\nRoom: {{room_type}} ({{room_number}})\nGuests: {{number_of_guests}}\nTotal: {{total_price}}\n\nThis is an automated notification."
    },
    { 
        type: "internal_cancellation_alert", 
        name: "INTERNAL - Cancellation Alert",
        description: "Sent to the property when a reservation is cancelled.",
        defaultSubject: "Cancellation Alert: {{guest_name}} - Res #{{reservation_number}}",
        defaultBody: "A reservation has been cancelled:\n\nGuest: {{guest_name}}\nReservation #: {{reservation_number}}\nOriginal Check-in: {{check_in_date}}\nOriginal Check-out: {{check_out_date}}\n\nThis is an automated notification."
    },
];

export const dynamicVariables = [
    { variable: "guest_name", description: "The full name of the guest.", sampleValue: "John Doe" },
    { variable: "reservation_code", description: "The unique internal ID for the reservation.", sampleValue: "abc123xyz" },
    { variable: "reservation_number", description: "The user-friendly reservation number (e.g. R-00123).", sampleValue: "R-00123" },
    { variable: "check_in_date", description: "The check-in date of the reservation.", sampleValue: "July 15, 2025" },
    { variable: "check_out_date", description: "The check-out date of the reservation.", sampleValue: "July 20, 2025" },
    { variable: "room_type", description: "The name of the booked room type.", sampleValue: "Deluxe Queen Room" },
    { variable: "number_of_nights", description: "The number of nights for the stay.", sampleValue: "5" },
    { variable: "number_of_guests", description: "The total number of guests (adults + children).", sampleValue: "2" },
    { variable: "total_price", description: "The total cost of the reservation (including taxes).", sampleValue: "$825.00" },
    { variable: "total_taxes", description: "The calculated tax amount for the booking.", sampleValue: "$75.00" },
    { variable: "property_name", description: "The name of your property.", sampleValue: "The Grand Hotel" },
    { variable: "property_address", description: "The full address of your property.", sampleValue: "123 Main Street, Anytown, USA" },
    { variable: "property_phone", description: "The contact phone number for your property.", sampleValue: "+1-555-123-4567" },
    { variable: "property_email", description: "The contact email for your property.", sampleValue: "contact@grandhotel.com" },
    { variable: "invoice_number", description: "The number of the associated invoice.", sampleValue: "INV-00123" },
    { variable: "invoice_amount", description: "The total amount of the invoice.", sampleValue: "$825.00" },
    { variable: "invoice_due_date", description: "The due date of the invoice.", sampleValue: "August 14, 2025" },
    { variable: "room_number", description: "The assigned room number for the reservation.", sampleValue: "101" },
    { variable: "extras", description: "A formatted list of selected extras, including name, quantity, and the total calculated price for each item.", sampleValue: "\n\n--- Extras ---\n- Airport Transfer: $50.00\n- Champagne: $75.00" },
    { variable: "price_breakdown", description: "A formatted summary of the reservation pricing including subtotal, discounts, taxes, and grand total.", sampleValue: "Rooms: $500, Extras: $50, Subtotal: $550, Discount: -$50, Net: $500, Tax: $50, Total: $550" },
];

    