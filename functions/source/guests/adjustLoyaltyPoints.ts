
import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import * as admin from "firebase-admin";
import type { LoyaltyHistoryEntry } from "../types/loyalty";

interface AdjustLoyaltyPointsRequest {
  guestId: string;
  propertyId: string;
  pointsChange: number;
  reason?: string;
}

interface AdjustLoyaltyPointsResponse {
  success: boolean;
  message: string;
  newLoyaltyPoints?: number;
  totalPointsEarned?: number;
  totalPointsRedeemed?: number;
}

/**
 * Cloud Function to manually adjust a guest's loyalty points
 * Called from the guest profile modal when staff makes manual adjustments
 * Handles all business logic server-side
 */
export const adjustLoyaltyPoints = onCall(
  { region: "us-central1" },
  async (request): Promise<AdjustLoyaltyPointsResponse> => {
    const { guestId, propertyId, pointsChange, reason } = request.data as AdjustLoyaltyPointsRequest;
    const auth = request.auth;

    // Validate authentication
    if (!auth) {
      throw new Error("Authentication required");
    }

    // Validate input
    if (!guestId || !propertyId) {
      throw new Error("Missing required fields: guestId, propertyId");
    }

    if (typeof pointsChange !== "number" || pointsChange === 0) {
      throw new Error("Points change must be a non-zero number");
    }

    try {
      // Get guest document
      const guestRef = db.collection("guests").doc(guestId);
      const guestDoc = await guestRef.get();

      if (!guestDoc.exists) {
        throw new Error(`Guest ${guestId} not found`);
      }

      const guestData = guestDoc.data();
      if (!guestData) {
        throw new Error("Guest data is empty");
      }

      // Verify guest belongs to the property
      if (guestData.propertyId !== propertyId) {
        throw new Error("Guest does not belong to this property");
      }

      // Validate user has permission (should be checked by rules, but be defensive)
      logger.log(`Adjusting loyalty points - Auth UID: ${auth.uid}, Property ID: ${propertyId}`);
      
      let userData: any = null;
      let staffName = auth.token?.name || "Staff";
      
      try {
        const userRef = db.collection("users").doc(auth.uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
          userData = userDoc.data();
          if (userData?.propertyId !== propertyId) {
            throw new Error("User does not have permission for this property");
          }
          staffName = userData?.displayName || auth.token?.name || "Staff";
        } else {
          // User document doesn't exist, but continue - authentication is valid
          logger.warn(`User ${auth.uid} does not have a user document in database`);
        }
      } catch (error) {
        if ((error as Error).message.includes("permission")) {
          throw error;
        }
        // Log but don't fail on other errors
        logger.warn(`Warning checking user permissions: ${(error as Error).message}`);
      }

      // Initialize missing loyalty fields
      const currentLoyaltyPoints = guestData.loyaltyPoints || 0;
      const currentTotalPointsEarned = guestData.totalPointsEarned || 0;
      const currentTotalPointsRedeemed = guestData.totalPointsRedeemed || 0;

      // Calculate new values
      const newLoyaltyPoints = Math.max(0, currentLoyaltyPoints + pointsChange);
      const adjustmentReason = reason || `Manual adjustment: ${pointsChange > 0 ? '+' : ''}${pointsChange} points`;

      // Prepare update payload
      const updatePayload: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (pointsChange > 0) {
        // Adding points
        updatePayload.loyaltyPoints = newLoyaltyPoints;
        updatePayload.totalPointsEarned = currentTotalPointsEarned + pointsChange;
      } else {
        // Removing points
        updatePayload.loyaltyPoints = newLoyaltyPoints;
        updatePayload.totalPointsRedeemed = currentTotalPointsRedeemed + Math.abs(pointsChange);
      }

      // Create loyalty history entry
      const historyRef = guestRef.collection("loyaltyHistory").doc();
      const loyaltyHistoryEntry: Omit<LoyaltyHistoryEntry, 'id' | 'date'> & { date: any } = {
        date: admin.firestore.FieldValue.serverTimestamp(),
        change: pointsChange,
        reason: adjustmentReason,
        staffName: staffName,
      };

      // Update guest document and add history entry
      await guestRef.update(updatePayload);
      await historyRef.set(loyaltyHistoryEntry);

      logger.log(
        `Adjusted ${pointsChange} loyalty points for guest ${guestId}. Reason: ${adjustmentReason}`
      );

      return {
        success: true,
        message: `${pointsChange > 0 ? 'Added' : 'Removed'} ${Math.abs(pointsChange)} loyalty points`,
        newLoyaltyPoints,
        totalPointsEarned: updatePayload.totalPointsEarned,
        totalPointsRedeemed: updatePayload.totalPointsRedeemed,
      };
    } catch (error) {
      logger.error(`Error adjusting loyalty points for guest ${guestId}:`, error);
      throw new Error(`Failed to adjust loyalty points: ${(error as Error).message}`);
    }
  }
);
