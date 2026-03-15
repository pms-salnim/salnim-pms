"use client";

import React, { useState, useEffect } from 'react';
import { 
  Star, 
  Send,
  Sparkles,
  CheckCircle2,
  Smile,
  Meh,
  Frown,
  Reply,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { GuestPortalData } from './types';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';

interface Review {
  id: string;
  propertyId: string;
  source: string;
  guestName: string;
  guestEmail?: string;
  reservationId?: string;
  reservationNumber?: string;
  ratings: {
    overall: number;
    cleanliness?: number;
    service?: number;
    amenities?: number;
  };
  reviewText: string;
  status: string;
  responses?: Array<{
    text: string;
    respondedBy: string;
    respondedAt: Date | Timestamp;
  }>;
  submittedAt: string | Date | Timestamp;
  createdAt: Date | Timestamp;
}

interface ReviewsTabProps {
  data: GuestPortalData;
  colors: {
    primary: string;
    secondary: string;
  };
  guestName: string;
  triggerToast: (msg: string) => void;
}

const ReviewsTab: React.FC<ReviewsTabProps> = ({ 
  data, 
  colors, 
  guestName,
  triggerToast,
}) => {
  const { property, reservation } = data;
  
  const [overallRating, setOverallRating] = useState<number>(0);
  const [cleanlinessRating, setCleanlinessRating] = useState<number>(0);
  const [serviceRating, setServiceRating] = useState<number>(0);
  const [amenitiesRating, setAmenitiesRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [existingReviews, setExistingReviews] = useState<Review[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState<boolean>(true);
  const [showReviewForm, setShowReviewForm] = useState<boolean>(false);

  // Fetch existing reviews for this reservation
  useEffect(() => {
    if (!property?.id || !reservation?.id) {
      setIsLoadingReviews(false);
      return;
    }

    const reviewsRef = collection(db, 'reviews');
    const q = query(
      reviewsRef,
      where('propertyId', '==', property.id),
      where('reservationId', '==', reservation.id)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const reviews = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Review));
        setExistingReviews(reviews);
        setIsLoadingReviews(false);
      },
      (error) => {
        console.error('Error fetching reviews:', error);
        setIsLoadingReviews(false);
      }
    );

    return () => unsubscribe();
  }, [property?.id, reservation?.id]);

  const handleSubmitReview = async () => {
    // Validation
    if (overallRating === 0) {
      triggerToast('Please provide an overall rating');
      return;
    }
    
    if (reviewText.trim().length < 10) {
      triggerToast('Please write at least 10 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      // Call Cloud Function to submit review
      const base = process.env.NEXT_PUBLIC_FUNCTIONS_BASE || 'https://europe-west1-protrack-hub.cloudfunctions.net';
      const url = `${base}/submitGuestReview`;
      
      const reviewData = {
        propertyId: property?.id,
        reservationId: reservation?.id,
        reservationNumber: reservation?.reservationNumber,
        guestName: guestName,
        guestEmail: reservation?.guestEmail,
        ratings: {
          overall: overallRating,
          cleanliness: cleanlinessRating,
          service: serviceRating,
          amenities: amenitiesRating,
        },
        reviewText: reviewText.trim(),
        submittedAt: new Date().toISOString(),
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSubmitted(true);
        triggerToast('Thank you for your review! 🌟');
        // Reset form after 2 seconds
        setTimeout(() => {
          setOverallRating(0);
          setCleanlinessRating(0);
          setServiceRating(0);
          setAmenitiesRating(0);
          setReviewText('');
          setSubmitted(false);
          setShowReviewForm(false); // Hide form after submission
        }, 2000);
      } else {
        triggerToast(result.error || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      triggerToast('Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const RatingStars = ({ 
    rating, 
    onRate, 
    label 
  }: { 
    rating: number; 
    onRate: (rating: number) => void; 
    label: string;
  }) => (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRate(star)}
            className="group relative"
            disabled={submitted}
          >
            <Star
              className={`w-8 h-8 transition-all duration-200 ${
                star <= rating
                  ? 'fill-amber-400 text-amber-400 scale-110'
                  : 'text-slate-300 group-hover:text-amber-300 group-hover:scale-110'
              }`}
            />
          </button>
        ))}
        <span className="ml-2 text-sm font-semibold text-slate-600">
          {rating > 0 ? `${rating}/5` : 'Not rated'}
        </span>
      </div>
    </div>
  );

  const getOverallMood = () => {
    if (overallRating >= 4) return { icon: Smile, color: 'text-emerald-500', label: 'Excellent!' };
    if (overallRating >= 3) return { icon: Meh, color: 'text-amber-500', label: 'Good' };
    if (overallRating >= 1) return { icon: Frown, color: 'text-rose-500', label: 'Needs improvement' };
    return null;
  };

  const mood = getOverallMood();

  const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-8 h-8'
    };
    
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClasses[size]} transition-all ${
              star <= rating
                ? 'fill-amber-400 text-amber-400'
                : 'text-slate-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const formatDate = (date: string | Date | Timestamp) => {
    try {
      const dateObj = date instanceof Timestamp ? date.toDate() : new Date(date);
      return format(dateObj, 'MMM dd, yyyy');
    } catch {
      return 'Unknown date';
    }
  };

  const formatDateTime = (date: string | Date | Timestamp) => {
    try {
      const dateObj = date instanceof Timestamp ? date.toDate() : new Date(date);
      return format(dateObj, 'MMM dd, yyyy \'at\' h:mm a');
    } catch {
      return 'Unknown date';
    }
  };

  return (
    <div className="relative min-h-screen pb-32">
      {/* Hero Section */}
      <div className="relative h-64 bg-gradient-to-br rounded-3xl from-slate-900 via-slate-800 to-slate-900 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        
        <div className="relative h-full max-w-screen-lg mx-auto px-6 flex flex-col justify-end pb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 w-fit mb-4">
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-xs font-semibold text-white">Share Your Experience</span>
          </div>
          
          <h1 className="text-4xl font-black text-white mb-2 drop-shadow-lg">
            Leave a Review
          </h1>
          <p className="text-lg text-white/90 drop-shadow-md">
            Your feedback helps us improve our service
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-lg mx-auto px-6 mt-8 relative z-10 space-y-6 pb-8">
        {/* Existing Reviews */}
        {existingReviews.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
                          <h2 className="text-2xl font-bold text-slate-900 drop-shadow-lg">Your Reviews</h2>
              {!showReviewForm && (
                <button
                  onClick={() => setShowReviewForm(true)}
                  className="px-6 py-3 rounded-xl bg-white/90 backdrop-blur-sm hover:bg-white text-slate-900 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                >
                  <Star className="w-5 h-5" />
                  Add Review
                </button>
              )}
            </div>
            {existingReviews.map((review) => (
              <div 
                key={review.id}
                className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-6 space-y-4"
              >
                {/* Review Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      {renderStars(review.ratings.overall, 'md')}
                      <span className="text-2xl font-bold text-slate-900">{review.ratings.overall}/5</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDateTime(review.submittedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {review.status === 'pending' && (
                      <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                        Pending Review
                      </span>
                    )}
                    {review.status === 'approved' && (
                      <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Approved
                      </span>
                    )}
                    {review.status === 'responded' && (
                      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1">
                        <Reply className="w-3 h-3" />
                        Responded
                      </span>
                    )}
                  </div>
                </div>

                {/* Detailed Ratings */}
                {(review.ratings.cleanliness || review.ratings.service || review.ratings.amenities) && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    {review.ratings.cleanliness && (
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-slate-600" />
                        <span className="text-slate-600">Cleanliness:</span>
                        <div className="flex items-center gap-1">
                          {renderStars(review.ratings.cleanliness, 'sm')}
                          <span className="font-semibold text-slate-900">{review.ratings.cleanliness}/5</span>
                        </div>
                      </div>
                    )}
                    {review.ratings.service && (
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-slate-600" />
                        <span className="text-slate-600">Service:</span>
                        <div className="flex items-center gap-1">
                          {renderStars(review.ratings.service, 'sm')}
                          <span className="font-semibold text-slate-900">{review.ratings.service}/5</span>
                        </div>
                      </div>
                    )}
                    {review.ratings.amenities && (
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-slate-600" />
                        <span className="text-slate-600">Amenities:</span>
                        <div className="flex items-center gap-1">
                          {renderStars(review.ratings.amenities, 'sm')}
                          <span className="font-semibold text-slate-900">{review.ratings.amenities}/5</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                {/* Review Text */}
                <div>
                  <p className="text-slate-700 leading-relaxed">{review.reviewText}</p>
                </div>

                {/* Staff Responses */}
                {review.responses && review.responses.length > 0 && (
                  <>
                    <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Reply className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-slate-900">Responses from {property?.name || 'Property'} ({review.responses.length})</span>
                      </div>
                      {review.responses.map((response, index) => (
                        <div key={index} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border-l-4 border-blue-500">
                          <p className="text-slate-700 leading-relaxed">{response.text}</p>
                          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDateTime(response.respondedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Review Form - Show when no reviews exist OR when "Add Review" is clicked */}
        {(existingReviews.length === 0 || showReviewForm) && (
          <>
            {showReviewForm && existingReviews.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-slate-900 drop-shadow-lg">Write a New Review</h2>
                <button
                  onClick={() => {
                    setShowReviewForm(false);
                    setOverallRating(0);
                    setCleanlinessRating(0);
                    setServiceRating(0);
                    setAmenitiesRating(0);
                    setReviewText('');
                  }}
                  className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white font-semibold transition-all"
                >
                  Cancel
                </button>
              </div>
            )}
            {submitted ? (
          // Success State
          <div className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-12">
            <div className="text-center space-y-6">
              <div className="inline-flex p-6 rounded-full bg-gradient-to-br from-emerald-100 to-cyan-100">
                <CheckCircle2 className="w-16 h-16 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-900 mb-2">
                  Thank You! 🌟
                </h2>
                <p className="text-lg text-slate-600">
                  Your review has been submitted successfully
                </p>
              </div>
              <div className="pt-4">
                <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold">
                  <Star className="w-5 h-5 fill-current" />
                  <span>Rating: {overallRating}/5</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Review Form
          <div className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 space-y-8">
            {/* Overall Rating */}
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold text-slate-900">How was your stay?</h2>
                <div className="flex items-center justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setOverallRating(star)}
                      className="group relative transform transition-all duration-200 hover:scale-110"
                    >
                      <Star
                        className={`w-12 h-12 transition-all duration-200 ${
                          star <= overallRating
                            ? 'fill-amber-400 text-amber-400 scale-110'
                            : 'text-slate-300 group-hover:text-amber-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {mood && (
                  <div className="flex items-center justify-center gap-2">
                    <mood.icon className={`w-6 h-6 ${mood.color}`} />
                    <span className={`text-lg font-semibold ${mood.color}`}>
                      {mood.label}
                    </span>
                  </div>
                )}
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

              {/* Detailed Ratings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <RatingStars
                  rating={cleanlinessRating}
                  onRate={setCleanlinessRating}
                  label="Cleanliness"
                />
                <RatingStars
                  rating={serviceRating}
                  onRate={setServiceRating}
                  label="Service"
                />
                <RatingStars
                  rating={amenitiesRating}
                  onRate={setAmenitiesRating}
                  label="Amenities"
                />
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

            {/* Review Text */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700">
                Tell us about your experience
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your thoughts about your stay..."
                rows={6}
                disabled={submitted}
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 transition-all resize-none text-slate-900 placeholder:text-slate-400 disabled:bg-slate-50 disabled:cursor-not-allowed"
              />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{reviewText.length} characters</span>
                <span className={reviewText.length < 10 ? 'text-rose-500 font-semibold' : 'text-emerald-500'}>
                  {reviewText.length < 10 ? `${10 - reviewText.length} more needed` : 'Good to go!'}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitReview}
              disabled={isSubmitting || overallRating === 0 || reviewText.trim().length < 10}
              className="w-full relative group overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-1 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
              <div className="relative bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-xl px-8 py-4 flex items-center justify-center gap-3">
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="text-lg font-bold text-white">Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 text-white" />
                    <span className="text-lg font-bold text-white">Submit Review</span>
                  </>
                )}
              </div>
            </button>

            {/* Info Note */}
            <p className="text-xs text-center text-slate-500">
              Your review will be shared with {property?.name || 'the property'} management team
            </p>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};

export default ReviewsTab;
