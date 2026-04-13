/**
 * Guest Profile Settings Types
 * Shared types for guest profile configuration across the application
 */

export interface CoreFieldConfig {
  fieldName: string;
  displayName: string;
  reservationFormVisible: boolean;
  reservationFormRequired: boolean;
  guestDetailsVisible: boolean;
  guestDetailsRequired: boolean;
  isDefault: boolean;
}

export interface CustomField {
  id: string;
  name: string;
  appliedTo: 'guest' | 'company';
  type: 'text' | 'number' | 'date' | 'dropdown' | 'multiselect' | 'checkbox' | 'textarea';
  isRequired: boolean;
  displayLocations: string[];
  maxCharacters?: number;
  isSearchable: boolean;
  visibleInProfileSummary: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface NoteCategory {
  id: string;
  name: string;
  displayOnReservationForm: boolean;
  displayOnGuestDetails: boolean;
  isDefault: boolean;
}

export interface Status {
  id: string;
  name: string;
  color: string;
  reasonRequired: boolean;
  rule: {
    enabled: boolean;
    triggerType: 'stays' | 'totalSpend' | 'manual';
    threshold: number;
  };
  isDefault: boolean;
  visibleOnGuestActions: boolean;
}

export interface LoyaltyTier {
  name: string;
  color: string;
  minPoints: number;
  bonusEnabled: boolean;
  bonusCoefficient: number;
}

export interface GuestProfileSettings {
  // Basic Configuration
  autoCreateProfile: boolean;
  autoCreateForWalkIns: boolean;
  enableMultiPropertyAggregation: boolean;

  // Core Fields Defaults
  coreFieldsConfig: CoreFieldConfig[];
  requiredFields: string[];
  repeatGuestThreshold: number;
  vipStatusAssignment: 'manual' | 'auto' | 'manual-and-auto';

  // Custom Fields
  customFields: CustomField[];

  // Notes & Status
  noteCategories: NoteCategory[];
  enableStatus: boolean;
  status: Status[];

  // General Configuration
  enableDuplicateDetection: boolean;
  duplicateDetectionFields: ('email' | 'phone')[];
  duplicateDetectionCustomFields?: string[];
  autoMergeDuplicates: boolean;
  defaultGuestType: 'individual' | 'company';
  requireProfileCompletionBeforeCheckin: boolean;

  // Identification & Compliance
  enableIdTypes: ('passport' | 'nationalId' | 'driverLicense')[];
  idScanUploadRequired: boolean;
  idExpiryDateMandatory: boolean;
  dataRetentionYears: number;
  enableAutoAnonymization: boolean;
  enableGDPRConsent: boolean;
  enableMarketingConsent: boolean;

  // Communication Preferences
  defaultLanguage: string;
  preferredContactMethod: 'email' | 'sms' | 'whatsapp';
  enablePreArrivalEmails: boolean;
  enablePostStayEmails: boolean;

  // Segmentation
  enableAutoTagRepeat: boolean;
  autoTagRepeatAfterXStays: number;
  enableAutoTagHighValue: boolean;
  highValueThreshold: number;
  enableBlacklist: boolean;
  blacklistBehavior: 'warning' | 'hard-block';

  // Corporate
  enableCompanyAccounts: boolean;
  requireVATID: boolean;
  enableCreditLimit: boolean;

  // Multi-Property
  shareProfilesAcrossProperties: boolean;
  syncBlacklistAcrossProperties: boolean;

  // Privacy & Audit
  enableProfileAuditLog: boolean;

  // Loyalty Program
  enableLoyaltyProgram: boolean;
  pointsEarningRate: number;
  pointsRedemptionValue: number;
  pointExpirationMonths: number;
  autoEnrollNewGuests: boolean;
  loyaltyTiers: LoyaltyTier[];
}
