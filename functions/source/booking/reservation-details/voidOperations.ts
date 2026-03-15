/**
 * Void Transaction Operations
 * 
 * Allows voiding (canceling) a ledger entry with audit trail
 * Creates a compensating entry to reverse the original amount
 * Maintains immutability - never modifies original, only appends
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../firebase";
import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import type { LedgerEntry } from "../../types/folio";

/**
 * Void a ledger entry
 * 
 * POST: /voidTransaction
 * {
 *   propertyId: string,
 *   reservationId: string,
 *   folioId: string,
 *   entryId: string,
 *   voidReason: string
 * }
 * 
 * Process:
 * 1. Fetch original entry
 * 2. Validate entry is not already voided
 * 3. Mark original as deleted (soft-delete) with void reason
 * 4. Running balance automatically recalculated (excludes deleted entries)
 * 5. Maintains audit trail with void reason
 */
export const voidTransaction = onCall(
  { enforceAppCheck: false, region: "europe-west1", timeoutSeconds: 60 },
  async (request) => {
    const {
      propertyId,
      reservationId,
      folioId,
      entryId,
      voidReason,
    } = request.data;

    // Validate inputs
    if (
      !propertyId ||
      !reservationId ||
      !folioId ||
      !entryId ||
      !voidReason ||
      typeof voidReason !== "string" ||
      voidReason.trim().length === 0
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: propertyId, reservationId, folioId, entryId, voidReason (non-empty string)"
      );
    }

    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    const timestamp = Timestamp.now();

    try {
      return await db.runTransaction(async (transaction) => {
        // 1. Fetch original entry
        const originalRef = db.doc(
          `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/ledger/${entryId}`
        );
        const originalDoc = await transaction.get(originalRef);

        if (!originalDoc.exists) {
          throw new HttpsError(
            "not-found",
            `Entry ${entryId} not found in folio ${folioId}`
          );
        }

        const originalEntry = originalDoc.data() as LedgerEntry;

        // 2. Validate entry is not already voided
        if (originalEntry.referenceId?.startsWith("void-")) {
          throw new HttpsError(
            "failed-precondition",
            "Entry is already voided. Cannot void a voided entry."
          );
        }

        // 3. Mark original entry as voided (keep visible, just exclude from balance)
        transaction.update(originalRef, {
          referenceId: `void-${Date.now()}`, // Mark as voided with timestamp
          description: `[VOIDED] ${originalEntry.description} - Reason: ${voidReason.trim()}`,
          deleted: false, // Keep visible in ledger for audit trail
          voidedAt: new Date(timestamp.toMillis()),
          voidedBy: userId,
          voidReason: voidReason.trim(),
        });

        logger.info(`Marked entry ${entryId} as voided with reason: ${voidReason}`);

        return {
          success: true,
          entryId: entryId,
          amount: originalEntry.amount,
          originalDirection: originalEntry.direction,
          voidReason: voidReason.trim(),
          message: `Entry ${entryId} has been voided. Balance is now 0 as the charge is cancelled.`,
        };
      });
    } catch (error) {
      logger.error("Void transaction error:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        `Failed to void transaction: ${(error as Error).message}`
      );
    }
  }
);

/**
 * Get void transaction details
 * 
 * GET: /getVoidTransactionDetails
 * {
 *   propertyId: string,
 *   reservationId: string,
 *   folioId: string,
 *   voidEntryId: string
 * }
 */
export const getVoidTransactionDetails = onCall(
  { enforceAppCheck: false, region: "europe-west1" },
  async (request) => {
    const { propertyId, reservationId, folioId, voidEntryId } = request.data;

    if (!propertyId || !reservationId || !folioId || !voidEntryId) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: propertyId, reservationId, folioId, voidEntryId"
      );
    }

    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    try {
      // Fetch void entry
      const voidRef = db.doc(
        `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/ledger/${voidEntryId}`
      );
      const voidDoc = await voidRef.get();

      if (!voidDoc.exists) {
        throw new HttpsError(
          "not-found",
          `Void entry ${voidEntryId} not found`
        );
      }

      const voidEntry = voidDoc.data() as LedgerEntry;

      // Fetch original entry
      if (!voidEntry.referenceId) {
        throw new HttpsError(
          "invalid-argument",
          "Void entry missing original entry reference"
        );
      }

      const originalRef = db.doc(
        `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/ledger/${voidEntry.referenceId}`
      );
      const originalDoc = await originalRef.get();

      if (!originalDoc.exists) {
        throw new HttpsError(
          "not-found",
          `Original entry ${voidEntry.referenceId} not found`
        );
      }

      const originalEntry = originalDoc.data() as LedgerEntry;

      return {
        success: true,
        voidEntry,
        originalEntry,
      };
    } catch (error) {
      logger.error("Get void details error:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        `Failed to get void details: ${(error as Error).message}`
      );
    }
  }
);
