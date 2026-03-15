'use client';

import { useState, useEffect } from 'react';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { PreferencesForm } from '@/components/property-settings/preferences/preferences-form';

const systemSubtabs = [
  { id: 'preferences', label: 'Preferences', href: '/property-settings/system/preferences' },
  { id: 'notifications', label: 'Notifications', href: '/property-settings/system/notifications' },
];

export default function SystemPreferencesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [preferences, setPreferences] = useState(null);

  useEffect(() => {
    // TODO: Load preferences from Firestore
    // const loadPreferences = async () => {
    //   try {
    //     const prefs = await callFunction('loadPreferences', { propertyId });
    //     setPreferences(prefs);
    //   } catch (error) {
    //     console.error('Failed to load preferences:', error);
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };
    // loadPreferences();
    
    setIsLoading(false);
  }, []);

  const handleSavePreferences = async (data: any) => {
    // TODO: Save preferences to Firestore via Cloud Function
    // return callFunction('savePreferences', { propertyId, preferences: data });
    console.log('Saving preferences:', data);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900">System</h1>
        <PropertySettingsSubtabs subtabs={systemSubtabs} />
      </div>

      <div className="bg-white rounded-lg p-6 md:p-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-600">Loading preferences...</div>
          </div>
        ) : (
          <PreferencesForm
            initialData={preferences}
            onSave={handleSavePreferences}
            isLoading={isLoading}
          />
        )}
      </div>
    </>
  );
}
