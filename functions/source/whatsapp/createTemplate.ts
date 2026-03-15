import { onRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import * as admin from 'firebase-admin';
import axios from 'axios';

export const createWhatsAppTemplate = onRequest({ 
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
      const { propertyId, template } = data;

      if (!propertyId || !template) {
        res.status(400).json({ success: false, message: 'Missing required fields' });
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

      if (!configDoc.exists) {
        res.status(400).json({ success: false, message: 'WhatsApp not configured' });
        return;
      }

      const config = configDoc.data();
      if (!config?.businessAccountId || !config?.accessToken) {
        res.status(400).json({ success: false, message: 'Missing WhatsApp credentials' });
        return;
      }

      // Create template via WhatsApp API
      const templateData = {
        name: template.name,
        language: template.language,
        category: template.category,
        components: [
          {
            type: 'BODY',
            text: template.body,
          },
        ],
      };

      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${config.businessAccountId}/message_templates`,
        templateData,
        {
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Save template to Firestore
      const templateRef = admin.firestore()
        .collection('properties')
        .doc(propertyId)
        .collection('whatsappTemplates')
        .doc(template.name);

      await templateRef.set({
        ...templateData,
        status: 'PENDING',
        templateId: response.data.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({
        success: true,
        message: 'Template created and submitted for approval',
        templateId: response.data.id,
      });
    } catch (error: any) {
      console.error('Template creation error:', error);
      res.status(500).json({
        success: false,
        message: error.response?.data?.error?.message || error.message,
      });
    }
  });
