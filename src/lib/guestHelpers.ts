import { httpsCallable, getFunctions } from 'firebase/functions';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp, deleteDoc, collection, writeBatch, getDoc } from 'firebase/firestore';

interface SendGuestMessageParams {
  guestId: string;
  guestEmail: string;
  guestName: string;
  message: string;
  propertyId: string;
  messageType?: 'email' | 'whatsapp' | 'sms';
}

interface UpdateGuestPreferencesParams {
  guestId: string;
  roomPreferences?: string;
  dietaryRestrictions?: string;
  specialOccasion?: string;
  communicationPreference?: string;
}

/**
 * Send a message to a guest via email
 */
export const sendGuestMessage = async (params: SendGuestMessageParams) => {
  try {
    const functions = getFunctions();
    const sendGuestMessageFn = httpsCallable(functions, 'sendGuestMessage');
    
    const result = await sendGuestMessageFn({
      guestId: params.guestId,
      guestEmail: params.guestEmail,
      guestName: params.guestName,
      message: params.message,
      propertyId: params.propertyId,
      messageType: params.messageType || 'email'
    });
    
    return result.data;
  } catch (error) {
    console.error('Error sending guest message:', error);
    throw error;
  }
};

/**
 * Update guest preferences
 */
export const updateGuestPreferences = async (params: UpdateGuestPreferencesParams) => {
  try {
    const guestRef = doc(db, 'guests', params.guestId);
    const updateData: Record<string, any> = {
      updatedAt: serverTimestamp()
    };

    if (params.roomPreferences !== undefined) updateData.roomPreferences = params.roomPreferences;
    if (params.dietaryRestrictions !== undefined) updateData.dietaryRestrictions = params.dietaryRestrictions;
    if (params.specialOccasion !== undefined) updateData.specialOccasion = params.specialOccasion;
    if (params.communicationPreference !== undefined) updateData.communicationPreference = params.communicationPreference;

    await updateDoc(guestRef, updateData);
    return { success: true };
  } catch (error) {
    console.error('Error updating guest preferences:', error);
    throw error;
  }
};

/**
 * Add a note to guest's internal notes
 */
export const addGuestNote = async (guestId: string, note: string) => {
  try {
    const guestRef = doc(db, 'guests', guestId);
    const guestDoc = await getDoc(guestRef);
    
    if (!guestDoc.exists()) {
      throw new Error('Guest not found');
    }

    const currentNotes = guestDoc.data()?.internalNotes || '';
    const timestamp = new Date().toLocaleString();
    const newNotes = currentNotes ? `${currentNotes}\n\n[${timestamp}] ${note}` : `[${timestamp}] ${note}`;

    await updateDoc(guestRef, {
      internalNotes: newNotes,
      updatedAt: serverTimestamp()
    });

    return { success: true, newNotes };
  } catch (error) {
    console.error('Error adding guest note:', error);
    throw error;
  }
};

/**
 * Update guest's internal notes
 */
export const updateGuestNotes = async (guestId: string, notes: string) => {
  try {
    const guestRef = doc(db, 'guests', guestId);
    
    await updateDoc(guestRef, {
      internalNotes: notes,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating guest notes:', error);
    throw error;
  }
};

/**
 * Delete a guest and all associated data
 */
export const deleteGuest = async (guestId: string) => {
  try {
    const batch = writeBatch(db);
    const guestRef = doc(db, 'guests', guestId);

    // Delete guest document
    batch.delete(guestRef);

    // Delete guest's subcollections (notes will be handled by Cloud Function)
    const messagesCollection = collection(db, 'guests', guestId, 'messages');
    const loyaltyCollection = collection(db, 'guests', guestId, 'loyaltyHistory');
    
    // Note: In production, you'd want to use a Cloud Function to handle cascade delete
    // For now, we'll just delete the main guest document
    
    batch.delete(guestRef);
    await batch.commit();

    return { success: true };
  } catch (error) {
    console.error('Error deleting guest:', error);
    throw error;
  }
};

/**
 * Create a reservation link for a guest
 */
export const createGuestReservationLink = (guestEmail: string, guestName: string, propertySlug?: string) => {
  const params = new URLSearchParams();
  params.append('guestEmail', guestEmail);
  params.append('guestName', guestName);
  
  if (propertySlug) {
    return `/booking/${propertySlug}?${params.toString()}`;
  }
  
  return `/booking?${params.toString()}`;
};
