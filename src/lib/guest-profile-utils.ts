/**
 * Guest Profile Settings API Utilities
 * Helper functions for managing guest profile settings via API
 */

import type { GuestProfileSettings } from '@/types/guest-profile';

/**
 * Fetch guest profile settings for the current user's property
 */
export async function fetchGuestProfileSettings(): Promise<GuestProfileSettings | null> {
  try {
    const response = await fetch('/api/property-settings/guest-profiles', {
      method: 'GET',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch settings');
    }

    const data = await response.json();
    return data.settings || null;
  } catch (error) {
    console.error('Error fetching guest profile settings:', error);
    throw error;
  }
}

/**
 * Save guest profile settings for the current user's property
 */
export async function saveGuestProfileSettings(
  settings: GuestProfileSettings
): Promise<GuestProfileSettings> {
  try {
    // Remove undefined values
    const cleanedSettings = Object.fromEntries(
      Object.entries(settings).filter(([_, v]) => v !== undefined)
    );

    const response = await fetch('/api/property-settings/guest-profiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ settings: cleanedSettings }),
    });

    if (!response.ok) {
      throw new Error('Failed to save settings');
    }

    const data = await response.json();
    return data.data?.settings || cleanedSettings;
  } catch (error) {
    console.error('Error saving guest profile settings:', error);
    throw error;
  }
}
