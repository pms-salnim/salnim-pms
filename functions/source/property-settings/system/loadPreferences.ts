import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../../firebase";

/**
 * Default preferences structure
 */
const DEFAULT_PREFERENCES = {
  // Localization & Format
  applicationLanguage: 'en',
  propertyTimeZone: 'UTC',
  applicationCurrency: 'USD',
  currencyFormat: 'symbol',
  dateFormat: 'mm/dd/yyyy',
  timeFormat: '24h',

  // Reservation & Availability
  allowOverbooking: false,
  autoNoShowAfterArrival: false,
  autoAssignRooms: false,
  allowSameDayBookings: false,
  sameDayCutoffTime: '18:00',
  autoCheckoutExtension: false,
  useDefaultCountry: false,
  defaultCountry: 'US',

  // Calendar & Display
  showEstimatedArrivalTime: true,
  enableGDPRFeatures: true,
  enablePaymentAllocation: false,
  requireFullPaymentBeforeCheckin: false,
  showCheckoutsInDeparture: true,
  calendarNameFormat: 'firstLast',
  calendarWeekStart: 'monday',

  // Channel & Rate Distribution
  breakfastChannelDistribution: 'included',

  // Guest & Reservation Experience
  requireGuestIdUpload: false,
  allowGuestRoomSelection: true,
  guestCancellationWindow: 7,
};

/**
 * Loads property preferences from Firestore.
 * Returns default preferences if none exist.
 */
export const loadPreferences = onCall(
  { memory: '256MiB' },
  async (request) => {
    const { propertyId } = request.data;
    const uid = request.auth?.uid;

    // Validate input
    if (!propertyId) {
      throw new HttpsError(
        "invalid-argument",
        "Property ID is required."
      );
    }

    if (!uid) {
      throw new HttpsError("unauthenticated", "User must be authenticated.");
    }

    try {
      // Verify user has access to property
      const propertyRef = db.collection("properties").doc(propertyId);
      const propertyDoc = await propertyRef.get();

      if (!propertyDoc.exists) {
        throw new HttpsError("not-found", "Property not found.");
      }

      // Check if user is part of the property team
      const teamRef = propertyRef.collection("team").doc(uid);
      const teamDoc = await teamRef.get();

      if (!teamDoc.exists) {
        throw new HttpsError(
          "permission-denied",
          "User does not have access to this property."
        );
      }

      // Load preferences
      const preferencesRef = propertyRef
        .collection("settings")
        .doc("preferences");
      const preferencesDoc = await preferencesRef.get();

      if (!preferencesDoc.exists) {
        logger.info(
          `No preferences found for property ${propertyId}, returning defaults`
        );
        return {
          success: true,
          preferences: DEFAULT_PREFERENCES,
          isDefault: true,
        };
      }

      const preferences = preferencesDoc.data();

      return {
        success: true,
        preferences: {
          ...DEFAULT_PREFERENCES,
          ...preferences,
        },
        isDefault: false,
        lastUpdated: preferences?.updatedAt?.toDate?.() || null,
        updatedBy: preferences?.updatedBy || null,
      };
    } catch (error) {
      logger.error("Error loading preferences:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        "Failed to load preferences."
      );
    }
  }
);
