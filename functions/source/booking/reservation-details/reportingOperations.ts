/**
 * Ledger Reporting Operations
 * 
 * Generates comprehensive reports from ledger data:
 * - Daily settlement by folio
 * - Tax breakdown
 * - Transaction analytics
 * - Full ledger export
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../firebase";
import * as logger from "firebase-functions/logger";
import type { LedgerEntry } from "../../types/folio";

interface FolioSummary {
  folioId: string;
  folioName: string;
  folioType: string;
  totalDebits: number;
  totalCredits: number;
  balance: number;
  entryCount: number;
  taxByType: Record<string, number>; // "VAT 10%": 500, etc.
}

interface DailySummary {
  date: string;
  totalDebits: number;
  totalCredits: number;
  totalTax: number;
  transactionCount: number;
}

interface TaxSummary {
  taxName: string;
  totalAmount: number;
  rate?: number;
  applicableTo: string[];
}

/**
 * Generate daily settlement report
 * 
 * POST: /generateLedgerReport
 * {
 *   propertyId: string,
 *   reservationId: string,
 *   reportType: 'settlement' | 'analytics' | 'full_export',
 *   startDate?: string (YYYY-MM-DD),
 *   endDate?: string (YYYY-MM-DD)
 * }
 */
export const generateLedgerReport = onCall(
  { enforceAppCheck: false, region: "europe-west1", timeoutSeconds: 120 },
  async (request) => {
    const {
      propertyId,
      reservationId,
      reportType = "settlement",
      startDate,
      endDate,
    } = request.data;

    if (!propertyId || !reservationId) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: propertyId, reservationId"
      );
    }

    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    try {
      // Fetch all folios for this reservation
      const foliosRef = db.collection(
        `properties/${propertyId}/reservations/${reservationId}/folios`
      );
      const foliosSnap = await foliosRef.get();

      if (foliosSnap.empty) {
        throw new HttpsError("not-found", "No folios found for this reservation");
      }

      const allEntries: Array<LedgerEntry & { folioId: string; folioName: string; folioType: string }> = [];
      const folioSummaries: FolioSummary[] = [];

      // Collect all entries from all folios
      for (const folioDoc of foliosSnap.docs) {
        const folioData = folioDoc.data();
        const ledgerRef = folioDoc.ref.collection("ledger");
        const entriesSnap = await ledgerRef.get();

        let folioDebits = 0;
        let folioCredits = 0;
        let folioTaxMap: Record<string, number> = {};

        for (const entryDoc of entriesSnap.docs) {
          const entry = entryDoc.data() as LedgerEntry;

          // Skip soft-deleted entries for settlement reports
          if (entry.deleted && reportType === "settlement") {
            continue;
          }

          // Apply date filters if provided
          if (startDate || endDate) {
            const entryDate = entry.postingDate;
            if (startDate && entryDate < startDate) continue;
            if (endDate && entryDate > endDate) continue;
          }

          allEntries.push({
            ...entry,
            folioId: folioDoc.id,
            folioName: folioData.name,
            folioType: folioData.type,
          });

          // Calculate folio totals
          if (entry.direction === "DEBIT") {
            folioDebits += entry.amount;
          } else {
            folioCredits += entry.amount;
          }

          // Aggregate taxes
          if (entry.taxBreakdown) {
            for (const tax of entry.taxBreakdown) {
              folioTaxMap[tax.name] = (folioTaxMap[tax.name] || 0) + tax.amount;
            }
          }
        }

        // Add folio summary
        if (folioDebits > 0 || folioCredits > 0 || entriesSnap.size > 0) {
          folioSummaries.push({
            folioId: folioDoc.id,
            folioName: folioData.name,
            folioType: folioData.type,
            totalDebits: folioDebits,
            totalCredits: folioCredits,
            balance: folioDebits - folioCredits,
            entryCount: entriesSnap.size,
            taxByType: folioTaxMap,
          });
        }
      }

      // Calculate daily summaries
      const dailyMap: Record<string, DailySummary> = {};
      const taxSummaryMap: Record<string, TaxSummary> = {};

      for (const entry of allEntries) {
        // Daily summary
        const date = entry.postingDate;
        if (!dailyMap[date]) {
          dailyMap[date] = {
            date,
            totalDebits: 0,
            totalCredits: 0,
            totalTax: 0,
            transactionCount: 0,
          };
        }

        if (entry.direction === "DEBIT") {
          dailyMap[date].totalDebits += entry.amount;
        } else {
          dailyMap[date].totalCredits += entry.amount;
        }
        dailyMap[date].transactionCount += 1;

        // Tax summary
        if (entry.taxBreakdown) {
          for (const tax of entry.taxBreakdown) {
            if (!taxSummaryMap[tax.name]) {
              taxSummaryMap[tax.name] = {
                taxName: tax.name,
                totalAmount: 0,
                rate: tax.rate,
                applicableTo: [],
              };
            }
            taxSummaryMap[tax.name].totalAmount += tax.amount;
          }
        }

        // Sum daily taxes
        if (entry.taxBreakdown) {
          for (const tax of entry.taxBreakdown) {
            dailyMap[date].totalTax += tax.amount;
          }
        }
      }

      // Generate report based on type
      const report: any = {
        success: true,
        reportType,
        generatedAt: new Date().toISOString(),
        propertyId,
        reservationId,
        dateRange: {
          start: startDate || "all",
          end: endDate || "all",
        },
      };

      if (reportType === "settlement" || reportType === "full_export") {
        report.folioSummaries = folioSummaries.sort((a, b) =>
          a.folioName.localeCompare(b.folioName)
        );
        report.totalDebits = folioSummaries.reduce((sum, f) => sum + f.totalDebits, 0);
        report.totalCredits = folioSummaries.reduce((sum, f) => sum + f.totalCredits, 0);
        report.netBalance = report.totalDebits - report.totalCredits;
      }

      if (reportType === "analytics" || reportType === "full_export") {
        report.dailySummaries = Object.values(dailyMap).sort((a, b) =>
          a.date.localeCompare(b.date)
        );
        report.taxSummaries = Object.values(taxSummaryMap).sort((a, b) =>
          a.taxName.localeCompare(b.taxName)
        );
        report.totalTaxCollected = Object.values(taxSummaryMap).reduce(
          (sum, t) => sum + t.totalAmount,
          0
        );
      }

      if (reportType === "full_export") {
        report.allEntries = allEntries;
        report.totalEntries = allEntries.length;
      }

      logger.info(`Generated ${reportType} report for reservation ${reservationId}`);

      return report;
    } catch (error) {
      logger.error("Generate report error:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        `Failed to generate report: ${(error as Error).message}`
      );
    }
  }
);

