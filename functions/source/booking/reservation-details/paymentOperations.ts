import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../../firebase";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { cleanFirestoreData } from "../../lib/firestoreUtils";

/**
 * Payment Processing for Reservations
 * 
 * Handles:
 * - Charge: Capture payment immediately via payment processor
 * - Pre-authorize: Create authorization hold, capture later
 * - Paid Previously: Record as manual entry, no payment processing
 * - Single/Multiple folio allocation
 */

interface PaymentProcessingRequest {
  propertyId: string;
  reservationId: string;
  folioIds: string[]; // Array of folio IDs for allocation
  amounts: number[]; // Amounts for each folio (must match folioIds length)
  paymentMethod: 'Cash' | 'Credit Card' | 'Bank Transfer' | 'Online Payment' | 'Other';
  collectPayment: 'charge' | 'pre-authorize' | 'paid-previously';
  paymentDate: string; // YYYY-MM-DD
  creditCardToken?: string; // Tokenized card (from Stripe/payment processor)
  creditCardType?: string; // Card type for reference
  creditCardLast4?: string; // Last 4 digits for reference
  notes?: string;
  guestName?: string;
  useCurrentDate?: boolean;
}

interface PaymentResult {
  success: boolean;
  paymentId?: string;
  transactionId?: string;
  status?: string;
  folioEntries?: Array<{ folioId: string; entryId: string; amount: number }>;
  error?: string;
  message?: string;
}

/**
 * Process Payment for Reservation
 * Creates ledger entries and handles payment gateway integration
 */
