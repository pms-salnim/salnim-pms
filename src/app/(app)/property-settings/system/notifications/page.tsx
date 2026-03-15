'use client';

import { useState, useEffect } from 'react';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { NotificationsForm } from '@/components/property-settings/notifications/notifications-form';

const systemSubtabs = [
  { id: 'preferences', label: 'Preferences', href: '/property-settings/system/preferences' },
  { id: 'notifications', label: 'Notifications', href: '/property-settings/system/notifications' },
];

export default function SystemNotificationsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState(null);

  useEffect(() => {
    // TODO: Load notifications from Firestore
    // const loadNotifications = async () => {
    //   try {
    //     const notifs = await callFunction('loadNotifications', { propertyId });
    //     setNotifications(notifs);
    //   } catch (error) {
    //     console.error('Failed to load notifications:', error);
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };
    // loadNotifications();
    
    setIsLoading(false);
  }, []);

  const handleSaveNotifications = async (data: any) => {
    // TODO: Save notifications to Firestore via Cloud Function
    // return callFunction('saveNotifications', { propertyId, notifications: data });
    console.log('Saving notifications:', data);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900">System</h1>
        <PropertySettingsSubtabs subtabs={systemSubtabs} />
      </div>

      <div className="bg-white rounded-lg p-6 md:p-8 mb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-600">Loading notification settings...</div>
          </div>
        ) : (
          <NotificationsForm
            initialData={notifications}
            onSave={handleSaveNotifications}
            isLoading={isLoading}
          />
        )}
      </div>
    </>
  );
}
