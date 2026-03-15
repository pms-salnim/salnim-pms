import { onRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import axios from 'axios';
import { db } from '../firebase';

export const verifyWhatsAppConnection = onRequest({
    region: 'europe-west1',
    cors: true
}, async (req, res) => {
        if (req.method !== 'POST') {
            res.status(405).json({ success: false, message: 'Method not allowed' });
            return;
        }

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
            const propertyId = data?.propertyId;
            const phoneNumberId = data?.phoneNumberId;
            const accessToken = data?.accessToken;

            if (!propertyId) {
                res.status(400).json({ success: false, message: 'Property ID is required' });
                return;
            }

            // Verify user owns this property
            const userDoc = await db.collection('staff').doc(userId).get();
            if (!userDoc.exists || userDoc.data()?.propertyId !== propertyId) {
                res.status(403).json({ success: false, message: 'Access denied to this property' });
                return;
            }

            if (!phoneNumberId || !accessToken) {
                res.status(400).json({
                    success: false,
                    message: 'Phone Number ID and Access Token are required'
                });
                return;
            }

            // Verify by fetching phone number details from WhatsApp API
            const response = await axios.get(
                `https://graph.facebook.com/v18.0/${phoneNumberId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                }
            );

            if (response.data && response.data.id) {
                res.status(200).json({
                    success: true,
                    message: `Connected to WhatsApp number: ${response.data.display_phone_number || 'verified'}`,
                    data: {
                        phoneNumber: response.data.display_phone_number,
                        verifiedName: response.data.verified_name,
                        qualityRating: response.data.quality_rating,
                    },
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Unable to verify WhatsApp credentials',
                });
            }
        } catch (error: any) {
            console.error('WhatsApp verification error:', error);

            if (error.response?.data?.error) {
                res.status(error.response.status || 400).json({
                    success: false,
                    message: error.response.data.error.message || 'Invalid credentials',
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: error.message || 'Verification failed',
                });
            }
        }
});