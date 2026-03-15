/**
 * Allocation & Balance Functions
 * 
 * Handles payment allocation to charges and balance calculations
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../firebase";
import * as logger from "firebase-functions/logger";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import type { AllocationRecord } from "../../types/folio";

/**
 * Allocate a payment to specific charges
 * 
 * POST: /allocatePayment
 * {
 *   propertyId: string,
 *   reservationId: string,
 *   folioId: string,
 *   paymentEntryId: string,
 *   allocations: Array<{ chargeId: string; amount: number }>
 * }
 */
export const allocatePayment = onCall(
  { enforceAppCheck: true, region: "europe-west1" },
  async (request) => {
    const {
      propertyId,
      reservationId,
      folioId,
      paymentEntryId,
      allocations,
    } = request.data;

    if (
      !propertyId ||
      !reservationId ||
      !folioId ||
      !paymentEntryId ||
      !allocations ||
      !Array.isArray(allocations)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: propertyId, reservationId, folioId, paymentEntryId, allocations (array)"
      );
    }

    // Validate allocations
    const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    if (totalAllocated <= 0) {
      throw new HttpsError(
        "invalid-argument",
        "Total allocation amount must be greater than 0"
      );
    }

    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    try {
      return await db.runTransaction(async (transaction) => {
        // Verify payment entry exists
        const paymentRef = db.doc(
          `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/ledger/${paymentEntryId}`
        );
        const paymentDoc = await transaction.get(paymentRef);

        if (!paymentDoc.exists) {
          throw new HttpsError(
            "not-found",
            `Payment entry ${paymentEntryId} not found`
          );
        }

        const paymentData = paymentDoc.data();
        if (!paymentData || paymentData.type !== "PAYMENT") {
          throw new HttpsError(
            "invalid-argument",
            "Entry is not a payment entry"
          );
        }

        // Create allocation records for each charge
        const allocationIds: string[] = [];
        const allocationsRef = db.collection(
          `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/allocations`
        );

        for (const { chargeId, amount } of allocations) {
          if (amount <= 0) {
            throw new HttpsError(
              "invalid-argument",
              `Invalid allocation amount for charge ${chargeId}`
            );
          }

          // Verify charge exists
          const chargeRef = db.doc(
            `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/ledger/${chargeId}`
          );
          const chargeDoc = await transaction.get(chargeRef);

          if (!chargeDoc.exists) {
            throw new HttpsError("not-found", `Charge ${chargeId} not found`);
          }
          // Create allocation record
          const allocationId = `alloc-${paymentEntryId}-${chargeId}-${Date.now()}`;
          const allocation: AllocationRecord = {
            id: allocationId,
            paymentId: paymentEntryId,
            chargeId,
            amount,
            createdAt: FieldValue.serverTimestamp() as any,
            createdBy: userId,
          };

          transaction.set(allocationsRef.doc(allocationId), allocation);
          allocationIds.push(allocationId);
        }

        logger.info(`Created allocations for payment: ${paymentEntryId}`, {
          reservationId,
          folioId,
          allocationCount: allocationIds.length,
          userId,
        });

        return {
          success: true,
          paymentEntryId,
          allocationIds,
          totalAllocated,
        };
      });
    } catch (error) {
      logger.error("Error allocating payment", error);
      throw new HttpsError("internal", "Failed to allocate payment");
    }
  }
);

/**
 * Get all allocations for a folio
 * 
 * POST: /getAllocations
 * {
 *   propertyId: string,
 *   reservationId: string,
 *   folioId: string
 * }
 */
export const getAllocations = onCall(
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
      const snapshot = await db
        .collection(
          `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/allocations`
        )
        .orderBy("createdAt", "desc")
        .get();

      const allocations = snapshot.docs.map((doc) => ({
        ...doc.data(),
      })) as AllocationRecord[];

      // Group by payment
      const byPayment: Record<string, AllocationRecord[]> = {};
      allocations.forEach((alloc) => {
        if (!byPayment[alloc.paymentId]) {
          byPayment[alloc.paymentId] = [];
        }
        byPayment[alloc.paymentId].push(alloc);
      });

      return {
        success: true,
        allocations,
        byPayment,
        totalRecords: allocations.length,
      };
    } catch (error) {
      logger.error("Error fetching allocations", error);
      throw new HttpsError("internal", "Failed to fetch allocations");
    }
  }
);

