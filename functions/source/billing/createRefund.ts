

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import type { Payment as PaymentData } from "../types/payment";

export const createRefund = onCall({ region: 'us-central1', memory: '512MiB' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated.");
  }
  
  const uid = request.auth.uid;
  const { originalPaymentId, propertyId, refundAmount, reason } = request.data;
  if (!originalPaymentId || !propertyId || !refundAmount || !reason) {
    throw new HttpsError("invalid-argument", "Missing required fields for refund.");
  }

  try {
    // Check user permissions - either staff with finance access or property owner
    const staffDoc = await db.collection("staff").doc(uid).get();
    const staffData = staffDoc.data();
    const hasStaffPermission = staffDoc.exists && staffData?.permissions?.finance === true;

    const propertyDoc = await db.collection("properties").doc(propertyId).get();
    const propertyData = propertyDoc.data();
    const isPropertyOwner = propertyData?.ownerId === uid;

    if (!hasStaffPermission && !isPropertyOwner) {
      throw new HttpsError("permission-denied", "You do not have permission to process refunds.");
    }

    const originalPaymentRef = db.doc(`properties/${propertyId}/payments/${originalPaymentId}`);
  
    try {
      await db.runTransaction(async (transaction) => {
        const originalPaymentDoc = await transaction.get(originalPaymentRef);
        if (!originalPaymentDoc.exists) {
          throw new HttpsError("not-found", "Original payment not found.");
        }
        
        const originalPaymentData = originalPaymentDoc.data() as PaymentData;
        if (originalPaymentData.status !== "Paid") {
            throw new HttpsError("failed-precondition", "Only 'Paid' payments can be refunded.");
        }
        if (refundAmount > originalPaymentData.amountPaid) {
            throw new HttpsError("invalid-argument", "Refund amount cannot exceed the original payment amount.");
        }
        
        // 1. Create a new "refund" payment record
        const newRefundRef = db.collection(`properties/${originalPaymentData.propertyId}/payments`).doc();
        const refundPaymentData: Partial<PaymentData> = {
            ...originalPaymentData,
            id: newRefundRef.id,
            amountPaid: -Math.abs(refundAmount), // Ensure it's a negative value
            status: 'Refunded',
            isRefund: true,
            originalPaymentId: originalPaymentId,
            notes: `Refund for payment ${originalPaymentData.paymentNumber || originalPaymentId}. Reason: ${reason}`,
            createdAt: FieldValue.serverTimestamp(),
        };
        transaction.set(newRefundRef, refundPaymentData);
        
        // 2. Update the original payment status
        transaction.update(originalPaymentRef, { status: 'Refunded' });
        
        // 3. Update associated invoice if it exists
        if (originalPaymentData.invoiceId) {
          const invoiceRef = db.doc(`invoices/${originalPaymentData.invoiceId}`);
          transaction.update(invoiceRef, { 
              amount: FieldValue.increment(-Math.abs(refundAmount)),
              paymentStatus: 'Refunded',
          });
        }
      });
      
      return { 
        success: true, 
        message: "Refund processed successfully.",
        activity: {
          type: 'refund',
          title: 'Refund Processed',
          details: {
            amount: refundAmount,
            originalPaymentId: originalPaymentId,
            reason: reason
          },
          description: `Refund of ${refundAmount} processed - ${reason}`
        }
      };
      
    } catch (error: any) {
      logger.error("Error creating refund:", error);
      if (error instanceof HttpsError) {
          throw error;
      }
      throw new HttpsError("internal", "An unexpected error occurred while processing the refund.");
    }
  } catch (error: any) {
    logger.error("Error in createRefund:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred while processing the refund.");
  }
});
