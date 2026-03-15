import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../firebase";
import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import type { LedgerEntry } from "../../types/folio";

/**
 * Split a transaction across multiple folios
 * 
 * POST: /splitTransaction
 * {
 *   propertyId: string,
 *   reservationId: string,
 *   originalFolioId: string,
 *   originalEntryId: string,
 *   allocations: Array<{ folioId: string; percentage: number }>
 * }
 * 
 * Process:
 * 1. Fetch original entry
 * 2. Validate allocations don't exceed 100%
 * 3. Create split entries in target folios
 * 4. Link all entries via referenceId
 * 5. Mark original as "split" (via referenceId)
 * 6. Create remainder entry if allocation < 100% (stays on original folio)
 */
export const splitTransaction = onCall(
  { enforceAppCheck: false, region: "europe-west1", timeoutSeconds: 60 },
  async (request) => {
    const {
      propertyId,
      reservationId,
      originalFolioId,
      originalEntryId,
      allocations,
    } = request.data;

    // Validate inputs
    if (
      !propertyId ||
      !reservationId ||
      !originalFolioId ||
      !originalEntryId ||
      !allocations ||
      !Array.isArray(allocations) ||
      allocations.length === 0
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: propertyId, reservationId, originalFolioId, originalEntryId, allocations (non-empty array)"
      );
    }

    // Validate allocations don't exceed 100%
    const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);
    if (totalPercentage <= 0 || totalPercentage > 100.01) {
      throw new HttpsError(
        "invalid-argument",
        `Allocations must be between 0% and 100%. Got ${totalPercentage}%`
      );
    }

    // Validate each allocation
    for (const alloc of allocations) {
      if (!alloc.folioId || alloc.percentage < 0 || alloc.percentage > 100) {
        throw new HttpsError(
          "invalid-argument",
          "Invalid allocation: folioId required, percentage 0-100"
        );
      }
    }

    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    const timestamp = Timestamp.now();
    const splitGroupId = `split-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      return await db.runTransaction(async (transaction) => {
        // 1. Fetch original entry
        const originalRef = db.doc(
          `properties/${propertyId}/reservations/${reservationId}/folios/${originalFolioId}/ledger/${originalEntryId}`
        );
        const originalDoc = await transaction.get(originalRef);

        if (!originalDoc.exists) {
          throw new HttpsError(
            "not-found",
            `Entry ${originalEntryId} not found in folio ${originalFolioId}`
          );
        }

        const originalEntry = originalDoc.data() as LedgerEntry;

        // Check if already split
        if (originalEntry.referenceId?.startsWith("split-")) {
          throw new HttpsError(
            "failed-precondition",
            "Entry already split. Cannot split a split entry."
          );
        }

        // 2. Create split entries in each target folio
        const splitEntries: Array<{ folioId: string; amount: number; id: string }> = [];
        let totalSplitAmount = 0;

        for (const alloc of allocations) {
          // Skip original folio in allocations (will be handled separately)
          const splitAmount = (originalEntry.amount * alloc.percentage) / 100;
          totalSplitAmount += splitAmount;

          // Generate entry ID for this split
          const splitEntryId = `${originalEntryId}-split-${alloc.folioId}`;

          // Create split entry
          const splitEntry: LedgerEntry = {
            id: splitEntryId,
            folioId: alloc.folioId,
            type: originalEntry.type,
            source: originalEntry.source,
            amount: splitAmount,
            direction: originalEntry.direction,
            description: `${originalEntry.description} [Split ${alloc.percentage}%]`,
            category: originalEntry.category,
            taxBreakdown: originalEntry.taxBreakdown?.map(tax => ({
              ...tax,
              amount: (tax.amount * alloc.percentage) / 100,
            })),
            createdAt: new Date(timestamp.toMillis()),
            createdBy: userId,
            postingDate: originalEntry.postingDate,
            referenceId: splitGroupId, // Link all splits together
            isRefunded: false,
            deleted: false,
            immutable: true,
          };

          // Write split entry to this folio
          const splitRef = db.doc(
            `properties/${propertyId}/reservations/${reservationId}/folios/${alloc.folioId}/ledger/${splitEntryId}`
          );
          transaction.set(splitRef, splitEntry);

          splitEntries.push({
            folioId: alloc.folioId,
            amount: splitAmount,
            id: splitEntryId,
          });

          logger.info(`Created split entry ${splitEntryId} in folio ${alloc.folioId}`);
        }

        // 3. Update original entry with remaining amount
        // Calculate remaining amount and update the original entry
        const remainingAmount = originalEntry.amount - totalSplitAmount;
        
        transaction.update(originalRef, {
          amount: remainingAmount,
          description: remainingAmount > 0 
            ? `${originalEntry.description} [Split, Remaining: ${remainingAmount.toFixed(2)}]`
            : `${originalEntry.description} [Fully Split]`,
          referenceId: splitGroupId, // Link to split group for audit trail
          taxBreakdown: originalEntry.taxBreakdown?.map(tax => ({
            ...tax,
            amount: (tax.amount * (remainingAmount / originalEntry.amount)),
          })),
          // Don't set deleted: true - keep the original entry visible with updated amount
        });

        logger.info(`Updated original entry ${originalEntryId} with remaining amount: ${remainingAmount}`);

        return {
          success: true,
          splitGroupId,
          originalEntryId,
          remainingAmount,
          splitEntries: splitEntries.map(e => ({
            folioId: e.folioId,
            entryId: e.id,
            amount: e.amount,
          })),
          message: `Transaction split across ${splitEntries.length} folios. Remaining: ${remainingAmount.toFixed(2)}`,
        };
      });
    } catch (error) {
      logger.error("Split transaction error:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        `Failed to split transaction: ${(error as Error).message}`
      );
    }
  }
);

/**
 * Get split transaction details
 * 
 * GET: /getSplitTransactionDetails
 * {
 *   propertyId: string,
 *   reservationId: string,
 *   splitGroupId: string
 * }
 */
export const getSplitTransactionDetails = onCall(
  { enforceAppCheck: false, region: "europe-west1" },
  async (request) => {
    const { propertyId, reservationId, splitGroupId } = request.data;

    if (!propertyId || !reservationId || !splitGroupId) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: propertyId, reservationId, splitGroupId"
      );
    }

    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    try {
      // Query all folios' ledger for entries with this splitGroupId
      const reservationRef = db.collection(`properties/${propertyId}/reservations/${reservationId}/folios`);
      const foliosSnap = await reservationRef.get();

      const allSplits: Array<any> = [];

      for (const folioDoc of foliosSnap.docs) {
        const ledgerRef = folioDoc.ref.collection("ledger");
        const entriesSnap = await ledgerRef
          .where("referenceId", "==", splitGroupId)
          .get();

        for (const entryDoc of entriesSnap.docs) {
          allSplits.push({
            folioId: folioDoc.id,
            entry: entryDoc.data(),
          });
        }
      }

      if (allSplits.length === 0) {
        throw new HttpsError(
          "not-found",
          `No split transaction found with ID ${splitGroupId}`
        );
      }

      return {
        splitGroupId,
        splits: allSplits,
        totalAmount: allSplits.reduce((sum, s) => sum + s.entry.amount, 0),
      };
    } catch (error) {
      logger.error("Get split details error:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        `Failed to get split details: ${(error as Error).message}`
      );
    }
  }
);
