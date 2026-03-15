
import type { Timestamp } from 'firebase/firestore';

export interface Attachment {
  name: string;
  type: string; // e.g., 'image/png', 'application/pdf'
  url: string; // URL from Firebase Storage
}

export interface Conversation {
  id: string; // Document ID
  participants: string[]; // Array of participant UIDs
  participantDetails: { // Denormalized data for quick display
    [uid: string]: {
      fullName: string;
      profilePicture?: string;
    }
  };
  property_id: string;
  lastMessage?: {
    text: string;
    sender_id: string;
    timestamp: Timestamp;
    hasAttachment?: boolean;
  };
  unreadCounts?: {
    [participantId: string]: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Message {
  id: string; // Document ID
  sender_id: string;
  text: string;
  timestamp: Timestamp;
  status?: 'sent' | 'delivered' | 'read';
  attachments?: Attachment[];
}
