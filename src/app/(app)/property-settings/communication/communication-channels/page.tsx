'use client';

import React, { useState, useEffect } from 'react';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { toast } from '@/hooks/use-toast';
import type { CommunicationChannelSettings } from '@/types/communication-channels';

const communicationSubtabs = [
  { id: 'guests-profiles', label: 'Guests Profiles', href: '/property-settings/communication/guests-profiles' },
  { id: 'communication-channels', label: 'Communication Channels', href: '/property-settings/communication/communication-channels' },
  { id: 'email-templates', label: 'Email Templates', href: '/property-settings/communication/email-templates' },
  { id: 'guest-portal', label: 'Guest Portal', href: '/property-settings/communication/guest-portal' },
  { id: 'notifications', label: 'Notifications', href: '/property-settings/communication/notifications' },
];

const defaultSettings: CommunicationChannelSettings = {
  emailConfigurations: [],
  whatsappIntegration: {
    enabled: false,
    phoneNumberId: '',
    businessAccountId: '',
    accessToken: '',
    webhookVerifyToken: '',
    appSecret: '',
    verificationStatus: 'pending',
  },
};

export default function CommunicationChannelsPage() {
  const { user, isLoadingAuth } = useAuth();
  const [settings, setSettings] = useState<CommunicationChannelSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth && user?.propertyId) {
      loadSettings();
    } else if (isLoadingAuth === false && !user?.propertyId) {
      setSettings(defaultSettings);
      setIsLoading(false);
    }
  }, [isLoadingAuth, user?.propertyId]);

  const loadSettings = async () => {
    try {
      if (!user?.propertyId) {
        setSettings(defaultSettings);
        setIsLoading(false);
        return;
      }

      const url = new URL('/api/property-settings/communication-channels', window.location.origin);
      url.searchParams.set('propertyId', user.propertyId);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        console.warn('Error loading settings:', response.statusText);
        setSettings(defaultSettings);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      const loadedSettings = data.settings || {};

      const mergedSettings = {
        emailConfigurations: loadedSettings.emailConfigurations || [],
        whatsappIntegration: {
          ...defaultSettings.whatsappIntegration,
          ...loadedSettings.whatsappIntegration,
        },
      };
      setSettings(mergedSettings);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      setSettings(defaultSettings);
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.propertyId) {
      toast({ title: 'Error', description: 'Property ID not found', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/property-settings/communication-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settings,
          propertyId: user.propertyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error Response:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to save settings');
      }

      toast({ title: 'Success', description: 'Communication channel settings saved successfully' });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Icons.Spinner className="h-8 w-8 animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Communication Channels</h1>
            <p className="text-sm text-muted-foreground mt-1">Configure email and WhatsApp channels for guest communication</p>
          </div>
          <PropertySettingsSubtabs subtabs={communicationSubtabs} />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="space-y-5 max-w-4xl">
          {/* Email Configurations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icons.Mail className="h-5 w-5" />
                Email Addresses
              </CardTitle>
              <CardDescription>Configure SMTP settings for outgoing emails</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(settings.emailConfigurations || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No email configurations yet. You can add them from here.</p>
              ) : (
                (settings.emailConfigurations || []).map((config, idx) => (
                  <div key={config.id} className="border rounded-lg p-3 bg-muted/30">
                    <p className="text-sm font-medium">{config.department || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground">{config.smtpUser}</p>
                  </div>
                ))
              )}
              <p className="text-xs text-muted-foreground italic">Email configuration details can be edited directly in this interface.</p>
            </CardContent>
          </Card>

          {/* WhatsApp Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Icons.MessageCircle className="h-5 w-5" />
                  WhatsApp Integration
                </span>
                <Switch
                  checked={settings.whatsappIntegration?.enabled || false}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      whatsappIntegration: {
                        ...settings.whatsappIntegration,
                        enabled: checked,
                      },
                    })
                  }
                />
              </CardTitle>
              <CardDescription>Connect WhatsApp Business API for guest messaging</CardDescription>
            </CardHeader>

            {settings.whatsappIntegration?.enabled && (
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs font-medium">Phone Number ID *</Label>
                  <Input
                    placeholder="123456789012345"
                    value={settings.whatsappIntegration?.phoneNumberId || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        whatsappIntegration: {
                          ...settings.whatsappIntegration,
                          phoneNumberId: e.target.value,
                        },
                      })
                    }
                    className="h-8 text-sm mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">From WhatsApp Business Manager</p>
                </div>

                <div>
                  <Label className="text-xs font-medium">Access Token *</Label>
                  <Input
                    type="password"
                    placeholder="Permanent access token..."
                    value={settings.whatsappIntegration?.accessToken || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        whatsappIntegration: {
                          ...settings.whatsappIntegration,
                          accessToken: e.target.value,
                        },
                      })
                    }
                    className="h-8 text-sm mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Your permanent access token from Meta</p>
                </div>

                <div>
                  <Label className="text-xs font-medium">Business Account ID (Optional)</Label>
                  <Input
                    placeholder="123456789012345"
                    value={settings.whatsappIntegration?.businessAccountId || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        whatsappIntegration: {
                          ...settings.whatsappIntegration,
                          businessAccountId: e.target.value,
                        },
                      })
                    }
                    className="h-8 text-sm mt-1"
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Save Button */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              {isSaving ? 'Saving...' : 'Save Communication Settings'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
