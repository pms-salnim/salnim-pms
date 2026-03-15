import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin if not already initialized
try {
  initializeApp();
} catch (error) {
  // App already initialized
}

const db = getFirestore();
const auth = getAuth();
const storage = getStorage();

// Helper function to handle CORS
const setCorsHeaders = (res: any) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

// Helper function to upload file to Firebase Storage
async function uploadFileToStorage(
  fileData: string, 
  fileName: string, 
  fileType: string, 
  propertyId: string, 
  conversationId: string
): Promise<string> {
  try {
    console.log('Starting file upload:', { fileName, fileType, propertyId, conversationId });
    
    // Extract base64 data from data URL
    const base64Data = fileData.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid file data format');
    }
    
    const buffer = Buffer.from(base64Data, 'base64');
    console.log('File buffer size:', buffer.length);
    
    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `chat-attachments/${propertyId}/${conversationId}/${timestamp}_${sanitizedFileName}`;
    
    console.log('Storage path:', storagePath);
    
    // Upload to Firebase Storage
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    
    await file.save(buffer, {
      metadata: {
        contentType: fileType,
        metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString(),
        },
      },
    });
    
    console.log('File saved to storage successfully');
    
    // Make file publicly accessible
    await file.makePublic();
    
    console.log('File made public');
    
    // Return public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    console.log('Generated public URL:', publicUrl);
    
    return publicUrl;
  } catch (error) {
    console.error('Error uploading file to storage:', error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper to strip undefined properties recursively before sending to Firestore
function stripUndefined(obj: any): any {
  if (obj === undefined) return undefined;
  if (obj === null) return null;
  if (Array.isArray(obj)) return obj.map(v => stripUndefined(v)).filter(v => v !== undefined);
  if (typeof obj === 'object') {
    const out: any = {};
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (v === undefined) return;
      const cleaned = stripUndefined(v);
      if (cleaned !== undefined) out[k] = cleaned;
    });
    return out;
  }
  return obj;
}

interface GuestPortalMessage {
  id: string;
  conversationId: string;
  senderType: 'guest' | 'property';
  senderId: string;
  senderName: string;
  message: string;
  timestamp: FirebaseFirestore.Timestamp;
  status: 'sent' | 'delivered' | 'read';
  attachments?: {
    name: string;
    type: string;
    url: string;
  }[];
  fileAttachment?: {
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
  };
}

interface GuestPortalConversation {
  id: string;
  propertyId: string;
  reservationId: string;
  guestName: string;
  guestEmail?: string;
  roomName: string;
  roomType: string;
  reservationStatus: 'Pending' | 'Confirmed' | 'Canceled' | 'No-Show' | 'Checked-in' | 'Completed';
  lastMessage?: {
    text: string;
    senderType: 'guest' | 'property';
    senderName: string;
    timestamp: FirebaseFirestore.Timestamp;
  };
  lastMessageTimestampMs?: number;
  unreadCount: number; // For property staff
  guestUnreadCount: number; // For guest
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  isActive: boolean;
}

