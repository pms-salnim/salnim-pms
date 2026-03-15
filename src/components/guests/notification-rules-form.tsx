
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Icons } from '../icons';
import type { NotificationSettings, NotificationSettingKey } from '@/types/property';
import { Separator } from '../ui/separator';
import { useTranslation } from 'react-i18next';

const notificationEventTypes: { key: NotificationSettingKey; labelKey: string; descriptionKey: string; }[] = [
  { key: 'new_reservation', labelKey: 'events.new_reservation.label', descriptionKey: 'events.new_reservation.description' },
  { key: 'payment_received', labelKey: 'events.payment_received.label', descriptionKey: 'events.payment_received.description' },
  { key: 'cancellation', labelKey: 'events.cancellation.label', descriptionKey: 'events.cancellation.description' },
  { key: 'new_message', labelKey: 'events.new_message.label', descriptionKey: 'events.new_message.description' },
];

export default function NotificationRulesForm() {
  const { property, refreshUserProfile } = useAuth();
  const { t } = useTranslation('pages/settings/notifications/content');
  const [settings, setSettings] = useState<NotificationSettings>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (property?.notificationSettings) {
      setSettings(property.notificationSettings);
    }
  }, [property]);

  const handleToggle = (key: NotificationSettingKey, channel: 'inApp' | 'email') => {
    setSettings(prev => {
      const currentRule = prev[key] || { enabled: false, channels: { inApp: false, email: false } };
      const updatedChannels = { ...currentRule.channels, [channel]: !currentRule.channels[channel] };
      const isEnabled = updatedChannels.inApp || updatedChannels.email;
      return {
        ...prev,
        [key]: {
          ...currentRule,
          enabled: isEnabled,
          channels: updatedChannels,
        }
      };
    });
  };

  const handleSave = async () => {
    if (!property) return;
    setIsLoading(true);
    try {
      const propRef = doc(db, 'properties', property.id);
      await updateDoc(propRef, {
        notificationSettings: settings
      });
      toast({ title: 'Success', description: t('toasts.success_save') });
      await refreshUserProfile();
    } catch (error) {
      console.error("Error updating notification settings:", error);
      toast({ title: 'Error', description: t('toasts.error_save'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Icons.Notification className="w-8 h-8 text-primary" />
          <div>
            <CardTitle>{t('form.title')}</CardTitle>
            <CardDescription>
              {t('form.description')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {notificationEventTypes.map((event, index) => {
          const rule = settings[event.key] || { enabled: false, channels: { inApp: false, email: false } };
          return (
            <React.Fragment key={event.key}>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h4 className="font-semibold">{t(event.labelKey)}</h4>
                  <p className="text-sm text-muted-foreground">{t(event.descriptionKey)}</p>
                </div>
                <div className="flex items-center gap-6 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`inApp-${event.key}`}
                      checked={rule.channels.inApp}
                      onCheckedChange={() => handleToggle(event.key, 'inApp')}
                    />
                    <Label htmlFor={`inApp-${event.key}`}>{t('channels.in_app')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`email-${event.key}`}
                      checked={rule.channels.email}
                      onCheckedChange={() => handleToggle(event.key, 'email')}
                    />
                    <Label htmlFor={`email-${event.key}`}>{t('channels.email')}</Label>
                  </div>
                </div>
              </div>
              {index < notificationEventTypes.length - 1 && <Separator />}
            </React.Fragment>
          );
        })}
      </CardContent>
      <CardFooter className="flex justify-end border-t pt-4">
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
          {t('buttons.save')}
        </Button>
      </CardFooter>
    </Card>
  );
}