export const processPayment = onCall(
  { enforceAppCheck: false, region: "europe-west1", memory: "512MiB", timeoutSeconds: 30 },
  async (request: CallableRequest<PaymentProcessingRequest>): Promise<PaymentResult> => {
    const {
      propertyId,
      reservationId,
      folioIds,
      amounts,
      paymentMethod,
      collectPayment,
      paymentDate,
      creditCardToken,
      creditCardType,
      creditCardLast4,
      notes,
      guestName,
      useCurrentDate,
    } = request.data;

    // Authentication check
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    // Validation
    if (!propertyId || !reservationId || !folioIds || !amounts || !paymentMethod || !collectPayment) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: propertyId, reservationId, folioIds, amounts, paymentMethod, collectPayment"
      );
    }

    // Validate arrays match
    if (folioIds.length === 0 || folioIds.length !== amounts.length) {
      throw new HttpsError(
        "invalid-argument",
        "folioIds and amounts arrays must have matching length and not be empty"
      );
    }

    // Validate amounts
    const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
    if (totalAmount <= 0) {
      throw new HttpsError("invalid-argument", "Total payment amount must be greater than 0");
    }

    for (const amount of amounts) {
      if (amount < 0) {
        throw new HttpsError("invalid-argument", "All amounts must be positive");
      }
    }

    // Card validation if charge/pre-authorize
    if ((collectPayment === 'charge' || collectPayment === 'pre-authorize') && paymentMethod === 'Credit Card') {
      if (!creditCardToken) {
        throw new HttpsError(
          "invalid-argument",
          "Credit card token required for card payments"
        );
      }
    }

    const timestamp = Timestamp.now();
    const postingDate = useCurrentDate ? timestamp.toDate() : new Date(paymentDate);
    const postingDateString = postingDate.toISOString().split("T")[0];

    try {
      return await db.runTransaction(async (transaction) => {
        // Verify reservation exists
        const reservationRef = db.doc(`reservations/${reservationId}`);
        const reservationDoc = await transaction.get(reservationRef);

        if (!reservationDoc.exists) {
          throw new HttpsError("not-found", `Reservation ${reservationId} not found`);
        }

        const reservationData = reservationDoc.data();

        // Verify all folios exist
        const folioRefs: any[] = [];
        for (const folioId of folioIds) {
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

          folioRefs.push(folioRef);
        }

        let transactionId: string | undefined;
        let paymentStatus: 'pending' | 'completed' | 'pre-authorized' = 'completed';

        // STEP 1: Process payment with payment gateway (if needed)
        if (collectPayment === 'charge' && paymentMethod === 'Credit Card') {
          try {
            // TODO: Integrate with Stripe/Square/Payment Processor
            // For now, create a placeholder transaction ID
            transactionId = `TXN-${reservationId}-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 8)
              .toUpperCase()}`;
            
            logger.info(`Payment processing: Charging ${totalAmount} for reservation ${reservationId}`, {
              transactionId,
              cardLast4: creditCardLast4,
              collectPayment,
            });

            // In production, call payment processor here
            // const chargeResult = await stripe.charges.create({
            //   amount: Math.round(totalAmount * 100),
            //   currency: 'mad',
            //   source: creditCardToken,
            //   description: `Payment for reservation ${reservationId}`,
            // });
            // transactionId = chargeResult.id;

            paymentStatus = 'completed';
          } catch (paymentError: any) {
            logger.error("Payment processing failed:", paymentError);
            throw new HttpsError(
              "internal",
              `Payment processing failed: ${paymentError.message}`
            );
          }
        } else if (collectPayment === 'pre-authorize' && paymentMethod === 'Credit Card') {
          try {
            // Create authorization hold
            transactionId = `PRE-AUTH-${reservationId}-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 8)
              .toUpperCase()}`;

            logger.info(`Payment pre-authorization: ${totalAmount} for reservation ${reservationId}`, {
              transactionId,
              cardLast4: creditCardLast4,
            });

            // In production, call payment processor for authorization
            // const authResult = await stripe.charges.create({
            //   amount: Math.round(totalAmount * 100),
            //   currency: 'mad',
            //   source: creditCardToken,
            //   capture: false, // Don't capture, just authorize
            // });
            // transactionId = authResult.id;

            paymentStatus = 'pre-authorized';
          } catch (authError: any) {
            logger.error("Pre-authorization failed:", authError);
            throw new HttpsError(
              "internal",
              `Pre-authorization failed: ${authError.message}`
            );
          }
        } else if (collectPayment === 'paid-previously') {
          // No payment processing needed
          transactionId = `MANUAL-${reservationId}-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()}`;
          paymentStatus = 'completed';
        } else {
          // For any other payment method (cash, bank transfer, etc), create a transaction ID
          transactionId = `TXN-${reservationId}-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()}`;
          paymentStatus = 'completed';
        }

        // STEP 2: Create ledger entries for each folio
        const folioEntries: Array<{ folioId: string; entryId: string; amount: number }> = [];

        for (let i = 0; i < folioIds.length; i++) {
          const folioId = folioIds[i];
          const amount = amounts[i];

          if (amount === 0) continue; // Skip zero allocations

          // Generate unique ledger entry ID
          const ledgerId = `LEX-${reservationId}-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()}`;

          // Create ledger entry
          const descriptionParts = ['Payment - Accommodation'];
          if (collectPayment === 'pre-authorize') {
            descriptionParts.push('(Pre-authorized)');
          }
          if (notes) {
            descriptionParts.push(notes);
          }
          // Payment method goes on second line
          const description = descriptionParts.join('\n') + `\n${paymentMethod}`;

          const ledgerEntry = cleanFirestoreData({
            id: ledgerId,
            folioId,
            type: "PAYMENT",
            source: collectPayment === 'paid-previously' ? 'MANUAL' : paymentMethod,
            amount,
            direction: "CREDIT",
            description,
            category: paymentMethod,
            taxBreakdown: [],
            createdAt: timestamp.toDate(),
            createdBy: userId,
            postingDate: postingDateString,
            referenceId: transactionId || null,
            paymentStatus: paymentStatus,
            collectPayment: collectPayment,
            cardLast4: creditCardLast4 || null,
            cardType: creditCardType || null,
            isRefunded: false,
            deleted: false,
            immutable: true,
          });

          // Write ledger entry
          const ledgerRef = db.doc(
            `properties/${propertyId}/reservations/${reservationId}/folios/${folioId}/ledger/${ledgerId}`
          );
          transaction.set(ledgerRef, ledgerEntry);

          folioEntries.push({
            folioId,
            entryId: ledgerId,
            amount,
          });

          logger.info(`Ledger entry created for folio ${folioId}`, {
            entryId: ledgerId,
            amount,
            status: paymentStatus,
          });
        }

        // STEP 3: Update reservation payment tracking
        const guestName_ = guestName || reservationData?.guestName || 'Unknown Guest';

        const paymentRecordRef = db.collection(`properties/${propertyId}/payments`).doc();
        const paymentRecord = {
          propertyId,
          reservationId,
          guestName: guestName_,
          amountPaid: totalAmount,
          paymentMethod,
          collectPayment,
          paymentStatus,
          cardLast4: creditCardLast4 || null,
          cardType: creditCardType || null,
          transactionId: transactionId,
          folioIds,
          amounts,
          notes: notes || null,
          postingDate: postingDateString,
          createdAt: timestamp.toDate(),
          createdBy: userId,
        };

        transaction.set(paymentRecordRef, paymentRecord);

        return {
          success: true,
          paymentId: paymentRecordRef.id,
          transactionId: transactionId,
          status: paymentStatus,
          folioEntries,
          message: `Payment ${paymentStatus === 'pre-authorized' ? 'pre-authorized' : 'processed'} successfully for ${totalAmount.toFixed(2)} MAD`,
        };
      });
    } catch (error) {
      logger.error("Payment processing error:", error);
      throw error instanceof HttpsError
        ? error
        : new HttpsError(
            "internal",
            error instanceof Error ? error.message : "Unknown error processing payment"
          );
    }
  }
);

