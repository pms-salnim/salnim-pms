import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

/**
 * Validates preferences for logical conflicts and warnings.
 * Performs real-time validation on the client side before saving.
 */
export const validatePreferencesConflict = onCall(
  { memory: '256MiB' },
  async (request) => {
    const { preferences } = request.data;

    if (!preferences || typeof preferences !== 'object') {
      throw new HttpsError(
        "invalid-argument",
        "Preferences object is required."
      );
    }

    const conflicts: Array<{
      setting1: string;
      setting2: string;
      message: string;
      severity: 'warning' | 'info';
    }> = [];

    try {
      // Check for conflicting settings

      // Conflict 1: Full payment required + Same-day bookings
      if (
        preferences.requireFullPaymentBeforeCheckin === true &&
        preferences.allowSameDayBookings === true
      ) {
        conflicts.push({
          setting1: 'requireFullPaymentBeforeCheckin',
          setting2: 'allowSameDayBookings',
          message:
            'Same-day bookings may fail if payment is not received in time. Consider setting a cutoff time.',
          severity: 'warning',
        });
      }

      // Info 1: Auto no-show + No auto-assign
      if (
        preferences.autoNoShowAfterArrival === true &&
        preferences.autoAssignRooms === false
      ) {
        conflicts.push({
          setting1: 'autoNoShowAfterArrival',
          setting2: 'autoAssignRooms',
          message:
            'Manual room assignment is needed for accurate no-show marking. Consider enabling auto-assign.',
          severity: 'info',
        });
      }

      // Info 2: Require guest ID but no room selection
      if (
        preferences.requireGuestIdUpload === true &&
        preferences.allowGuestRoomSelection === false
      ) {
        conflicts.push({
          setting1: 'requireGuestIdUpload',
          setting2: 'allowGuestRoomSelection',
          message:
            'Guests will not see ID upload option until check-in confirmation. Ensure your check-in process handles this.',
          severity: 'info',
        });
      }

      // Info 3: Payment allocation without full payment requirement
      if (
        preferences.enablePaymentAllocation === true &&
        preferences.requireFullPaymentBeforeCheckin === false
      ) {
        conflicts.push({
          setting1: 'enablePaymentAllocation',
          setting2: 'requireFullPaymentBeforeCheckin',
          message:
            'Payment allocation is enabled but full payment is not required. Guests may have unpaid balances.',
          severity: 'info',
        });
      }

      // Info 4: GDPR enabled - verify with your privacy policy
      if (preferences.enableGDPRFeatures === true) {
        // This is just an informational check
        logger.info('GDPR features enabled - ensure privacy policy is compliant');
      }

      logger.info(
        `Validation completed with ${conflicts.length} conflicts/warnings`
      );

      return {
        hasConflict: conflicts.length > 0,
        conflicts,
        summary:
          conflicts.length === 0
            ? 'No conflicts detected'
            : `${conflicts.filter((c) => c.severity === 'warning').length} warnings, ${conflicts.filter((c) => c.severity === 'info').length} info messages`,
      };
    } catch (error) {
      logger.error("Error validating preferences:", error);
      throw new HttpsError(
        "internal",
        "Failed to validate preferences."
      );
    }
  }
);