export const guestPortalChat = onRequest(
  { 
    region: 'europe-west1',
    cors: true
  },
  async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.status(200).send();
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { action, data, authToken } = req.body;

      if (!action || !data) {
        res.status(400).json({ error: 'Missing required fields: action and data' });
        return;
      }

      // Verify authentication based on action
      let isAuthenticated = false;
      let userContext: any = null;

      if (authToken) {
        try {
          // Property staff authentication
          const decodedToken = await auth.verifyIdToken(authToken);
          const userDoc = await db.collection('staff').doc(decodedToken.uid).get();
          
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData?.permissions?.guests) {
              isAuthenticated = true;
              userContext = { type: 'property', uid: decodedToken.uid, data: userData };
            }
          }
        } catch (authError) {
          console.error('Auth error:', authError);
        }
      } else if (data.propertyId && data.reservationNumber) {
        // Guest authentication
        const reservationQuery = await db
          .collection('reservations')
          .where('propertyId', '==', data.propertyId)
          .where('reservationNumber', '==', data.reservationNumber)
          .limit(1)
          .get();

        if (!reservationQuery.empty) {
          const reservationDoc = reservationQuery.docs[0];
          isAuthenticated = true;
          userContext = { 
            type: 'guest', 
            reservationId: reservationDoc.id,
            data: reservationDoc.data()
          };
        }
      }

      if (!isAuthenticated) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      switch (action) {
        case 'getConversations':
          return await handleGetConversations(req, res, data, userContext);
        
        case 'getMessages':
          return await handleGetMessages(req, res, data, userContext);
        
        case 'sendMessage':
          return await handleSendMessage(req, res, data, userContext);
        
        case 'markAsRead':
          return await handleMarkAsRead(req, res, data, userContext);
        
        case 'createConversation':
          return await handleCreateConversation(req, res, data, userContext);
        case 'startConversation':
          return await handleStartConversation(req, res, data, userContext);
        case 'setPinned':
          return await handleSetPinned(req, res, data, userContext);
        case 'deleteConversation':
          return await handleDeleteConversation(req, res, data, userContext);
        
        default:
          res.status(400).json({ error: 'Invalid action' });
      }

    } catch (error) {
      console.error('Error in guestPortalChat:', error);
      res.status(500).json({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
);

async function handleGetConversations(req: any, res: any, data: any, userContext: any) {
  try {
    let conversationsQuery;

    if (userContext.type === 'property') {
      // Get all conversations for this property
      conversationsQuery = db
        .collection('guestPortalConversations')
        .where('propertyId', '==', data.propertyId)
        .where('isActive', '==', true)
        .orderBy('updatedAt', 'desc');
    } else {
      // Get conversation for this specific guest
      conversationsQuery = db
        .collection('guestPortalConversations')
        .where('reservationId', '==', userContext.reservationId)
        .where('isActive', '==', true);
    }

    const conversationsSnapshot = await conversationsQuery.get();
    const conversations: GuestPortalConversation[] = [];

    conversationsSnapshot.forEach(doc => {
      conversations.push({
        id: doc.id,
        ...doc.data()
      } as GuestPortalConversation);
    });

    res.status(200).json({ success: true, conversations });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
}

async function handleGetMessages(req: any, res: any, data: any, userContext: any) {
  try {
    const { conversationId, limit = 50, lastMessageId } = data;

    if (!conversationId) {
      res.status(400).json({ error: 'conversationId is required' });
      return;
    }

    // Verify user has access to this conversation
    const conversationDoc = await db.collection('guestPortalConversations').doc(conversationId).get();
    
    if (!conversationDoc.exists) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const conversationData = conversationDoc.data() as GuestPortalConversation;

    if (userContext.type === 'property' && conversationData.propertyId !== data.propertyId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (userContext.type === 'guest' && conversationData.reservationId !== userContext.reservationId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get messages
    let messagesQuery = db
      .collection('guestPortalConversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(limit);

    if (lastMessageId) {
      const lastMessageDoc = await db
        .collection('guestPortalConversations')
        .doc(conversationId)
        .collection('messages')
        .doc(lastMessageId)
        .get();
      
      if (lastMessageDoc.exists) {
        messagesQuery = messagesQuery.startAfter(lastMessageDoc);
      }
    }

    const messagesSnapshot = await messagesQuery.get();
    const messages: GuestPortalMessage[] = [];

    messagesSnapshot.forEach(doc => {
      messages.push({
        id: doc.id,
        conversationId,
        ...doc.data()
      } as GuestPortalMessage);
    });

    res.status(200).json({ success: true, messages: messages.reverse() });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
}

async function handleSendMessage(req: any, res: any, data: any, userContext: any) {
  try {
    console.log('handleSendMessage called with data:', { 
      conversationId: data.conversationId, 
      hasMessage: !!data.message, 
      hasFileAttachment: !!data.fileAttachment,
      userContextType: userContext.type
    });
    
    const { conversationId, message, attachments = [], fileAttachment } = data;

    if (!conversationId || (!message?.trim() && !fileAttachment)) {
      console.log('Validation failed:', { conversationId, hasMessage: !!message?.trim(), hasFileAttachment: !!fileAttachment });
      res.status(400).json({ error: 'conversationId and either message or fileAttachment are required' });
      return;
    }

    // Verify conversation access
    const conversationRef = db.collection('guestPortalConversations').doc(conversationId);
    const conversationDoc = await conversationRef.get();
    
    if (!conversationDoc.exists) {
      console.log('Conversation not found:', conversationId);
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const conversationData = conversationDoc.data() as GuestPortalConversation;
    console.log('Conversation data loaded:', { 
      propertyId: conversationData.propertyId, 
      requestPropertyId: data.propertyId,
      reservationId: conversationData.reservationId,
      userReservationId: userContext.reservationId 
    });

    if (userContext.type === 'property' && conversationData.propertyId !== data.propertyId) {
      console.log('Property access denied');
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (userContext.type === 'guest' && conversationData.reservationId !== userContext.reservationId) {
      console.log('Guest access denied');
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const now = Timestamp.now();
    const senderType = userContext.type;
    const senderName = userContext.type === 'guest' 
      ? conversationData.guestName 
      : userContext.data.fullName || 'Property Staff';

    let processedFileAttachment = null;
    
    // Handle file upload if present
    if (fileAttachment && fileAttachment.fileData) {
      console.log('Processing file attachment:', { 
        fileName: fileAttachment.fileName, 
        fileType: fileAttachment.fileType,
        fileSize: fileAttachment.fileSize 
      });
      
      try {
        const fileUrl = await uploadFileToStorage(
          fileAttachment.fileData,
          fileAttachment.fileName,
          fileAttachment.fileType,
          conversationData.propertyId,
          conversationId
        );
        
        processedFileAttachment = {
          fileName: fileAttachment.fileName,
          fileSize: fileAttachment.fileSize,
          fileType: fileAttachment.fileType,
          fileUrl: fileUrl
        };
        
        console.log('File attachment processed successfully:', processedFileAttachment);
      } catch (uploadError) {
        console.error('File upload error:', uploadError);
        res.status(500).json({ error: 'Failed to upload file', details: uploadError instanceof Error ? uploadError.message : 'Unknown error' });
        return;
      }
    }

    // Create message
    const newMessage: Omit<GuestPortalMessage, 'id'> & { timestampMs?: number } = {
      conversationId,
      senderType: senderType as 'guest' | 'property',
      senderId: userContext.type === 'guest' ? userContext.reservationId : userContext.uid,
      senderName,
      message: message?.trim() || (processedFileAttachment ? '' : ''),
      timestamp: now as any,
      timestampMs: (now as any).toMillis ? (now as any).toMillis() : Date.now(),
      status: 'sent',
      attachments: attachments || [],
      ...(processedFileAttachment && { fileAttachment: processedFileAttachment })
    };
    
    console.log('Creating message:', { 
      hasFileAttachment: !!processedFileAttachment,
      messageText: newMessage.message 
    });

    // Add message to subcollection
    const cleanedMessage = stripUndefined(newMessage);
    const messageRef = await conversationRef.collection('messages').add(cleanedMessage);

    // Update conversation
    const lastMessageText = message?.trim() || (processedFileAttachment ? `📎 ${processedFileAttachment.fileName}` : '');
    
    const tsMs = (now as any).toMillis ? (now as any).toMillis() : Date.now();
    const updateData: Partial<GuestPortalConversation & { lastMessage?: any }> = {
      lastMessage: {
        text: lastMessageText,
        senderType: senderType as 'guest' | 'property',
        senderName,
        timestamp: now as any,
        timestampMs: tsMs
      },
      lastMessageTimestampMs: tsMs,
      updatedAt: now as any
    };

    // Increment unread count for the recipient
    if (userContext.type === 'guest') {
      updateData.unreadCount = (conversationData.unreadCount || 0) + 1;
    } else {
      updateData.guestUnreadCount = (conversationData.guestUnreadCount || 0) + 1;
    }

    const cleanedUpdate = stripUndefined(updateData);
    await conversationRef.update(cleanedUpdate);

    const responseMessage: GuestPortalMessage = {
      id: messageRef.id,
      ...newMessage
    };

    console.log('Message sent successfully:', { messageId: messageRef.id });
    res.status(200).json({ success: true, message: responseMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handleMarkAsRead(req: any, res: any, data: any, userContext: any) {
  try {
    const { conversationId } = data;

    if (!conversationId) {
      res.status(400).json({ error: 'conversationId is required' });
      return;
    }

    const conversationRef = db.collection('guestPortalConversations').doc(conversationId);
    const conversationDoc = await conversationRef.get();
    
    if (!conversationDoc.exists) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const conversationData = conversationDoc.data() as GuestPortalConversation;

    // Verify access
    if (userContext.type === 'property' && conversationData.propertyId !== data.propertyId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (userContext.type === 'guest' && conversationData.reservationId !== userContext.reservationId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Reset appropriate unread count
    const updateData: Partial<GuestPortalConversation> = {};
    
    if (userContext.type === 'guest') {
      updateData.guestUnreadCount = 0;
    } else {
      updateData.unreadCount = 0;
    }

    const cleaned = stripUndefined(updateData);
    await conversationRef.update(cleaned);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
}

async function handleCreateConversation(req: any, res: any, data: any, userContext: any) {
  try {
    if (userContext.type !== 'guest') {
      res.status(403).json({ error: 'Only guests can create conversations' });
      return;
    }

    const { message } = data;
    const reservationData = userContext.data;

    if (!message?.trim()) {
      res.status(400).json({ error: 'Initial message is required' });
      return;
    }

    // Check if conversation already exists
    const existingConversation = await db
      .collection('guestPortalConversations')
      .where('reservationId', '==', userContext.reservationId)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (!existingConversation.empty) {
      res.status(400).json({ error: 'Conversation already exists' });
      return;
    }

    // Get room information
    const roomData = reservationData.rooms && reservationData.rooms.length > 0 
      ? reservationData.rooms[0] 
      : { roomName: 'Unknown Room', roomTypeName: 'Unknown Type' };

    const now = Timestamp.now();
    const guestName = reservationData.guestName || 'Guest';

    // Create conversation
    const newConversation: Omit<GuestPortalConversation, 'id'> = {
      propertyId: reservationData.propertyId,
      reservationId: userContext.reservationId,
      guestName,
      guestEmail: reservationData.guestEmail,
      roomName: roomData.roomName,
      roomType: roomData.roomTypeName,
      reservationStatus: reservationData.status || 'Confirmed',
      lastMessage: {
        text: message.trim(),
        senderType: 'guest',
        senderName: guestName,
        timestamp: now as any
      },
      unreadCount: 1, // Property has 1 unread
      guestUnreadCount: 0,
      createdAt: now as any,
      updatedAt: now as any,
         lastMessageTimestampMs: (now as any).toMillis ? (now as any).toMillis() : Date.now(),
      isActive: true
    };

    const cleanedConversation = stripUndefined(newConversation);
    const conversationRef = await db.collection('guestPortalConversations').add(cleanedConversation);

    // Add initial message
    const initialMessage: Omit<GuestPortalMessage, 'id'> & { timestampMs?: number } = {
      conversationId: conversationRef.id,
      senderType: 'guest',
      senderId: userContext.reservationId,
      senderName: guestName,
      message: message.trim(),
      timestamp: now as any,
         timestampMs: (now as any).toMillis ? (now as any).toMillis() : Date.now(),
      status: 'sent',
      attachments: []
    };

    const cleanedInitial = stripUndefined(initialMessage);
    const messageRef = await conversationRef.collection('messages').add(cleanedInitial);

    const responseConversation: GuestPortalConversation = {
      id: conversationRef.id,
      ...newConversation
    };

    const responseMessage: GuestPortalMessage = {
      id: messageRef.id,
      ...initialMessage
    };

    res.status(200).json({ 
      success: true, 
      conversation: responseConversation, 
      message: responseMessage 
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
}

async function handleStartConversation(req: any, res: any, data: any, userContext: any) {
  try {
    // Allow both guests and property staff to start/create a conversation
    let reservationId: string | null = null;
    let reservationData: any = null;

    if (userContext.type === 'guest') {
      reservationId = userContext.reservationId;
      reservationData = userContext.data;
    } else if (userContext.type === 'property') {
      // property must provide either reservationId or reservationNumber (+ propertyId)
      if (data.reservationId) {
        const rDoc = await db.collection('reservations').doc(data.reservationId).get();
        if (!rDoc.exists) {
          res.status(404).json({ error: 'Reservation not found' });
          return;
        }
        reservationId = rDoc.id;
        reservationData = rDoc.data();
      } else if (data.reservationNumber && data.propertyId) {
        const rq = await db.collection('reservations')
          .where('propertyId', '==', data.propertyId)
          .where('reservationNumber', '==', data.reservationNumber)
          .limit(1)
          .get();
        if (rq.empty) {
          res.status(404).json({ error: 'Reservation not found' });
          return;
        }
        reservationId = rq.docs[0].id;
        reservationData = rq.docs[0].data();
      } else {
        res.status(400).json({ error: 'reservationId or reservationNumber+propertyId is required' });
        return;
      }
    }

    if (!reservationId || !reservationData) {
      res.status(400).json({ error: 'Unable to resolve reservation' });
      return;
    }

    // Check for existing conversation
    const existingConversationQ = await db.collection('guestPortalConversations')
      .where('reservationId', '==', reservationId)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (!existingConversationQ.empty) {
      const doc = existingConversationQ.docs[0];
      const conv = { id: doc.id, ...(doc.data() as any) };
      res.status(200).json({ success: true, conversation: conv });
      return;
    }

    // Create new conversation (no initial message required)
    const roomData = reservationData.rooms && reservationData.rooms.length > 0
      ? reservationData.rooms[0]
      : { roomName: 'Unknown Room', roomTypeName: 'Unknown Type' };

    const now = Timestamp.now();
    const guestName = reservationData.guestName || 'Guest';

    const newConversationBase: any = {
      propertyId: reservationData.propertyId,
      reservationId: reservationId,
      guestName,
      guestEmail: reservationData.guestEmail,
      roomName: roomData.roomName,
      roomType: roomData.roomTypeName,
      reservationStatus: reservationData.status || 'Confirmed',
      unreadCount: 0,
      guestUnreadCount: 0,
      createdAt: now as any,
      updatedAt: now as any,
      isActive: true
    };

    // Only include lastMessage if present to avoid Firestore rejecting undefined
    if (reservationData.lastMessage) {
      newConversationBase.lastMessage = reservationData.lastMessage;
    }

    const newConversation: Omit<GuestPortalConversation, 'id'> = newConversationBase;

    const cleanedConversation = stripUndefined(newConversation);
    const conversationRef = await db.collection('guestPortalConversations').add(cleanedConversation);

    const responseConversation: GuestPortalConversation = {
      id: conversationRef.id,
      ...newConversation
    } as any;

    res.status(200).json({ success: true, conversation: responseConversation });
  } catch (error) {
    console.error('Error in startConversation:', error);
    res.status(500).json({ error: 'Failed to start conversation', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handleSetPinned(req: any, res: any, data: any, userContext: any) {
  try {
    if (userContext.type !== 'property') {
      res.status(403).json({ error: 'Only property staff can pin conversations' });
      return;
    }

    const { conversationId, propertyId, pinned } = data;
    if (!conversationId || typeof pinned !== 'boolean' || !propertyId) {
      res.status(400).json({ error: 'conversationId, propertyId and pinned are required' });
      return;
    }

    const conversationRef = db.collection('guestPortalConversations').doc(conversationId);
    const conversationDoc = await conversationRef.get();
    if (!conversationDoc.exists) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const conversationData = conversationDoc.data() as GuestPortalConversation;
    if (conversationData.propertyId !== propertyId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const now = Timestamp.now();
    const update = stripUndefined({ pinned, updatedAt: now as any });
    await conversationRef.update(update);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error setting pinned:', error);
    res.status(500).json({ error: 'Failed to set pinned' });
  }
}

async function handleDeleteConversation(req: any, res: any, data: any, userContext: any) {
  try {
    if (userContext.type !== 'property') {
      res.status(403).json({ error: 'Only property staff can delete conversations' });
      return;
    }

    const { conversationId, propertyId } = data;
    if (!conversationId || !propertyId) {
      res.status(400).json({ error: 'conversationId and propertyId are required' });
      return;
    }

    const conversationRef = db.collection('guestPortalConversations').doc(conversationId);
    const conversationDoc = await conversationRef.get();
    if (!conversationDoc.exists) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const conversationData = conversationDoc.data() as GuestPortalConversation;
    if (conversationData.propertyId !== propertyId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const now = Timestamp.now();
    const update = stripUndefined({ isActive: false, deletedAt: now as any, updatedAt: now as any });
    await conversationRef.update(update);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
}