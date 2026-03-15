import { onCall } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { db } from '../../firebase';

const defaultNotifications = {
  // Reservation Notifications
  newReservationReceived: { inApp: true, email: true, sms: false },
  reservationModified: { inApp: true, email: true, sms: false },
  reservationCancelled: { inApp: true, email: true, sms: false },
  reservationConfirmed: { inApp: true, email: true, sms: true },

  // Guest Notifications
  guestCheckInReminder: { inApp: false, email: true, sms: false },
  guestCheckOutReminder: { inApp: false, email: true, sms: false },
  guestCheckInConfirmed: { inApp: true, email: true, sms: false },
  guestCheckOutCompleted: { inApp: true, email: true, sms: false },

  // Payment Notifications
  paymentReceived: { inApp: true, email: true, sms: false },
  paymentFailed: { inApp: true, email: true, sms: true },
  paymentReminder: { inApp: false, email: true, sms: true },
  refundProcessed: { inApp: true, email: true, sms: false },

  // Staff Notifications
  staffTaskAssigned: { inApp: true, email: true, sms: false },
  staffTaskCompleted: { inApp: true, email: false, sms: false },
  maintenanceReportSubmitted: { inApp: true, email: true, sms: false },
  housekeepingReportSubmitted: { inApp: true, email: true, sms: false },

  // System Notifications
  systemAlert: { inApp: true, email: true, sms: true },
  integrationError: { inApp: true, email: true, sms: false },
  lowInventory: { inApp: true, email: true, sms: false },
  holidayPriceUpdate: { inApp: true, email: true, sms: false },

  // Email Settings
  emailFromAddress: 'noreply@property.com',
  emailFromName: 'Property Management',
  enableEmailTemplates: true,

  // SMS Settings
  enableSMS: false,
  smsFromNumber: '',
  smsTimeWindow: '09:00-22:00',

  // Do Not Disturb
  enableDND: false,
  dndStartTime: '22:00',
  dndEndTime: '08:00',

  // Sound Settings
  enableSound: true,
  soundVolume: 70,
  soundPreset: 'bell',
  muteInDND: true,
};

export const loadNotifications = onCall(async (request) => {
  try {
    const { propertyId } = request.data;
    const uid = request.auth?.uid;

    if (!uid) {
      throw new Error('Unauthorized');
    }

    if (!propertyId) {
      throw new Error('Missing required parameter: propertyId');
    }

    // Verify user has access to property
    const userTeamDoc = await db
      .collection('properties')
      .doc(propertyId)
      .collection('team')
      .doc(uid)
      .get();

    if (!userTeamDoc.exists) {
      throw new Error('User does not have access to this property');
    }

    // Load notifications from Firestore
    const notificationsDoc = await db
      .collection('properties')
      .doc(propertyId)
      .collection('settings')
      .doc('notifications')
      .get();

    if (!notificationsDoc.exists) {
      // Return default notifications if not set
      logger.info('No notifications found, returning defaults for property', { propertyId });
      return {
        notifications: defaultNotifications,
        lastUpdated: null,
        updatedBy: null,
      };
    }

    const data = notificationsDoc.data();

    logger.info('Notifications loaded for property', { propertyId, userId: uid });

    return {
      notifications: data,
      lastUpdated: data?.updatedAt || null,
      updatedBy: data?.updatedBy || null,
    };
  } catch (error) {
    logger.error('Error loading notifications:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to load notifications');
  }
});