/**
 * Get balance for a folio with running totals
 * 
 * POST: /getFolioBalance
 * {
 *   propertyId: string,
 *   reservationId: string,
 *   folioId: string
 * }
 */
export const getFolioBalance = onCall(
  { enforceAppCheck: false, region: "europe-west1", cors: true },
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
      // Fetch all ledger entries ordered by document ID (which contains timestamp)
      // LEX-{reservationId}-{timestamp}-{random}
      const ledgerSnapshot = await db
        .collection(
          `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/ledger`
        )
        .orderBy(FieldPath.documentId(), "asc")
        .get();

      const entries = ledgerSnapshot.docs.map((doc) => {
        const data = doc.data();
        // Return as-is from Firestore (timestamp will be included)
        return data;
      });

      // Calculate balance
      let totalDebits = 0;
      let totalCredits = 0;
      let runningBalance = 0;

      const entriesWithBalance = entries.map((entry: any) => {
        // Skip deleted and voided entries from balance calculation
        if (!entry.deleted && !entry.referenceId?.startsWith("void-")) {
          if (entry.direction === "DEBIT") {
            totalDebits += entry.amount;
            runningBalance += entry.amount;
          } else {
            totalCredits += entry.amount;
            runningBalance -= entry.amount;
          }
        }

        return {
          ...entry,
          runningBalance,
        };
      });

      const balance = totalDebits - totalCredits;

      return {
        success: true,
        folioId,
        entries: entriesWithBalance,
        summary: {
          totalDebits,
          totalCredits,
          balance,
          amountOwed: Math.max(0, balance),
          creditAmount: Math.max(0, -balance),
          entryCount: entries.filter((e: any) => !e.deleted).length,
        },
      };
    } catch (error) {
      logger.error("Error calculating folio balance", error);
      throw new HttpsError("internal", "Failed to calculate balance");
    }
  }
);

/**
 * Get balance summary across all folios for a reservation
 * 
 * POST: /getReservationBalance
 * {
 *   propertyId: string,
 *   reservationId: string
 * }
 */
export const getReservationBalance = onCall(
  { enforceAppCheck: false, region: "europe-west1" },
  async (request) => {
    const { propertyId, reservationId } = request.data;

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
      // Get all folios
      const foliosSnapshot = await db
        .collection(
          `properties/${propertyId}/reservations/${reservationId}/folios`
        )
        .get();

      const folios = foliosSnapshot.docs.map((doc) => doc.id);

      // Calculate balance for each folio
      let reservationDebits = 0;
      let reservationCredits = 0;
      const folioBalances: Record<string, any> = {};

      for (const folioId of folios) {
        const ledgerSnapshot = await db
          .collection(
            `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/ledger`
          )
          .get();

        let folioDebits = 0;
        let folioCredits = 0;

        ledgerSnapshot.docs.forEach((doc) => {
          const entry = doc.data();
          if (!entry.deleted) {
            if (entry.direction === "DEBIT") {
              folioDebits += entry.amount;
            } else {
              folioCredits += entry.amount;
            }
          }
        });

        reservationDebits += folioDebits;
        reservationCredits += folioCredits;

        folioBalances[folioId] = {
          totalDebits: folioDebits,
          totalCredits: folioCredits,
          balance: folioDebits - folioCredits,
        };
      }

      const totalBalance = reservationDebits - reservationCredits;

      return {
        success: true,
        reservationId,
        folioCount: folios.length,
        folios: folioBalances,
        summary: {
          totalDebits: reservationDebits,
          totalCredits: reservationCredits,
          balance: totalBalance,
          amountOwed: Math.max(0, totalBalance),
          creditAmount: Math.max(0, -totalBalance),
        },
      };
    } catch (error) {
      logger.error("Error calculating reservation balance", error);
      throw new HttpsError("internal", "Failed to calculate reservation balance");
    }
  }
);
