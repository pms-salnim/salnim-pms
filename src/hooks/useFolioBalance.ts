/**
 * useFolioBalance Hook
 * 
 * Real-time balance computation for folio
 * Memoized to prevent unnecessary recalculations
 * 
 * Returns: entries with running balance, summary stats
 */

import { useMemo } from 'react';
import {
  LedgerEntry,
  FolioBalance,
  LedgerEntryWithBalance,
} from '@/types/folio';
import {
  calculateFolioBalance,
  addRunningBalances,
  calculateAmountOwed,
  calculateCredit,
  calculateTaxSummary,
} from '@/lib/folioUtils';

interface UseFolioBalanceResult {
  // Raw data
  entries: LedgerEntry[];
  
  // Processed entries with running balance
  entriesWithBalance: LedgerEntryWithBalance[];
  
  // Balance summary
  balance: FolioBalance;
  
  // Quick access to common values
  totalDebits: number;
  totalCredits: number;
  balanceAmount: number;
  amountOwed: number;
  creditAmount: number;
  
  // Tax summary
  taxBreakdown: Array<{ name: string; amount: number }>;
  
  // Entry count
  entryCount: number;
}

/**
 * Hook to compute folio balance and running totals
 * 
 * @param entries - Array of ledger entries
 * @param folioId - Current folio ID (for debugging)
 * @returns Balance computation result
 * 
 * @example
 * const { balanceAmount, entriesWithBalance } = useFolioBalance(entries);
 */
export function useFolioBalance(
  entries: LedgerEntry[] = [],
  folioId?: string
): UseFolioBalanceResult {
  // Memoize the entire result to prevent recalculations
  return useMemo(() => {
    // Calculate base balance
    const balance = calculateFolioBalance(entries);
    
    // Add running balance to each entry
    const entriesWithBalance = addRunningBalances(entries);
    
    // Calculate other summaries
    const amountOwed = calculateAmountOwed(entries);
    const creditAmount = calculateCredit(entries);
    const taxBreakdown = calculateTaxSummary(entries);
    
    // Count active entries (non-deleted)
    const entryCount = entries.filter(e => !e.deleted).length;
    
    return {
      entries,
      entriesWithBalance,
      balance,
      totalDebits: balance.totalDebits,
      totalCredits: balance.totalCredits,
      balanceAmount: balance.balance,
      amountOwed,
      creditAmount,
      taxBreakdown,
      entryCount,
    };
  }, [JSON.stringify(entries)]); // Use JSON.stringify as dependency
}

/**
 * Hook for computing balance of multiple folios
 * Returns a map of folioId -> balance
 * 
 * @example
 * const folioBalances = useMultiFolioBalances(allEntries);
 */
export function useMultiFolioBalances(
  entriesByFolio: Record<string, LedgerEntry[]>
): Record<string, FolioBalance> {
  return useMemo(() => {
    const result: Record<string, FolioBalance> = {};
    
    Object.entries(entriesByFolio).forEach(([folioId, entries]) => {
      result[folioId] = calculateFolioBalance(entries);
    });
    
    return result;
  }, [JSON.stringify(entriesByFolio)]);
}

/**
 * Hook for computing balance summary across all folios
 * Useful for reservation-level reporting
 * 
 * @example
 * const { totalOwed, totalCredit } = useReservationBalance(allFolios);
 */
export function useReservationBalance(
  entriesByFolio: Record<string, LedgerEntry[]>
) {
  return useMemo(() => {
    let totalDebits = 0;
    let totalCredits = 0;
    let folioCount = 0;
    
    Object.entries(entriesByFolio).forEach(([_, entries]) => {
      const balance = calculateFolioBalance(entries);
      totalDebits += balance.totalDebits;
      totalCredits += balance.totalCredits;
      folioCount++;
    });
    
    const balance = totalDebits - totalCredits;
    const amountOwed = Math.max(0, balance);
    const creditAmount = Math.max(0, -balance);
    
    return {
      totalDebits,
      totalCredits,
      balance,
      amountOwed,
      creditAmount,
      folioCount,
    };
  }, [JSON.stringify(entriesByFolio)]);
}

/**
 * Hook for getting paginated entries with running balance
 * Useful for large folios with many transactions
 * 
 * @example
 * const { entries, total, hasMore } = usePaginatedFolioBalance(
 *   allEntries,
 *   { pageSize: 20, page: 0 }
 * );
 */
export function usePaginatedFolioBalance(
  entries: LedgerEntry[] = [],
  options: { pageSize?: number; page?: number } = {}
) {
  const { pageSize = 20, page = 0 } = options;
  
  return useMemo(() => {
    // Get active entries in reverse chronological order
    const active = entries
      .filter(e => !e.deleted)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Calculate total for pagination
    const total = active.length;
    
    // Get page of results
    const start = page * pageSize;
    const end = start + pageSize;
    const pageEntries = active.slice(start, end);
    
    // Add running balance to page entries
    const entriesWithBalance = addRunningBalances(pageEntries);
    
    // Calculate if there are more pages
    const hasMore = end < total;
    
    return {
      entries: entriesWithBalance,
      total,
      hasMore,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    };
  }, [JSON.stringify(entries), pageSize, page]);
}

/**
 * Hook for computing balance at a specific date
 * Useful for historical reporting
 * 
 * @example
 * const balance = useHistoricalBalance(entries, new Date('2024-12-25'));
 */
export function useHistoricalBalance(
  entries: LedgerEntry[] = [],
  asOfDate: Date
) {
  return useMemo(() => {
    // Filter entries up to the specified date
    const historicalEntries = entries.filter(e => {
      if (e.deleted) return false;
      return new Date(e.postingDate) <= asOfDate;
    });
    
    return calculateFolioBalance(historicalEntries);
  }, [JSON.stringify(entries), asOfDate.toISOString()]);
}
