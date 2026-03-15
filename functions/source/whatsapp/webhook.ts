import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

export const whatsappWebhook = onRequest({ 
    region: 'europe-west1',
    cors: true 
}, async (req, res) => {
    // Handle webhook verification (GET request from WhatsApp)
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode && token) {
        // Verify the mode and token
        if (mode === 'subscribe') {
          // In production, you can verify token against stored value per property
          // For now, accept the verification
          console.log('Webhook verification request received');
          res.status(200).send(challenge);
          return;
        }
      }
      
      res.status(403).send('Forbidden');
      return;
    }

    // Handle incoming messages (POST request from WhatsApp)
    if (req.method === 'POST') {
      try {
        // First, extract phone number ID to identify which property this webhook is for
        const phoneNumberId = req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
        
        // Verify webhook signature if property has appSecret configured
        if (phoneNumberId) {
          const signature = req.headers['x-hub-signature-256'] as string;
          
          try {
            // Find property by phone number ID to get their specific App Secret
            const propertiesSnapshot = await admin.firestore()
              .collection('properties')
              .where('whatsappConfiguration.phoneNumberId', '==', phoneNumberId)
              .limit(1)
              .get();
            
            if (!propertiesSnapshot.empty) {
              const propertyData = propertiesSnapshot.docs[0].data();
              const appSecret = propertyData.whatsappConfiguration?.appSecret;
              
              // Verify signature if App Secret is configured for this property
              if (signature && appSecret) {
                const expectedSignature = crypto
                  .createHmac('sha256', appSecret)
                  .update(JSON.stringify(req.body))
                  .digest('hex');
                
                if (`sha256=${expectedSignature}` !== signature) {
                  console.warn(`Invalid webhook signature for phone number: ${phoneNumberId}`);
                  res.status(403).send('Invalid signature');
                  return;
                }
                console.log(`Webhook signature verified for phone number: ${phoneNumberId}`);
              } else if (signature && !appSecret) {
                console.warn(`Signature provided but no App Secret configured for property. Consider adding it for security.`);
              }
            } else {
              console.warn(`No property found for phone number: ${phoneNumberId}`);
            }
          } catch (verifyError) {
            console.error('Error verifying signature:', verifyError);
            // Continue processing even if signature verification fails
          }
        }
        
        const { entry } = req.body;

        if (!entry || !Array.isArray(entry)) {
          res.status(400).send('Invalid payload');
          return;
        }

        // Process each entry
        for (const item of entry) {
          const changes = item.changes || [];
          
          for (const change of changes) {
            if (change.field === 'messages') {
              const value = change.value;
              const messages = value.messages || [];
              const statuses = value.statuses || [];

              // Process incoming messages
              for (const message of messages) {
                await processIncomingMessage(message, value);
              }

              // Process message statuses (delivered, read, etc.)
              for (const status of statuses) {
                await processMessageStatus(status);
              }
            }
          }
        }

        res.status(200).send('EVENT_RECEIVED');
      } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Internal Server Error');
      }
      return;
    }

    res.status(405).send('Method not allowed');
  });

async function processIncomingMessage(message: any, metadata: any) {
  try {
    const phoneNumberId = metadata.metadata?.phone_number_id;
    
    // Find property by phone number ID
    let propertiesSnapshot;
    try {
      propertiesSnapshot = await admin.firestore()
        .collection('properties')
        .where('whatsappConfiguration.phoneNumberId', '==', phoneNumberId)
        .limit(1)
        .get();
    } catch (queryError) {
      console.error('Error querying properties:', queryError);
      console.warn('Unable to find property for phoneNumberId:', phoneNumberId);
      return;
    }

    if (propertiesSnapshot.empty) {
      console.warn('No property found for phone number:', phoneNumberId);
      return;
    }

    const propertyDoc = propertiesSnapshot.docs[0];
    const propertyId = propertyDoc.id;

    // Extract message data
    const messageData = {
      messageId: message.id,
      from: message.from,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
      type: message.type,
      text: message.text?.body || '',
      mediaUrl: message.image?.link || message.video?.link || message.document?.link || null,
      caption: message.image?.caption || message.video?.caption || null,
      status: 'received',
      direction: 'incoming',
      propertyId,
    };

    // Save to Firestore
    await admin.firestore()
      .collection('properties')
      .doc(propertyId)
      .collection('whatsappMessages')
      .doc(message.id)
      .set({
        ...messageData,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Try to link to existing guest/reservation
    await linkMessageToGuest(propertyId, message.from, message.id);

    console.log('Incoming message processed:', message.id);
  } catch (error) {
    console.error('Error processing incoming message:', error);
  }
}

async function processMessageStatus(status: any) {
  try {
    const messageId = status.id;
    const newStatus = status.status; // sent, delivered, read, failed

    // Update message status in all properties
    const messagesSnapshot = await admin.firestore()
      .collectionGroup('whatsappMessages')
      .where('messageId', '==', messageId)
      .limit(1)
      .get();

    if (!messagesSnapshot.empty) {
      const messageDoc = messagesSnapshot.docs[0];
      await messageDoc.ref.update({
        status: newStatus,
        lastStatusUpdate: admin.firestore.FieldValue.serverTimestamp(),
        statusTimestamp: new Date(parseInt(status.timestamp) * 1000),
      });

      console.log('Message status updated:', messageId, newStatus);
    }
  } catch (error) {
    console.error('Error processing message status:', error);
  }
}

async function linkMessageToGuest(propertyId: string, phoneNumber: string, messageId: string) {
  try {
    // Search for guest with this phone number
    const guestsSnapshot = await admin.firestore()
      .collection('guests')
      .where('propertyId', '==', propertyId)
      .where('phoneNumber', '==', phoneNumber)
      .limit(1)
      .get();

    if (!guestsSnapshot.empty) {
      const guestDoc = guestsSnapshot.docs[0];
      
      // Update message with guest link
      await admin.firestore()
        .collection('properties')
        .doc(propertyId)
        .collection('whatsappMessages')
        .doc(messageId)
        .update({
          guestId: guestDoc.id,
          guestName: guestDoc.data().fullName || guestDoc.data().name,
        });
    }
  } catch (error) {
    console.error('Error linking message to guest:', error);
  }
}
