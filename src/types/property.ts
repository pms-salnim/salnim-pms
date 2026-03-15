
import type { Timestamp } from 'firebase/firestore';
import type { PropertyType as PropertyTypeOption } from './firestoreUser'; // For the form selection

export const timeZoneOptions = [
    { value: "UTC-05:00", label: "(UTC-05:00) Eastern Time (US & Canada)" },
    { value: "UTC-06:00", label: "(UTC-06:00) Central Time (US & Canada)" },
    { value: "UTC-07:00", label: "(UTC-07:00) Mountain Time (US & Canada)" },
    { value: "UTC-08:00", label: "(UTC-08:00) Pacific Time (US & Canada)" },
    { value: "UTC+00:00", label: "(UTC+00:00) Coordinated Universal Time" },
    { value: "UTC+00:00-London", label: "(UTC+00:00) London, Dublin" },
    { value: "UTC+01:00-Casablanca", label: "(UTC+01:00) Casablanca" },
    { value: "UTC+01:00", label: "(UTC+01:00) Paris, Berlin, Rome" },
    { value: "UTC+09:00", label: "(UTC+09:00) Tokyo, Seoul" },
];

export const currencyOptions = [
    { value: "USD", label: "USD - United States Dollar", symbol: "$" },
    { value: "EUR", label: "EUR - Euro", symbol: "€" },
    { value: "GBP", label: "GBP - British Pound Sterling", symbol: "£" },
    { value: "JPY", label: "JPY - Japanese Yen", symbol: "¥" },
    { value: "CAD", label: "CAD - Canadian Dollar", symbol: "$" },
    { value: "AUD", label: "AUD - Australian Dollar", symbol: "$" },
    { value: "MAD", label: "MAD - Moroccan Dirham", symbol: "DH" },
];

export const dateFormatOptions = [
    { value: "MM/dd/yyyy", label: "MM/DD/YYYY" },
    { value: "dd/MM/yyyy", label: "DD/MM/YYYY" },
    { value: "yyyy-MM-dd", label: "YYYY-MM-DD" },
];

export const languageOptions = [
    { value: "en", label: "English" },
    { value: "es", label: "Spanish" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "it", label: "Italian" },
    { value: "pt", label: "Portuguese" },
    { value: "ar", label: "Arabic" },
    { value: "zh", label: "Chinese (Simplified)" },
];

export interface LegalInformation {
    companyName?: string;
    legalForm?: string;
    capitalAmount?: string;
    businessAddress?: string;
    rcNumber?: string;
    ifNumber?: string;
    patenteNumber?: string;
    iceNumber?: string;
    phone?: string;
    email?: string;
    website?: string;
    tvaInfo?: string;
    bankAccountNumber?: string;
    iban?: string;
}


export interface InvoiceCustomization {
    prefix?: string;
    logoUrl?: string;
    primaryColor?: string;
    footerText?: string;
    headerNotes?: string;
    includePropertyAddress?: boolean;
    logoSize?: number; 
    companyStampUrl?: string;
    companyStampSize?: number;
}

export interface LoyaltyTierSetting {
  name: string;
  minPoints: number; // This will represent total earned points required
}

export interface LoyaltyProgramSettings {
    enabled: boolean;
    earningRate: number; // e.g., 10 for 1 point per $10 spent
    redemptionRate: number; // e.g., 0.01 for 1 point = $0.01
    tiers?: LoyaltyTierSetting[]; // ADD THIS
}

export interface EmailConfiguration {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromName?: string;
}

export interface IMAPConfiguration {
    host: string;
    port: number;
    user: string;
    pass: string;
    useTls: boolean;
}

export interface NotificationChannelSettings {
    inApp: boolean;
    email: boolean;
}

export interface NotificationRule {
    enabled: boolean;
    channels: NotificationChannelSettings;
}

export type NotificationSettingKey = 'new_reservation' | 'payment_received' | 'cancellation' | 'new_message';

export type NotificationSettings = Partial<Record<NotificationSettingKey, NotificationRule>>;

export interface PromoCardSettings {
  enabled?: boolean;
  displayType?: 'auto' | 'manual';
  title?: string;
  description?: string;
  imageUrl?: string;
  promotionId?: string;
  manualDesignImageUrl?: string;
}

export interface Property {
  id: string; // The document ID, same as propertyId
  name: string;
  slug: string; // URL-friendly unique identifier
  address: string;
  type: PropertyTypeOption;
  ownerUid: string; // UID of the initial admin/owner who created this property

  // General Information
  city?: string;
  phone?: string;
  email?: string; // Contact email for the property
  website?: string;
  legalName?: string;
  logoUrl?: string;
  aboutUs?: string; // New field for about us content

  // Booking Preferences
  defaultCheckInTime?: string; // e.g., "15:00"
  defaultCheckOutTime?: string; // e.g., "11:00"
  currency?: string; // e.g., "USD"
  timeZone?: string; // e.g., "America/New_York", "UTC"
  
  lastInvoiceNumber?: number;
  lastReservationNumber?: number; // Added for reservations

  // Guest Rules
  allowSameDayBookings?: boolean;
  cancellationPolicy?: string;
  
  taxSettings?: {
    enabled: boolean;
    rate: number; // e.g., 10 for 10%
    name?: string; // e.g., "VAT"
  };

  loyaltyProgramSettings?: LoyaltyProgramSettings;

  // New Booking Page Settings
  bookingPageSettings?: {
    showPropertyDescription?: boolean;
    showCalendarTab?: boolean;
    showPackagesTab?: boolean;
    primaryColor?: string; // hex
    primaryColorHover?: string;
    showPromoCodeField?: boolean;
    autoAssignRoom?: boolean;
    requireGuestPhone?: boolean;
    bookingTerms?: string;
    defaultBookingStatus?: 'Confirmed' | 'Pending';
    headerButtonText?: string;
    headerButtonLink?: string;
    allowSameDayTurnover?: boolean; // New setting
    allowSameDayBookings?: boolean; // Added setting
    logoUrl?: string; 
    welcomeMessage?: string;
    heroImageUrl?: string;
    logoSize?: number; 
    promoCard?: PromoCardSettings;
  };

  invoiceCustomization?: InvoiceCustomization;
  emailConfiguration?: EmailConfiguration;
  imapConfiguration?: IMAPConfiguration;
  notificationSettings?: NotificationSettings;
  legalInformation?: LegalInformation;
  
  // Optional reputation summary (average rating and count of reviews)
  reputation?: {
    average?: number;
    count?: number;
  };

  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

    