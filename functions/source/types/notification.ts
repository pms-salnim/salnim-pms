import type { Timestamp } from 'firebase/firestore';

export type NotificationType = 'new_reservation' | 'payment_received' | 'cancellation' | 'new_message';

export interface Notification {
  id: string;
  propertyId: string;
  title: string;
  description: string;
  type: NotificationType;
  relatedDocId?: string; // e.g., reservation ID
  createdAt: Timestamp;
  read: boolean;
  // If notifications are user-specific, we might need a user ID array.
  // For now, let's assume they are property-wide.
}
