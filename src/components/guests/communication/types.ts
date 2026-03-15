export interface GuestPortalMessage {
  id: string;
  conversationId: string;
  senderType: 'guest' | 'property';
  senderId: string;
  senderName: string;
  message: string;
  timestamp: any;
  status?: 'sent' | 'delivered' | 'read';
  attachments?: { name: string; type: string; url: string }[];
  fileAttachment?: { fileName: string; fileSize: number; fileType: string; fileUrl: string };
}

export interface GuestPortalConversation {
  id: string;
  propertyId: string;
  reservationId?: string;
  guestName: string;
  guestEmail?: string;
  roomName: string;
  roomType: string;
  reservationStatus?: string;
  lastMessage?: { text: string; senderType: 'guest' | 'property'; senderName: string; timestamp: any };
  unreadCount?: number;
  guestUnreadCount?: number;
  pinned?: boolean;
  createdAt?: any;
  updatedAt?: any;
  isActive?: boolean;
}
