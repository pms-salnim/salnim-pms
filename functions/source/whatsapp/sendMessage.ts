import { onRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import * as admin from 'firebase-admin';
import axios from 'axios';

export const sendWhatsAppMessage = onRequest({ 
    region: 'europe-west1',
    cors: true 
}, async (req, res) => {
    // Authentication check
    if (!req.headers.authorization?.startsWith('Bearer ')) {
        res.status(403).json({ success: false, message: 'Unauthorized - No token provided' });
        return;
    }

    try {
      // Verify Firebase Auth token
      const idToken = req.headers.authorization.split('Bearer ')[1];
      const decodedToken = await getAuth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      const { data } = req.body;
      const { propertyId, to, templateName, templateLanguage, parameters } = data;

      if (!propertyId || !to || !templateName) {
        res.status(400).json({ 
          success: false, 
          message: 'Missing required fields: propertyId, to, templateName' 
        });
        return;
      }

      // Verify user owns this property
      const userDoc = await admin.firestore().collection('staff').doc(userId).get();
      if (!userDoc.exists || userDoc.data()?.propertyId !== propertyId) {
        res.status(403).json({ success: false, message: 'Access denied to this property' });
        return;
      }

      // Get WhatsApp config
      const configDoc = await admin.firestore()
        .doc(`properties/${propertyId}/integrations/whatsapp`)
        .get();

      if (!configDoc.exists || !configDoc.data()?.enabled) {
        res.status(400).json({ 
          success: false, 
          message: 'WhatsApp integration not enabled' 
        });
        return;
      }

      const config = configDoc.data();
      if (!config?.phoneNumberId || !config?.accessToken) {
        res.status(400).json({ 
          success: false, 
          message: 'WhatsApp credentials not configured' 
        });
        return;
      }

      // Prepare WhatsApp message payload
      const messagePayload: any = {
        messaging_product: 'whatsapp',
        to: to.replace(/\+/g, ''), // Remove + from phone number
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: templateLanguage || 'en',
          },
        },
      };

      // Add parameters if provided
      if (parameters && parameters.length > 0) {
        messagePayload.template.components = [
          {
            type: 'body',
            parameters: parameters.map((param: string) => ({
              type: 'text',
              text: param,
            })),
          },
        ];
      }

      // Send via WhatsApp API
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
        messagePayload,
        {
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Log message in Firestore
      await admin.firestore()
        .collection('properties')
        .doc(propertyId)
        .collection('whatsappMessages')
        .add({
          to,
          templateName,
          parameters,
          messageId: response.data.messages?.[0]?.id,
          status: 'sent',
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      res.status(200).json({
        success: true,
        message: 'WhatsApp message sent',
        messageId: response.data.messages?.[0]?.id,
      });
    } catch (error: any) {
      console.error('WhatsApp send error:', error);
      
      res.status(500).json({
        success: false,
        message: error.response?.data?.error?.message || error.message,
        errorDetails: error.response?.data,
      });
    }
  });