/**
 * Capture Pre-authorized Payment
 * Finalizes a pre-authorized payment
 */
export const capturePreAuthorizedPayment = onCall(
  { enforceAppCheck: false, region: "europe-west1" },
  async (request: CallableRequest<{
    propertyId: string;
    reservationId: string;
    transactionId: string;
  }>): Promise<PaymentResult> => {
    const { propertyId, reservationId, transactionId } = request.data;

    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    if (!propertyId || !reservationId || !transactionId) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: propertyId, reservationId, transactionId"
      );
    }

    try {
      return await db.runTransaction(async (transaction) => {
        // Find ledger entries with this transaction ID
        const paymentsQuery = db
          .collectionGroup("ledger")
          .where("referenceId", "==", transactionId)
          .where("paymentStatus", "==", "pre-authorized");

        const paymentDocs = await paymentsQuery.get();

        if (paymentDocs.empty) {
          throw new HttpsError(
            "not-found",
            `No pre-authorized payment found with transaction ID ${transactionId}`
          );
        }

        // TODO: Call payment processor to capture the pre-auth
        // const captureResult = await stripe.charges.retrieve(transactionId);
        // await stripe.charges.capture(transactionId);

        // Update all ledger entries to completed
        for (const doc of paymentDocs.docs) {
          transaction.update(doc.ref, {
            paymentStatus: 'completed',
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        return {
          success: true,
          transactionId,
          status: 'completed',
          message: `Pre-authorized payment ${transactionId} captured successfully`,
        };
      });
    } catch (error) {
      logger.error("Capture error:", error);
      throw error instanceof HttpsError
        ? error
        : new HttpsError(
            "internal",
            error instanceof Error ? error.message : "Failed to capture payment"
          );
    }
  }
);

/**
 * Void Pre-authorized Payment
 * Cancels a pre-authorized hold
 */
export const voidPreAuthorizedPayment = onCall(
  { enforceAppCheck: false, region: "europe-west1" },
  async (request: CallableRequest<{
    propertyId: string;
    reservationId: string;
    transactionId: string;
    reason?: string;
  }>): Promise<PaymentResult> => {
    const { propertyId, reservationId, transactionId, reason } = request.data;

    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    if (!propertyId || !reservationId || !transactionId) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: propertyId, reservationId, transactionId"
      );
    }

    try {
      return await db.runTransaction(async (transaction) => {
        // Find and delete pre-authorized ledger entries
        const paymentsQuery = db
          .collectionGroup("ledger")
          .where("referenceId", "==", transactionId)
          .where("paymentStatus", "==", "pre-authorized");

        const paymentDocs = await paymentsQuery.get();

        if (paymentDocs.empty) {
          throw new HttpsError(
            "not-found",
            `No pre-authorized payment found with transaction ID ${transactionId}`
          );
        }

        // TODO: Call payment processor to void the authorization
        // await stripe.charges.retrieve(transactionId).then(charge => {
        //   if (!charge.captured) stripe.charges.refund(transactionId);
        // });

        // Mark ledger entries as deleted
        for (const doc of paymentDocs.docs) {
          transaction.update(doc.ref, {
            deleted: true,
            paymentStatus: 'voided',
            deletedAt: timestamp.toDate(),
            deletedReason: reason || 'Pre-authorization voided',
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        return {
          success: true,
          transactionId,
          status: 'voided',
          message: `Pre-authorized payment ${transactionId} voided successfully`,
        };
      });
    } catch (error) {
      logger.error("Void error:", error);
      throw error instanceof HttpsError
        ? error
        : new HttpsError(
            "internal",
            error instanceof Error ? error.message : "Failed to void payment"
          );
    }
  }
);

const timestamp = Timestamp.now();
