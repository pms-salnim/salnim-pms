/**
 * Folio System Utilities
 * 
 * Functions for:
 * - Ledger entry operations (CRUD)
 * - Balance calculations
 * - Running balance computation
 * - Entry formatting
 */

import { LedgerEntry, Folio, FolioBalance, LedgerEntryWithBalance } from '@/types/folio';

/**
 * Generate a unique ledger entry ID
 * Format: LEX-{reservationId}-{timestamp}-{random}
 */
export function generateLedgerEntryId(reservationId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LEX-${reservationId}-${timestamp}-${random}`;
}

/**
 * Calculate folio balance from ledger entries
 * 
 * Balance = Total Debits - Total Credits
 * Positive = guest owes money
 * Negative = guest has credit
 */
export function calculateFolioBalance(entries: LedgerEntry[]): FolioBalance {
  const activeEntries = entries.filter(e => !e.deleted);
  
  const totalDebits = activeEntries
    .filter(e => e.direction === 'DEBIT')
    .reduce((sum, e) => sum + e.amount, 0);
  
  const totalCredits = activeEntries
    .filter(e => e.direction === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0);
  
  const balance = totalDebits - totalCredits;
  
  return {
    folioId: entries[0]?.folioId || '',
    totalDebits,
    totalCredits,
    balance,
  };
}

/**
 * Add running balance to each entry
 * Used for displaying transaction history with cumulative balance
 */
export function addRunningBalances(
  entries: LedgerEntry[]
): LedgerEntryWithBalance[] {
  const activeEntries = entries.filter(e => !e.deleted);
  let runningBalance = 0;
  
  return activeEntries.map(entry => {
    // Apply debit or credit
    if (entry.direction === 'DEBIT') {
      runningBalance += entry.amount;
    } else {
      runningBalance -= entry.amount;
    }
    
    return {
      ...entry,
      runningBalance,
    };
  });
}

/**
 * Group entries by date for daily reconciliation
 */
export function groupEntriesByDate(
  entries: LedgerEntry[]
): Record<string, LedgerEntry[]> {
  const grouped: Record<string, LedgerEntry[]> = {};
  
  entries.forEach(entry => {
    if (entry.deleted) return;
    
    const dateKey = entry.postingDate; // YYYY-MM-DD
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(entry);
  });
  
  return grouped;
}

/**
 * Calculate daily summary for balance sheet
 */
export function calculateDailySummary(entries: LedgerEntry[]) {
  const grouped = groupEntriesByDate(entries);
  
  return Object.entries(grouped).map(([date, dayEntries]) => {
    const debits = dayEntries
      .filter(e => e.direction === 'DEBIT')
      .reduce((sum, e) => sum + e.amount, 0);
    
    const credits = dayEntries
      .filter(e => e.direction === 'CREDIT')
      .reduce((sum, e) => sum + e.amount, 0);
    
    return {
      date,
      debits,
      credits,
      net: debits - credits,
      count: dayEntries.length,
    };
  });
}

/**
 * Format amount for display
 * @param amount - Amount in base currency
 * @param currency - Currency code (e.g., "MAD", "USD")
 * @returns Formatted string (e.g., "500 MAD" or "$500.00")
 */
export function formatAmount(amount: number, currency: string = 'MAD'): string {
  const formatted = Math.abs(amount).toFixed(2);
  
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    MAD: 'د.م.',
    INR: '₹',
  };
  
  const symbol = currencySymbols[currency] || currency;
  return `${symbol}${formatted}`;
}

/**
 * Format date for display in ledger entries
 * @param date - Date object
 * @returns Formatted string (e.g., "25/12/2024")
 */
export function formatLedgerDate(date: Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Calculate running balance at a specific point
 * @param entries - All entries in order
 * @param upToEntryId - Only count up to this entry ID
 */
export function getRunningBalanceAt(
  entries: LedgerEntry[],
  upToEntryId: string
): number {
  let balance = 0;
  
  for (const entry of entries) {
    if (entry.deleted) continue;
    
    if (entry.direction === 'DEBIT') {
      balance += entry.amount;
    } else {
      balance -= entry.amount;
    }
    
    if (entry.id === upToEntryId) break;
  }
  
  return balance;
}

/**
 * Soft-delete a ledger entry (mark as deleted, don't remove)
 * Returns the updated entry
 */
export function softDeleteEntry(entry: LedgerEntry): LedgerEntry {
  return {
    ...entry,
    deleted: true,
  };
}

/**
 * Group entries by type for summary reporting
 */
export function groupEntriesByType(
  entries: LedgerEntry[]
): Record<string, LedgerEntry[]> {
  const grouped: Record<string, LedgerEntry[]> = {};
  
  entries.forEach(entry => {
    if (entry.deleted) return;
    
    if (!grouped[entry.type]) {
      grouped[entry.type] = [];
    }
    grouped[entry.type].push(entry);
  });
  
  return grouped;
}

/**
 * Calculate tax breakdown for invoicing
 */
export function calculateTaxSummary(entries: LedgerEntry[]) {
  const taxMap: Record<string, number> = {};
  
  entries.forEach(entry => {
    if (entry.deleted || !entry.taxBreakdown) return;
    
    entry.taxBreakdown.forEach(tax => {
      if (!taxMap[tax.name]) {
        taxMap[tax.name] = 0;
      }
      taxMap[tax.name] += tax.amount;
    });
  });
  
  return Object.entries(taxMap).map(([name, amount]) => ({
    name,
    amount,
  }));
}

/**
 * Get the most recent entry for a folio
 */
export function getLatestEntry(entries: LedgerEntry[]): LedgerEntry | null {
  const active = entries.filter(e => !e.deleted);
  if (active.length === 0) return null;
  
  return active.reduce((latest, current) => {
    return new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest;
  });
}

/**
 * Check if a folio can be closed
 * Rules: All charges must be paid off (balance = 0)
 */
export function canCloseFolio(entries: LedgerEntry[]): boolean {
  const balance = calculateFolioBalance(entries);
  return balance.balance === 0;
}

/**
 * Create a refund entry for an existing charge
 */
export function createRefundEntry(
  originalCharge: LedgerEntry,
  userId: string,
  reason?: string
): LedgerEntry {
  return {
    id: generateLedgerEntryId(originalCharge.folioId),
    folioId: originalCharge.folioId,
    type: 'REFUND',
    source: originalCharge.source,
    amount: originalCharge.amount,
    direction: 'CREDIT', // Refunds reduce balance
    description: `Refund: ${originalCharge.description}${reason ? ` (${reason})` : ''}`,
    category: originalCharge.category,
    taxBreakdown: originalCharge.taxBreakdown,
    createdAt: new Date(),
    createdBy: userId,
    postingDate: new Date().toISOString().split('T')[0],
    referenceId: originalCharge.id, // Link back to original charge
    immutable: true,
  };
}

/**
 * Find all entries related to a specific reference (e.g., all refunds of a charge)
 */
export function findRelatedEntries(
  entries: LedgerEntry[],
  referenceId: string
): LedgerEntry[] {
  return entries.filter(e => e.referenceId === referenceId && !e.deleted);
}

/**
 * Calculate amount still owed for a folio
 * (Excluding refunded charges)
 */
export function calculateAmountOwed(entries: LedgerEntry[]): number {
  const balance = calculateFolioBalance(entries);
  return Math.max(0, balance.balance); // Only positive amounts are owed
}

/**
 * Calculate amount of credit (overpayment) for a folio
 */
export function calculateCredit(entries: LedgerEntry[]): number {
  const balance = calculateFolioBalance(entries);
  return Math.max(0, -balance.balance); // Only negative amounts are credit
}
