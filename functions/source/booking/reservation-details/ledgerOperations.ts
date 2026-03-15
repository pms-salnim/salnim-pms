/**
 * Ledger Operations Cloud Functions
 * 
 * Handles immutable ledger entry creation for folio accounting
 * Called from frontend via Callable HTTP Functions
 * 
 * All operations are transactional and atomic
 * Timestamps are server-generated and stored as-is
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../firebase";
import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import type { LedgerEntry } from "../../types/folio";

/**
 * Create a CHARGE entry in the ledger
 * 
 * POST: /createLedgerCharge
 * {
 *   propertyId: string,
 *   reservationId: string,
 *   folioId: string,
 *   amount: number,
 *   description: string,
 *   category?: string,
 *   taxBreakdown?: Array<{ name: string; amount: number; rate?: number }>
 * }
 */
export const createLedgerCharge = onCall(
  { enforceAppCheck: false, region: "europe-west1", cors: true   },
  async (request) => {
    const {
      propertyId,
      reservationId,
      folioId,
      amount,
      description,
      category,
      chargeOptions,
    } = request.data;

    // Validate required fields
    if (!propertyId || !reservationId || !folioId || !amount || !description) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: propertyId, reservationId, folioId, amount, description"
      );
    }

    if (amount <= 0) {
      throw new HttpsError("invalid-argument", "Amount must be greater than 0");
    }

    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    try {
      return await db.runTransaction(async (transaction) => {
        // Verify folio exists
        const folioRef = db.doc(
          `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}`
        );
        const folioDoc = await transaction.get(folioRef);

        if (!folioDoc.exists) {
          throw new HttpsError(
            "not-found",
            `Folio ${folioId} not found in reservation ${reservationId}`
          );
        }

        // Generate unique ledger entry ID
        const ledgerId = `LEX-${reservationId}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`;

        // Get posting date from options or use today
        const postingDate = chargeOptions?.postingDate || new Date().toISOString().split("T")[0];

        // Create ledger entry (filter out undefined values for Firestore compatibility)
        const ledgerEntry: any = {
          id: ledgerId,
          folioId,
          type: "CHARGE",
          source: "MANUAL",
          amount,
          direction: "DEBIT",
          description,
          category: category || "Miscellaneous",
          taxBreakdown: [],
          createdAt: FieldValue.serverTimestamp(),
          createdBy: userId,
          postingDate: postingDate,
          isRefunded: false,
          deleted: false,
          immutable: chargeOptions?.immutable ?? true,
          taxStatus: chargeOptions?.taxStatus || "taxable",
          taxRate: chargeOptions?.taxRate || 0,
        };
        
        // Add optional fields only if they have values
        if (chargeOptions?.referenceId) {
          ledgerEntry.referenceId = chargeOptions.referenceId;
        }
        if (chargeOptions?.notes) {
          ledgerEntry.notes = chargeOptions.notes;
        }

        // Write ledger entry
        const ledgerRef = db.doc(
          `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/ledger/${ledgerId}`
        );
        transaction.set(ledgerRef, ledgerEntry);

        logger.info(`Created charge: ${ledgerId}`, {
          reservationId,
          folioId,
          amount,
          userId,
        });

        return {
          success: true,
          entryId: ledgerId,
        };
      });
    } catch (error) {
      logger.error("Error creating ledger charge:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", `Failed to create charge: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

/**
 * Create a PAYMENT entry in the ledger
 * 
 * POST: /createLedgerPayment
 * {
 *   propertyId: string,
 *   reservationId: string,
 *   folioId: string,
 *   amount: number,
 *   paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER',
 *   reference?: string
 * }
 */
export const createLedgerPayment = onCall(
  { enforceAppCheck: false, region: "europe-west1" },
  async (request) => {
    const {
      propertyId,
      reservationId,
      folioId,
      amount,
      paymentMethod,
      reference,
    } = request.data;

    if (!propertyId || !reservationId || !folioId || !amount || !paymentMethod) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: propertyId, reservationId, folioId, amount, paymentMethod"
      );
    }

    if (amount <= 0) {
      throw new HttpsError("invalid-argument", "Amount must be greater than 0");
    }

    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    // Get posting date - today
    const postingDate = new Date().toISOString().split("T")[0];

    try {
      return await db.runTransaction(async (transaction) => {
        // Verify folio exists
        const folioRef = db.doc(
          `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}`
        );
        const folioDoc = await transaction.get(folioRef);

        if (!folioDoc.exists) {
          throw new HttpsError(
            "not-found",
            `Folio ${folioId} not found in reservation ${reservationId}`
          );
        }

        // Generate unique ledger entry ID
        const ledgerId = `LEX-${reservationId}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`;

        // Create ledger entry
        const ledgerEntry: any = {
          id: ledgerId,
          folioId,
          type: "PAYMENT",
          source: "MANUAL",
          amount,
          direction: "CREDIT",
          description: `Payment received - ${paymentMethod}${
            reference ? ` (Ref: ${reference})` : ""
          }`,
          category: paymentMethod,
          taxBreakdown: [],
          createdAt: FieldValue.serverTimestamp(),
          createdBy: userId,
          postingDate: postingDate,
          isRefunded: false,
          deleted: false,
          immutable: true,
        };
        
        // Add reference only if provided
        if (reference) {
          ledgerEntry.referenceId = reference;
        }

        // Write ledger entry
        const ledgerRef = db.doc(
          `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/ledger/${ledgerId}`
        );
        transaction.set(ledgerRef, ledgerEntry);

        logger.info(`Created payment: ${ledgerId}`, {
          reservationId,
          folioId,
          amount,
          paymentMethod,
          userId,
        });

        return {
          success: true,
          entryId: ledgerId,
        };
      });
    } catch (error) {
      logger.error("Error creating ledger payment:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", `Failed to create payment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

/**
 * Create a REFUND entry in the ledger
 * 
 * POST: /createLedgerRefund
 * {
 *   propertyId: string,
 *   reservationId: string,
 *   folioId: string,
 *   originalEntryId: string,
 *   amount: number,
 *   reason?: string
 * }
 */
export const createLedgerRefund = onCall(
  { enforceAppCheck: false, region: "europe-west1" },
  async (request) => {
    const {
      propertyId,
      reservationId,
      folioId,
      originalEntryId,
      amount,
      reason,
    } = request.data;

    if (
      !propertyId ||
      !reservationId ||
      !folioId ||
      !originalEntryId ||
      !amount
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: propertyId, reservationId, folioId, originalEntryId, amount"
      );
    }

    if (amount <= 0) {
      throw new HttpsError("invalid-argument", "Amount must be greater than 0");
    }

    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    // Get posting date - today
    const postingDate = new Date().toISOString().split("T")[0];

    try {
      return await db.runTransaction(async (transaction) => {
        // Verify original entry exists
        const originalRef = db.doc(
          `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/ledger/${originalEntryId}`
        );
        const originalDoc = await transaction.get(originalRef);

        if (!originalDoc.exists) {
          throw new HttpsError(
            "not-found",
            `Original entry ${originalEntryId} not found`
          );
        }

        const originalData = originalDoc.data();
        if (!originalData) {
          throw new HttpsError(
            "internal",
            "Original entry data is missing"
          );
        }

        // Generate unique ledger entry ID
        const ledgerId = `LEX-${reservationId}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`;

        // Create refund entry
        const ledgerEntry: any = {
          id: ledgerId,
          folioId,
          type: "REFUND",
          source: "MANUAL",
          amount,
          direction: "CREDIT",
          description: `Refund: ${originalData.description}${
            reason ? ` (${reason})` : ""
          }`,
          category: originalData.category,
          taxBreakdown: [],
          createdAt: FieldValue.serverTimestamp(),
          createdBy: userId,
          postingDate: postingDate,
          referenceId: originalEntryId,
          isRefunded: false,
          deleted: false,
          immutable: true,
        };

        // Write refund entry
        const ledgerRef = db.doc(
          `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/ledger/${ledgerId}`
        );
        transaction.set(ledgerRef, ledgerEntry);

        // Mark original entry as refunded
        transaction.update(originalRef, { isRefunded: true });

        logger.info(`Created refund: ${ledgerId}`, {
          reservationId,
          folioId,
          originalEntryId,
          amount,
          userId,
        });

        return {
          success: true,
          entryId: ledgerId,
        };
      });
    } catch (error) {
      logger.error("Error creating ledger refund:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", `Failed to create refund: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

/**
 * Get ledger entries for a folio with calculated balance
 * 
 * POST: /getFolioLedger
 * {
 *   propertyId: string,
 *   reservationId: string,
 *   folioId: string
 * }
 */
export const getFolioLedger = onCall(
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
      const ledgerQuery = db
        .collection(
          `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/ledger`
        )
        .orderBy("createdAt", "asc");

      const snapshot = await ledgerQuery.get();
      const entries = snapshot.docs.map((doc) => {
        const data = doc.data();
        // Return timestamp as-is from Firestore
        return data as unknown as LedgerEntry;
      });

      // Calculate balance
      const activeEntries = entries.filter((e) => !e.deleted);
      const totalDebits = activeEntries
        .filter((e) => e.direction === "DEBIT")
        .reduce((sum, e) => sum + e.amount, 0);

      const totalCredits = activeEntries
        .filter((e) => e.direction === "CREDIT")
        .reduce((sum, e) => sum + e.amount, 0);

      const balance = totalDebits - totalCredits;

      return {
        success: true,
        entries,
        summary: {
          totalDebits,
          totalCredits,
          balance,
          entryCount: activeEntries.length,
        },
      };
    } catch (error) {
      logger.error("Error fetching folio ledger", error);
      throw new HttpsError("internal", "Failed to fetch ledger");
    }
  }
);
