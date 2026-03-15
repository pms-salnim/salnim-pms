/**
 * Folio System Types
 * Enterprise-grade accounting ledger for reservations
 * 
 * Core Principle: Never update ledger entries—only append.
 * Balance is always computed from entries, never stored.
 */

/**
 * Tax line item for a charge
 */
export interface TaxLine {
  name: string; // "VAT 10%", "City Tax", "Resort Fee"
  amount: number; // tax amount (always positive)
  rate?: number; // percentage (e.g., 10 for 10%)
}

/**
 * Folio: A guest or company account attached to a reservation
 * 
 * Multiple folios per reservation enable:
 * - Guest pays for extras, Company pays for room
 * - Restaurant account separate from room account
 * - Tax/liability separation
 */
export interface Folio {
  id: string; // e.g., "folio-main", "folio-company-1"
  reservationId: string; // Link to parent reservation
  name: string; // e.g., "Main Folio", "Company ABC"
  type: 'GUEST' | 'ROOM' | 'RESTAURANT' | 'BAR' | 'SPA' | 'COMPANY';
  currency: string; // e.g., "MAD", "USD", "EUR"
  isPrimary: boolean; // True for guest's main folio
  status: 'OPEN' | 'CLOSED'; // CLOSED = read-only after checkout
  createdAt: Date;
  createdBy: string; // User ID who created
  closedAt?: Date;
  closedBy?: string;
}

/**
 * Ledger Entry: The immutable heart of the folio system
 * 
 * Rules:
 * - Never update an entry (immutable = true always)
 * - Only append new entries
 * - direction + amount determine impact:
 *   DEBIT = increases balance (charge)
 *   CREDIT = decreases balance (payment)
 */
export interface LedgerEntry {
  id: string; // Unique ledger entry ID (LEX-reservationId-timestamp-random)
  folioId: string; // Which folio owns this entry
  
  // Entry type & source
  type: 'CHARGE' | 'PAYMENT' | 'REFUND' | 'ADJUSTMENT';
  source: 'ROOM_RATE' | 'MANUAL' | 'POS' | 'OTA' | 'AUTO';
  
  // Financial impact
  amount: number; // Always positive (direction determines sign)
  direction: 'DEBIT' | 'CREDIT'; // DEBIT = charge, CREDIT = payment
  
  // Details
  description: string; // "Room charge", "Mini bar - Water", "VAT 10%"
  category?: string; // For grouping (Room, F&B, Tax, Misc)
  
  // Tax breakdown (if applicable)
  taxBreakdown?: TaxLine[];
  
  // Audit trail
  createdAt: Date; // When entry was created (audit date)
  createdBy: string; // User who created it
  
  // Accounting dates
  postingDate: string; // YYYY-MM-DD (accounting date, can differ from createdAt)
  
  // Reference tracking
  referenceId?: string; // Link to payment ID, POS ticket, original charge (for splits/refunds)
  notes?: string; // Additional notes for the charge
  
  // Tax status
  taxStatus?: string; // 'taxable' | 'exempt'
  taxRate?: number; // Tax rate percentage
  
  // Status tracking
  isRefunded?: boolean; // True if this entry has been refunded
  deleted?: boolean; // Soft-delete flag (for compliance, never hard-delete)
  
  // Immutability lock
  immutable: boolean; // Always true - guarantee it won't change
}

/**
 * Allocation: Links a payment to specific charges
 * 
 * Purpose: Track which payment covers which charges
 * Enables: Clean invoicing, partial payments, dispute resolution
 */
export interface AllocationRecord {
  id: string; // e.g., "alloc-paymentId-chargeId"
  paymentId: string; // Which payment
  chargeId: string; // Applied to which charge
  amount: number; // How much allocated
  createdAt: Date;
  createdBy: string;
}

/**
 * Computed folio balance (not stored, always calculated)
 */
export interface FolioBalance {
  folioId: string;
  totalDebits: number; // Sum of all DEBIT amounts
  totalCredits: number; // Sum of all CREDIT amounts
  balance: number; // debits - credits (positive = guest owes, negative = guest has credit)
  runningBalance?: number; // Per-transaction cumulative (for table display)
}

/**
 * Tax configuration per country/property
 */
export interface TaxRule {
  id: string;
  name: string; // "VAT", "City Tax", "Resort Fee"
  rate: number; // Percentage (e.g., 10 for 10%)
  applicableTo: string[]; // ['ROOM_RATE', 'EXTRAS', 'ALL']
  isInclusive: boolean; // Included in price or added on top
}

export interface TaxConfig {
  countryCode: string; // "MA" for Morocco
  currency: string;
  taxRules: TaxRule[];
}

/**
 * Ledger entry with running balance (for UI display)
 */
export interface LedgerEntryWithBalance extends LedgerEntry {
  runningBalance: number; // Cumulative balance up to this entry
}
