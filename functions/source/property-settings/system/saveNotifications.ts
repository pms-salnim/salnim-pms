import { onCall } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../firebase';
import { getAuth } from 'firebase-admin/auth';

const auth = getAuth();

export const saveNotifications = onCall(async (request) => {
  try {
    const { propertyId, notifications } = request.data;
    const uid = request.auth?.uid;

    if (!uid) {
      throw new Error('Unauthorized');
    }

    if (!propertyId || !notifications) {
      throw new Error('Missing required parameters: propertyId, notifications');
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

    const userRole = userTeamDoc.data()?.role;
    if (!['admin', 'manager'].includes(userRole)) {
      throw new Error('Insufficient permissions to update notifications');
    }

    // Get user email from auth
    const userRecord = await auth.getUser(uid);
    const userEmail = userRecord.email || 'unknown';

    // Save notifications to Firestore
    const notificationsRef = db
      .collection('properties')
      .doc(propertyId)
      .collection('settings')
      .doc('notifications');

    await notificationsRef.set(
      {
        ...notifications,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: userEmail,
        version: 1,
      },
      { merge: true }
    );

    // Log to audit trail
    await db
      .collection('properties')
      .doc(propertyId)
      .collection('audit')
      .doc('notifications')
      .collection('history')
      .doc()
      .set({
        timestamp: FieldValue.serverTimestamp(),
        userId: uid,
        userEmail: userEmail,
        action: 'update',
        changedFields: {
          notificationsUpdated: true,
        },
        status: 'success',
      });

    logger.info('Notifications saved for property', { propertyId, userId: uid });

    return {
      success: true,
      message: 'Notifications saved successfully',
      savedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error saving notifications:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to save notifications');
  }
});
