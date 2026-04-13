'use client';

import { useState, useEffect } from 'react';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { NotificationsForm } from '@/components/property-settings/notifications/notifications-form';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

const systemSubtabs = [
  { id: 'preferences', label: 'Preferences', href: '/property-settings/system/preferences' },
  { id: 'notifications', label: 'Notifications', href: '/property-settings/system/notifications' },
];

export default function SystemNotificationsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState(null);
  const { property } = useAuth();

  useEffect(() => {
    const loadNotifications = async () => {
      if (!property?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          console.error('Not authenticated');
          setIsLoading(false);
          return;
        }

        const response = await fetch(
          `/api/properties/system/notifications/update?propertyId=${property.id}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${sessionData.session.access_token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setNotifications(data.settings);
        }
      } catch (error) {
        console.error('Failed to load notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadNotifications();
  }, [property?.id]);

  const handleSaveNotifications = async (data: any) => {
    if (!property?.id) {
      throw new Error('Property not found');
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/properties/system/notifications/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        propertyId: property.id,
        settings: data,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
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
