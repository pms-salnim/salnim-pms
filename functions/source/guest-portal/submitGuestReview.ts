import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebase';
import { FieldValue } from 'firebase-admin/firestore';

const allowedOrigins = ['https://app.salnimpms.com', 'http://localhost:3000'];

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const submitGuestReview = onRequest(
  { 
    region: 'europe-west1',
    cors: allowedOrigins,
  },
  async (req, res) => {
    // Handle CORS preflight
    const origin = req.headers.origin || '';
    if (allowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
    }
    res.set(corsHeaders);

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ success: false, error: 'Method not allowed' });
      return;
    }

    try {
      const {
        propertyId,
        reservationId,
        reservationNumber,
        guestName,
        guestEmail,
        ratings,
        reviewText,
        submittedAt,
      } = req.body;

      // Validation
      if (!propertyId) {
        res.status(400).json({ success: false, error: 'Property ID is required' });
        return;
      }

      if (!ratings || !ratings.overall) {
        res.status(400).json({ success: false, error: 'Overall rating is required' });
        return;
      }

      if (!reviewText || reviewText.trim().length < 10) {
        res.status(400).json({ success: false, error: 'Review text must be at least 10 characters' });
        return;
      }

      // Validate rating values (1-5)
      const ratingValues = [ratings.overall, ratings.cleanliness, ratings.service, ratings.amenities];
      if (ratingValues.some(r => r && (r < 1 || r > 5))) {
        res.status(400).json({ success: false, error: 'Ratings must be between 1 and 5' });
        return;
      }

      // Rate limiting check
      const clientIp = req.headers['x-forwarded-for'] || req.ip || 'unknown';
      logger.info(`Review submission from IP: ${clientIp}`);

      // Verify property exists
      const propertyDoc = await db.collection('properties').doc(propertyId).get();
      if (!propertyDoc.exists) {
        res.status(404).json({ success: false, error: 'Property not found' });
        return;
      }

      // Create review document
      const reviewData = {
        propertyId,
        source: 'guest_portal', // Source of the review
        reservationId: reservationId || null,
        reservationNumber: reservationNumber || null,
        guestName: guestName || 'Anonymous',
        guestEmail: guestEmail || null,
        ratings: {
          overall: ratings.overall || 0,
          cleanliness: ratings.cleanliness || 0,
          service: ratings.service || 0,
          amenities: ratings.amenities || 0,
        },
        reviewText: reviewText.trim(),
        status: 'pending', // Can be 'pending', 'approved', 'rejected', 'responded'
        isPublic: false, // Will be set to true after staff approval
        submittedAt: submittedAt || new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Save review to Firestore
      const reviewRef = await db.collection('reviews').add(reviewData);

      logger.info(`Guest review submitted: ${reviewRef.id} for property ${propertyId}`);

      // Optionally: Send notification to property staff
      // This could be done via email or push notification
      // For now, we'll just log it

      res.status(200).json({ 
        success: true, 
        message: 'Review submitted successfully',
        reviewId: reviewRef.id,
      });

    } catch (error: any) {
      logger.error('Error submitting guest review:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to submit review',
        details: error.message,
      });
    }
  }
);
