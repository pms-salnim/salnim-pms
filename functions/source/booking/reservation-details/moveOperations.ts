/**
 * Move Transaction Operations
 * 
 * Allows moving a ledger entry from one folio to another
 * Creates new entry in target folio and marks original as moved
 * Maintains immutability and audit trail
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../firebase";
import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import type { LedgerEntry } from "../../types/folio";

/**
 * Move a transaction to a different folio
 * 
 * POST: /moveTransaction
 * {
 *   propertyId: string,
 *   reservationId: string,
 *   sourceFolioId: string,
 *   targetFolioId: string,
 *   entryId: string,
 *   moveReason: string
 * }
 * 
 * Process:
 * 1. Fetch original entry from source folio
 * 2. Validate target folio exists
 * 3. Create identical entry in target folio with [Moved] marker
 * 4. Mark original as moved (soft-delete, reference link)
 * 5. Running balance auto-recalculated in both folios
 */
export const moveTransaction = onCall(
  { enforceAppCheck: false, region: "europe-west1", timeoutSeconds: 60 },
  async (request) => {
    const {
      propertyId,
      reservationId,
      sourceFolioId,
      targetFolioId,
      entryId,
      moveReason,
    } = request.data;

    // Validate inputs
    if (
      !propertyId ||
      !reservationId ||
      !sourceFolioId ||
      !targetFolioId ||
      !entryId ||
      !moveReason ||
      typeof moveReason !== "string" ||
      moveReason.trim().length === 0
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: propertyId, reservationId, sourceFolioId, targetFolioId, entryId, moveReason"
      );
    }

    if (sourceFolioId === targetFolioId) {
      throw new HttpsError(
        "invalid-argument",
        "Source and target folios cannot be the same"
      );
    }

    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    const timestamp = Timestamp.now();
    const moveGroupId = `move-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      return await db.runTransaction(async (transaction) => {
        // 1. Fetch original entry from source folio
        const sourceRef = db.doc(
          `properties/${propertyId}/reservations/${reservationId}/folios/${sourceFolioId}/ledger/${entryId}`
        );
        const sourceDoc = await transaction.get(sourceRef);

        if (!sourceDoc.exists) {
          throw new HttpsError(
            "not-found",
            `Entry ${entryId} not found in folio ${sourceFolioId}`
          );
        }

        const originalEntry = sourceDoc.data() as LedgerEntry;

        // Validate entry is not already moved
        if (originalEntry.deleted) {
          throw new HttpsError(
            "failed-precondition",
            "Entry is already moved or deleted. Cannot move a moved entry."
          );
        }

        // 2. Validate target folio exists
        const targetFolioRef = db.doc(
          `properties/${propertyId}/reservations/${reservationId}/folios/${targetFolioId}`
        );
        const targetFolioDoc = await transaction.get(targetFolioRef);

        if (!targetFolioDoc.exists) {
          throw new HttpsError(
            "not-found",
            `Target folio ${targetFolioId} not found`
          );
        }

        // 3. Create identical entry in target folio
        const newEntryId = `${entryId}-moved-to-${targetFolioId}`;

        const movedEntry: LedgerEntry = {
          id: newEntryId,
          folioId: targetFolioId,
          type: originalEntry.type,
          source: originalEntry.source,
          amount: originalEntry.amount,
          direction: originalEntry.direction,
          description: `${originalEntry.description} [Moved from ${sourceFolioId}]`,
          category: originalEntry.category,
          taxBreakdown: originalEntry.taxBreakdown,
          createdAt: new Date(timestamp.toMillis()),
          createdBy: userId,
          postingDate: originalEntry.postingDate,
          referenceId: moveGroupId, // Link to movement group
          isRefunded: false,
          deleted: false,
          immutable: true,
        };

        const targetEntryRef = db.doc(
          `properties/${propertyId}/reservations/${reservationId}/folios/${targetFolioId}/ledger/${newEntryId}`
        );
        transaction.set(targetEntryRef, movedEntry);

        logger.info(`Created moved entry ${newEntryId} in target folio ${targetFolioId}`);

        // 4. Mark original as moved (soft-delete)
        transaction.update(sourceRef, {
          deleted: true,
          referenceId: moveGroupId, // Link to movement group
        });

        logger.info(`Marked original entry ${entryId} as moved`);

        return {
          success: true,
          originalEntryId: entryId,
          movedEntryId: newEntryId,
          moveGroupId,
          sourceFolioId,
          targetFolioId,
          amount: originalEntry.amount,
          moveReason: moveReason.trim(),
          message: `Entry moved from ${sourceFolioId} to ${targetFolioId}. Reason: ${moveReason}`,
        };
      });
    } catch (error) {
      logger.error("Move transaction error:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        `Failed to move transaction: ${(error as Error).message}`
      );
    }
  }
);

/**
 * Get move transaction details
 * 
 * GET: /getMoveTransactionDetails
 * {
 *   propertyId: string,
 *   reservationId: string,
 *   moveGroupId: string
 * }
 */
export const getMoveTransactionDetails = onCall(
  { enforceAppCheck: false, region: "europe-west1" },
  async (request) => {
    const { propertyId, reservationId, moveGroupId } = request.data;

    if (!propertyId || !reservationId || !moveGroupId) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: propertyId, reservationId, moveGroupId"
      );
    }

    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    try {
      // Query all folios' ledger for entries with this moveGroupId
      const reservationRef = db.collection(
        `properties/${propertyId}/reservations/${reservationId}/folios`
      );
      const foliosSnap = await reservationRef.get();

      const moveDetails: Array<any> = [];

      for (const folioDoc of foliosSnap.docs) {
        const ledgerRef = folioDoc.ref.collection("ledger");
        const entriesSnap = await ledgerRef
          .where("referenceId", "==", moveGroupId)
          .get();

        for (const entryDoc of entriesSnap.docs) {
          moveDetails.push({
            folioId: folioDoc.id,
            entry: entryDoc.data(),
          });
        }
      }

      if (moveDetails.length === 0) {
        throw new HttpsError(
          "not-found",
          `No move transaction found with ID ${moveGroupId}`
        );
      }

      return {
        success: true,
        moveGroupId,
        moveDetails,
        totalEntries: moveDetails.length,
      };
    } catch (error) {
      logger.error("Get move details error:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        `Failed to get move details: ${(error as Error).message}`
      );
    }
  }
);
