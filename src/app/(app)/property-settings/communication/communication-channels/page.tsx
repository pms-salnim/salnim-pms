'use client';

import React, { useState, useEffect } from 'react';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SMTPConfigurationForm from '@/components/guests/communication/SMTPConfigurationForm';
import IMAPConfigurationForm from '@/components/guests/communication/IMAPConfigurationForm';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { toast } from '@/hooks/use-toast';
import { createClient as createSupabaseClient } from '@/utils/supabase/client';

type SmtpSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromName?: string;
};

type ImapSettings = {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  useTls: boolean;
};

type VerificationStatus = 'untested' | 'success' | 'failed';

type ChannelVerification = {
  status: VerificationStatus;
  lastVerifiedAt?: string;
  message?: string;
};

type CommunicationChannelSettings = {
  emailConfigurations: any[];
  smtpSettings?: SmtpSettings;
  imapSettings?: ImapSettings;
  smtpVerification?: ChannelVerification;
  imapVerification?: ChannelVerification;
  whatsappIntegration: {
    enabled: boolean;
    phoneNumberId: string;
    businessAccountId: string;
    accessToken: string;
    webhookVerifyToken: string;
    appSecret: string;
    verificationStatus: string;
  };
};

type StoredSecrets = {
  smtpPass?: string;
  imapPass?: string;
};

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

const HIDDEN_SECRET_MASK = '***';

