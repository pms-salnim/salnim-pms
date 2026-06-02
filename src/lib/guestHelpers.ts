import { httpsCallable, getFunctions } from 'firebase/functions';
import { createClient } from '@/utils/supabase/client';

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
    const supabase = createClient();
    const updateData: Record<string, string> = {};

    if (params.roomPreferences !== undefined) updateData.room_preferences = params.roomPreferences;
    if (params.dietaryRestrictions !== undefined) updateData.dietary_restrictions = params.dietaryRestrictions;
    if (params.specialOccasion !== undefined) updateData.special_occasion = params.specialOccasion;
    if (params.communicationPreference !== undefined) updateData.communication_preference = params.communicationPreference;

    const { error } = await supabase
      .from('guests')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.guestId);

    if (error) throw error;
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
    const supabase = createClient();
    const { data: guestDoc, error: fetchError } = await supabase
      .from('guests')
      .select('notes')
      .eq('id', guestId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!guestDoc) {
      throw new Error('Guest not found');
    }

    const currentNotes = guestDoc.notes || '';
    const timestamp = new Date().toLocaleString();
    const newNotes = currentNotes ? `${currentNotes}\n\n[${timestamp}] ${note}` : `[${timestamp}] ${note}`;

    const { error } = await supabase
      .from('guests')
      .update({
        notes: newNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', guestId);

    if (error) throw error;

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
    const supabase = createClient();
    const { error } = await supabase
      .from('guests')
      .update({
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', guestId);

    if (error) throw error;

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
    const supabase = createClient();
    const { error } = await supabase
      .from('guests')
      .delete()
      .eq('id', guestId);

    if (error) throw error;

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