/**
 * Get folio transaction history with category breakdown
 * 
 * POST: /getFolioTransactionHistory
 * {
 *   propertyId: string,
 *   reservationId: string,
 *   folioId: string
 * }
 */
export const getFolioTransactionHistory = onCall(
  { enforceAppCheck: false, region: "europe-west1" },
  async (request) => {
    const { propertyId, reservationId, folioId } = request.data;

    if (!propertyId || !reservationId || !folioId) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: propertyId, reservationId, folioId"
      );
    }

    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    try {
      const ledgerRef = db.collection(
        `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/ledger`
      );
      const entriesSnap = await ledgerRef.orderBy("createdAt", "desc").get();

      const entries = entriesSnap.docs.map(doc => {
        const data = doc.data();
        // Return as-is from Firestore (timestamp will be included)
        return data as unknown as LedgerEntry;
      });

      // Calculate category breakdown
      const categoryMap: Record<string, { count: number; total: number }> = {};
      let runningBalance = 0;

      const entriesWithBalance = entries.reverse().map(entry => {
        // Skip voided entries from balance calculation
        if (!entry.referenceId?.startsWith("void-")) {
          if (entry.direction === "DEBIT") {
            runningBalance += entry.amount;
          } else {
            runningBalance -= entry.amount;
          }
        }

        const category = entry.category || "Uncategorized";
        if (!categoryMap[category]) {
          categoryMap[category] = { count: 0, total: 0 };
        }
        categoryMap[category].count += 1;
        categoryMap[category].total += entry.amount;

        return {
          ...entry,
          runningBalance,
        };
      });

      return {
        success: true,
        folioId,
        entries: entriesWithBalance,
        summary: {
          totalEntries: entriesWithBalance.length,
          activeEntries: entriesWithBalance.filter(e => !e.deleted).length,
          voidedEntries: entriesWithBalance.filter(e => e.deleted).length,
          byCategory: categoryMap,
        },
      };
    } catch (error) {
      logger.error("Get transaction history error:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        `Failed to get transaction history: ${(error as Error).message}`
      );
    }
  }
);
