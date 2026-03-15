import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../firebase";

/**
 * Validates preferences data structure
 */
function validatePreferencesData(preferences: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate required fields
  const requiredFields = [
    'applicationLanguage',
    'propertyTimeZone',
    'applicationCurrency',
    'timeFormat',
  ];

  for (const field of requiredFields) {
    if (!preferences[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate enum values
  const validLanguages = ['en', 'fr', 'es', 'de', 'it', 'pt'];
  if (preferences.applicationLanguage && !validLanguages.includes(preferences.applicationLanguage)) {
    errors.push(`Invalid applicationLanguage: ${preferences.applicationLanguage}`);
  }

  const validTimeFormats = ['12h', '24h'];
  if (preferences.timeFormat && !validTimeFormats.includes(preferences.timeFormat)) {
    errors.push(`Invalid timeFormat: ${preferences.timeFormat}`);
  }

  const validCurrencyFormats = ['symbol', 'code', 'name'];
  if (preferences.currencyFormat && !validCurrencyFormats.includes(preferences.currencyFormat)) {
    errors.push(`Invalid currencyFormat: ${preferences.currencyFormat}`);
  }

  const validDateFormats = ['dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd'];
  if (preferences.dateFormat && !validDateFormats.includes(preferences.dateFormat)) {
    errors.push(`Invalid dateFormat: ${preferences.dateFormat}`);
  }

  const validNameFormats = ['firstLast', 'lastFirst', 'firstOnly'];
  if (preferences.calendarNameFormat && !validNameFormats.includes(preferences.calendarNameFormat)) {
    errors.push(`Invalid calendarNameFormat: ${preferences.calendarNameFormat}`);
  }

  const validWeekStarts = ['sunday', 'monday', 'saturday'];
  if (preferences.calendarWeekStart && !validWeekStarts.includes(preferences.calendarWeekStart)) {
    errors.push(`Invalid calendarWeekStart: ${preferences.calendarWeekStart}`);
  }

  const validBreakfastDistributions = ['included', 'extra', 'variable'];
  if (preferences.breakfastChannelDistribution && !validBreakfastDistributions.includes(preferences.breakfastChannelDistribution)) {
    errors.push(`Invalid breakfastChannelDistribution: ${preferences.breakfastChannelDistribution}`);
  }

  // Validate number ranges
  if (typeof preferences.guestCancellationWindow === 'number') {
    if (preferences.guestCancellationWindow < 0 || preferences.guestCancellationWindow > 365) {
      errors.push(`guestCancellationWindow must be between 0 and 365`);
    }
  }

  // Validate time format for sameDayCutoffTime
  if (preferences.sameDayCutoffTime) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(preferences.sameDayCutoffTime)) {
      errors.push(`Invalid sameDayCutoffTime format (use HH:MM): ${preferences.sameDayCutoffTime}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Saves property preferences to Firestore.
 * Validates all fields before saving.
 */
export const savePreferences = onCall(
  { memory: '256MiB' },
  async (request) => {
    const { propertyId, preferences } = request.data;
    const uid = request.auth?.uid;
    const email = request.auth?.token.email;

    // Validate input
    if (!propertyId) {
      throw new HttpsError(
        "invalid-argument",
        "Property ID is required."
      );
    }

    if (!preferences || typeof preferences !== 'object') {
      throw new HttpsError(
        "invalid-argument",
        "Preferences object is required."
      );
    }

    if (!uid) {
      throw new HttpsError("unauthenticated", "User must be authenticated.");
    }

    try {
      // Verify user has admin/manager access to property
      const propertyRef = db.collection("properties").doc(propertyId);
      const propertyDoc = await propertyRef.get();

      if (!propertyDoc.exists) {
        throw new HttpsError("not-found", "Property not found.");
      }

      // Check if user is admin or manager
      const teamRef = propertyRef.collection("team").doc(uid);
      const teamDoc = await teamRef.get();

      if (!teamDoc.exists) {
        throw new HttpsError(
          "permission-denied",
          "User does not have access to this property."
        );
      }

      const teamData = teamDoc.data();
      const validRoles = ['admin', 'manager'];
      if (!validRoles.includes(teamData?.role)) {
        throw new HttpsError(
          "permission-denied",
          "Only admins and managers can modify preferences."
        );
      }

      // Validate preferences data
      const validation = validatePreferencesData(preferences);
      if (!validation.valid) {
        throw new HttpsError(
          "invalid-argument",
          `Validation errors: ${validation.errors.join(', ')}`
        );
      }

      // Add metadata
      const preferencesWithMetadata = {
        ...preferences,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: email,
        version: 1,
      };

      // Save to Firestore
      const preferencesRef = propertyRef
        .collection("settings")
        .doc("preferences");

      await preferencesRef.set(preferencesWithMetadata, { merge: true });

      // Log the change to audit trail (optional)
      await propertyRef
        .collection("audit")
        .add({
          action: 'update_preferences',
          timestamp: FieldValue.serverTimestamp(),
          userId: uid,
          userEmail: email,
          changedFields: Object.keys(preferences),
          status: 'success',
        });

      logger.info(
        `Preferences updated for property ${propertyId} by ${email}`
      );

      return {
        success: true,
        propertyId,
        savedAt: new Date().toISOString(),
        message: 'Preferences saved successfully',
      };
    } catch (error) {
      logger.error("Error saving preferences:", error);

      // Log failed attempt to audit trail
      if (uid && propertyId) {
        try {
          await db
            .collection("properties")
            .doc(propertyId)
            .collection("audit")
            .add({
              action: 'update_preferences',
              timestamp: FieldValue.serverTimestamp(),
              userId: uid,
              userEmail: email,
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
            });
        } catch (auditError) {
          logger.warn("Failed to log audit trail:", auditError);
        }
      }

      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        "Failed to save preferences."
      );
    }
  }
);