export default function CommunicationChannelsPage() {
  const { user, isLoadingAuth } = useAuth();
  const [settings, setSettings] = useState<CommunicationChannelSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isTestingImap, setIsTestingImap] = useState(false);
  const [storedSecrets, setStoredSecrets] = useState<StoredSecrets>({});

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
        headers: await getAuthHeaders(),
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

      const smtpSettings = loadedSettings.smtpSettings || undefined;
      const imapSettings = loadedSettings.imapSettings || undefined;

      setStoredSecrets({
        smtpPass: smtpSettings?.smtpPass || undefined,
        imapPass: imapSettings?.imapPass || undefined,
      });

      const mergedSettings = {
        emailConfigurations: loadedSettings.emailConfigurations || [],
        smtpSettings: smtpSettings ? { ...smtpSettings, smtpPass: '' } : undefined,
        imapSettings: imapSettings ? { ...imapSettings, imapPass: '' } : undefined,
        smtpVerification: loadedSettings.smtpVerification || { status: 'untested' },
        imapVerification: loadedSettings.imapVerification || { status: 'untested' },
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
      setStoredSecrets({});
      setIsLoading(false);
    }
  };

  const resolveSmtpSettings = (smtpSettings: SmtpSettings): SmtpSettings => ({
    ...smtpSettings,
    smtpPass:
      smtpSettings.smtpPass && smtpSettings.smtpPass !== HIDDEN_SECRET_MASK
        ? smtpSettings.smtpPass
        : storedSecrets.smtpPass || '',
  });

  const resolveImapSettings = (imapSettings: ImapSettings): ImapSettings => ({
    ...imapSettings,
    imapPass:
      imapSettings.imapPass && imapSettings.imapPass !== HIDDEN_SECRET_MASK
        ? imapSettings.imapPass
        : storedSecrets.imapPass || '',
  });

  const buildSavePayloadSettings = () => ({
    emailConfigurations: settings.emailConfigurations,
    whatsappIntegration: settings.whatsappIntegration,
    smtpVerification: settings.smtpVerification,
    imapVerification: settings.imapVerification,
  });

  const formatVerificationDate = (value?: string) => {
    if (!value) return 'Never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Never';
    return date.toLocaleString();
  };

  const getVerificationClasses = (status?: VerificationStatus) => {
    if (status === 'success') return 'border-green-300 bg-green-50 text-green-800';
    if (status === 'failed') return 'border-red-300 bg-red-50 text-red-800';
    return 'border-muted bg-muted/20 text-muted-foreground';
  };

  const getAuthHeaders = async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const supabase = createSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  const handleSave = async () => {
    if (!user?.propertyId) {
      toast({ title: 'Error', description: 'Property ID not found', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const smtpSettings = settings.smtpSettings
        ? resolveSmtpSettings(settings.smtpSettings)
        : undefined;
      const imapSettings = settings.imapSettings
        ? resolveImapSettings(settings.imapSettings)
        : undefined;

      const response = await fetch('/api/property-settings/communication-channels', {
        method: 'POST',
        headers: await getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          action: 'saveChannels',
          settings: buildSavePayloadSettings(),
          smtpSettings,
          imapSettings,
          propertyId: user.propertyId,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) {
        console.error('API Error Response:', result);
        throw new Error(result?.details || result?.error || 'Failed to save settings');
      }

      setSettings((prev) => ({
        ...prev,
        smtpSettings: smtpSettings ? { ...smtpSettings, smtpPass: '' } : prev.smtpSettings,
        imapSettings: imapSettings ? { ...imapSettings, imapPass: '' } : prev.imapSettings,
      }));

      setStoredSecrets((prev) => ({
        smtpPass: smtpSettings?.smtpPass || prev.smtpPass,
        imapPass: imapSettings?.imapPass || prev.imapPass,
      }));

      toast({ title: 'Success', description: 'Communication channel settings saved successfully' });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async (payload: { smtpSettings?: SmtpSettings; imapSettings?: ImapSettings }) => {
    if (!user?.propertyId) {
      toast({ title: 'Error', description: 'Property ID not found', variant: 'destructive' });
      return;
    }

    const smtpSettingsToSave = payload.smtpSettings
      ? resolveSmtpSettings(payload.smtpSettings)
      : undefined;
    const imapSettingsToSave = payload.imapSettings
      ? resolveImapSettings(payload.imapSettings)
      : undefined;

    setIsSaving(true);
    try {
      const response = await fetch('/api/property-settings/communication-channels', {
        method: 'POST',
        headers: await getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          action: 'saveChannels',
          propertyId: user.propertyId,
          smtpSettings: smtpSettingsToSave,
          imapSettings: imapSettingsToSave,
          settings: buildSavePayloadSettings(),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || result?.details || 'Failed to save settings');
      }

      setSettings((prev) => ({
        ...prev,
        ...(smtpSettingsToSave ? { smtpSettings: { ...smtpSettingsToSave, smtpPass: '' } } : {}),
        ...(imapSettingsToSave ? { imapSettings: { ...imapSettingsToSave, imapPass: '' } } : {}),
      }));

      setStoredSecrets((prev) => ({
        smtpPass: smtpSettingsToSave?.smtpPass || prev.smtpPass,
        imapPass: imapSettingsToSave?.imapPass || prev.imapPass,
      }));

      toast({ title: 'Success', description: 'Communication channel settings saved successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSmtpConnection = async (smtpSettings: SmtpSettings) => {
    if (!user?.propertyId) {
      toast({ title: 'Error', description: 'Property ID not found', variant: 'destructive' });
      return;
    }

    const smtpSettingsToTest = resolveSmtpSettings(smtpSettings);

    if (!smtpSettingsToTest.smtpHost || !smtpSettingsToTest.smtpPort || !smtpSettingsToTest.smtpUser || !smtpSettingsToTest.smtpPass) {
      toast({ title: 'Missing Information', description: 'Please complete all SMTP fields before testing.', variant: 'destructive' });
      return;
    }

    const payload = {
      action: 'testSmtp',
      propertyId: user.propertyId,
      smtpSettings: smtpSettingsToTest,
    };

    setIsTestingSmtp(true);
    try {
      const headers = await getAuthHeaders();
      const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const response = await fetch('/api/property-settings/communication-channels', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || result?.details || 'SMTP connection test failed');
      }

      setSettings((prev) => ({
        ...prev,
        smtpVerification: {
          status: 'success',
          lastVerifiedAt: result?.verifiedAt || new Date().toISOString(),
          message: result?.message || 'SMTP connection verified successfully.',
        },
      }));

      toast({ title: 'SMTP Connected', description: result?.message || 'SMTP connection verified successfully.' });
    } catch (error: any) {
      setSettings((prev) => ({
        ...prev,
        smtpVerification: {
          status: 'failed',
          lastVerifiedAt: new Date().toISOString(),
          message: error.message || 'Could not verify SMTP connection.',
        },
      }));
      toast({ title: 'SMTP Test Failed', description: error.message || 'Could not verify SMTP connection.', variant: 'destructive' });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleTestImapConnection = async (imapSettings: ImapSettings) => {
    if (!user?.propertyId) {
      toast({ title: 'Error', description: 'Property ID not found', variant: 'destructive' });
      return;
    }

    const imapSettingsToTest = resolveImapSettings(imapSettings);

    if (!imapSettingsToTest.imapHost || !imapSettingsToTest.imapPort || !imapSettingsToTest.imapUser || !imapSettingsToTest.imapPass) {
      toast({ title: 'Missing Information', description: 'Please complete all IMAP fields before testing.', variant: 'destructive' });
      return;
    }

    const payload = {
      action: 'testImap',
      propertyId: user.propertyId,
      imapSettings: imapSettingsToTest,
    };

    setIsTestingImap(true);
    try {
      const headers = await getAuthHeaders();
      const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const response = await fetch('/api/property-settings/communication-channels', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || result?.details || 'IMAP connection test failed');
      }

      setSettings((prev) => ({
        ...prev,
        imapVerification: {
          status: 'success',
          lastVerifiedAt: result?.verifiedAt || new Date().toISOString(),
          message: result?.message || 'IMAP connection verified successfully.',
        },
      }));

      toast({ title: 'IMAP Connected', description: result?.message || 'IMAP connection verified successfully.' });
    } catch (error: any) {
      setSettings((prev) => ({
        ...prev,
        imapVerification: {
          status: 'failed',
          lastVerifiedAt: new Date().toISOString(),
          message: error.message || 'Could not verify IMAP connection.',
        },
      }));
      toast({ title: 'IMAP Test Failed', description: error.message || 'Could not verify IMAP connection.', variant: 'destructive' });
    } finally {
      setIsTestingImap(false);
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
          <SMTPConfigurationForm
            initialSettings={settings.smtpSettings}
            onSave={(smtpSettings: SmtpSettings) => handleSaveSettings({ smtpSettings })}
            onTestConnection={handleTestSmtpConnection}
            isSaving={isSaving}
            isLoading={false}
            isTesting={isTestingSmtp}
          />

          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className={`rounded-md border px-3 py-2 text-sm ${getVerificationClasses(settings.smtpVerification?.status)}`}>
                <p className="font-medium">SMTP verification: {settings.smtpVerification?.status || 'untested'}</p>
                <p className="text-xs">Last checked: {formatVerificationDate(settings.smtpVerification?.lastVerifiedAt)}</p>
                {settings.smtpVerification?.message && (
                  <p className="text-xs mt-1">{settings.smtpVerification.message}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Security note: once saved, SMTP password is hidden. Leave password empty to keep the existing value.
              </p>
            </CardContent>
          </Card>

          <IMAPConfigurationForm
            initialSettings={settings.imapSettings ? {
              host: settings.imapSettings.imapHost,
              port: settings.imapSettings.imapPort,
              user: settings.imapSettings.imapUser,
              pass: '',
              useTls: settings.imapSettings.useTls,
            } : undefined}
            onSave={(imapData: any) => handleSaveSettings({
              imapSettings: {
                imapHost: imapData.imapHost,
                imapPort: Number(imapData.imapPort),
                imapUser: imapData.imapUser,
                imapPass: imapData.imapPass,
                useTls: !!imapData.useTls,
              },
            })}
            onTestConnection={handleTestImapConnection}
            isSaving={isSaving}
            isLoading={false}
            isTesting={isTestingImap}
          />

          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className={`rounded-md border px-3 py-2 text-sm ${getVerificationClasses(settings.imapVerification?.status)}`}>
                <p className="font-medium">IMAP verification: {settings.imapVerification?.status || 'untested'}</p>
                <p className="text-xs">Last checked: {formatVerificationDate(settings.imapVerification?.lastVerifiedAt)}</p>
                {settings.imapVerification?.message && (
                  <p className="text-xs mt-1">{settings.imapVerification.message}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Security note: once saved, IMAP password is hidden. Leave password empty to keep the existing value.
              </p>
            </CardContent>
          </Card>

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
                (settings.emailConfigurations || []).map((config) => (
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
