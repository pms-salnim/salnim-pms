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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';

const communicationSubtabs = [
  { id: 'guests-profiles', label: 'Guests Profiles', href: '/property-settings/communication/guests-profiles' },
  { id: 'communication-channels', label: 'Communication Channels', href: '/property-settings/communication/communication-channels' },
  { id: 'email-templates', label: 'Email Templates', href: '/property-settings/communication/email-templates' },
  { id: 'guest-portal', label: 'Guest Portal', href: '/property-settings/communication/guest-portal' },
  { id: 'notifications', label: 'Notifications', href: '/property-settings/communication/notifications' },
];

interface EmailMailboxConfig {
  id: string;
  enabled: boolean;
  department: string; // e.g., "Auto-replies", "Support", "Sales"
  // SMTP (outgoing)
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromName?: string;
  // IMAP (incoming)
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  imapPass?: string;
  imapUseTls?: boolean;
  lastSyncTime?: string;
}

interface WhatsAppConfig {
  enabled: boolean;
  phoneNumberId?: string;
  businessAccountId?: string;
  accessToken?: string;
  webhookVerifyToken?: string;
  appSecret?: string;
  verificationStatus?: 'pending' | 'verified' | 'failed';
}

interface CommunicationChannelSettings {
  emailConfigurations?: EmailMailboxConfig[];
  whatsappIntegration?: WhatsAppConfig;
}

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

const createDefaultEmailConfig = (): EmailMailboxConfig => ({
  id: `email-${Date.now()}`,
  enabled: false,
  department: '',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  fromName: '',
  imapHost: '',
  imapPort: 993,
  imapUser: '',
  imapPass: '',
  imapUseTls: true,
});

export default function CommunicationChannelsPage() {
  const { property } = useAuth();
  const [settings, setSettings] = useState<CommunicationChannelSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [savingIntegration, setSavingIntegration] = useState<string | null>(null);
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({});
  const [expandedEmailConfigs, setExpandedEmailConfigs] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeletingConfig, setIsDeletingConfig] = useState(false);

  const toggleEmailConfigExpanded = (id: string) => {
    const newExpanded = new Set(expandedEmailConfigs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedEmailConfigs(newExpanded);
  };

  useEffect(() => {
    if (property?.id) {
      loadSettings(property.id);
    }
  }, [property?.id]);

  const loadSettings = async (propertyId: string) => {
    try {
      const propertyDocRef = doc(db, 'properties', propertyId);
      const propertyDoc = await getDoc(propertyDocRef);

      if (propertyDoc.exists() && propertyDoc.data()?.communicationChannelSettings) {
        const loadedSettings = propertyDoc.data().communicationChannelSettings;
        const mergedSettings: CommunicationChannelSettings = {
          emailConfigurations: Array.isArray(loadedSettings.emailConfigurations)
            ? loadedSettings.emailConfigurations
            : [],
          whatsappIntegration: {
            ...defaultSettings.whatsappIntegration,
            ...loadedSettings.whatsappIntegration,
          },
        };
        setSettings(mergedSettings);
      } else {
        setSettings(defaultSettings);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({ title: 'Error', description: 'Could not load settings', variant: 'destructive' });
      setIsLoading(false);
    }
  };

  const addEmailConfiguration = () => {
    setSettings((prev) => ({
      ...prev,
      emailConfigurations: [
        ...(prev.emailConfigurations || []),
        createDefaultEmailConfig(),
      ],
    }));
  };

  const removeEmailConfiguration = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      emailConfigurations: (prev.emailConfigurations || []).filter(config => config.id !== id),
    }));
  };

  const handleDeleteEmailConfig = async () => {
    if (!pendingDeleteId || !property?.id) return;

    setIsDeletingConfig(true);
    try {
      // Remove from local state
      removeEmailConfiguration(pendingDeleteId);

      // Save to Firestore (revoke/remove the configuration)
      const updatedConfigs = (settings.emailConfigurations || []).filter(
        config => config.id !== pendingDeleteId
      );
      const propertyDocRef = doc(db, 'properties', property.id);
      await updateDoc(propertyDocRef, {
        'communicationChannelSettings.emailConfigurations': updatedConfigs,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Success',
        description: 'Email configuration has been deleted and revoked.',
      });
    } catch (error) {
      console.error('Error deleting email configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete email configuration',
        variant: 'destructive',
      });
    } finally {
      setPendingDeleteId(null);
      setIsDeletingConfig(false);
    }
  };

  const updateEmailConfiguration = (id: string, updates: Partial<EmailMailboxConfig>) => {
    setSettings((prev) => ({
      ...prev,
      emailConfigurations: (prev.emailConfigurations || []).map(config =>
        config.id === id ? { ...config, ...updates } : config
      ),
    }));
  };

  const handleSaveEmailConfig = async (id: string) => {
    if (!property?.id) return;

    const emailConfig = (settings.emailConfigurations || []).find(c => c.id === id);
    if (!emailConfig) return;

    const newErrors: string[] = [];
    if (!emailConfig.department?.trim()) newErrors.push(`Department name is required`);
    if (!emailConfig.smtpHost?.trim()) newErrors.push(`SMTP Host is required for ${emailConfig.department || 'email'}`);
    if (!emailConfig.smtpPort) newErrors.push(`SMTP Port is required for ${emailConfig.department || 'email'}`);
    if (!emailConfig.smtpUser?.trim()) newErrors.push(`SMTP User is required for ${emailConfig.department || 'email'}`);
    if (!emailConfig.smtpPass?.trim()) newErrors.push(`SMTP Password is required for ${emailConfig.department || 'email'}`);
    if (!emailConfig.fromName?.trim()) newErrors.push(`From Name is required for ${emailConfig.department || 'email'}`);

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors([]);
    setSavingIntegration(`email-${id}`);
    try {
      // Remove any old configurations with the same email address
      const deduplicatedConfigs = (settings.emailConfigurations || []).filter(
        config => config.id === id || config.smtpUser !== emailConfig.smtpUser
      );

      const propertyDocRef = doc(db, 'properties', property.id);
      await updateDoc(propertyDocRef, {
        'communicationChannelSettings.emailConfigurations': deduplicatedConfigs,
        updatedAt: serverTimestamp(),
      });
      
      // Update local state with deduplicated configs
      setSettings(prev => ({
        ...prev,
        emailConfigurations: deduplicatedConfigs,
      }));
      
      toast({ title: 'Success', description: `${emailConfig.department} email configuration saved` });
    } catch (error) {
      console.error('Error saving email settings:', error);
      toast({ title: 'Error', description: 'Failed to save email settings', variant: 'destructive' });
    } finally {
      setSavingIntegration(null);
    }
  };

  const handleTestEmailConfig = async (id: string) => {
    const emailConfig = (settings.emailConfigurations || []).find(c => c.id === id);
    if (!emailConfig) {
      setTestResults(prev => ({ ...prev, [`email-${id}`]: { success: false, message: 'Email configuration not found' } }));
      return;
    }

    setTestingIntegration(`email-${id}`);
    const testKey = `email-${id}`;
    
    try {
      const config = emailConfig;
      
      // Validate SMTP fields
      if (!config.smtpHost || !config.smtpPort || !config.smtpUser || !config.smtpPass) {
        setTestResults(prev => ({ ...prev, [testKey]: { success: false, message: 'All SMTP fields are required' } }));
        toast({ title: 'Missing Fields', description: 'Please fill all SMTP fields', variant: 'destructive' });
        return;
      }

      // Test SMTP connection
      toast({ title: 'Testing SMTP...', description: 'Connecting to SMTP server' });
      const functions = getFunctions(undefined, 'europe-west1');
      const verifySmtp = httpsCallable(functions, 'verifySmtp');
      
      const smtpResult: any = await verifySmtp({
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
      });

      let resultMessage = 'SMTP connection verified! ✓';
      let hasErrors = false;

      if (!smtpResult.data.success) {
        resultMessage = `SMTP failed: ${smtpResult.data.message || 'Unknown error'}`;
        hasErrors = true;
      }

      // Test IMAP if configured
      if (config.imapHost && config.imapPort && config.imapUser && config.imapPass) {
        toast({ title: 'Testing IMAP...', description: 'Connecting to IMAP server' });
        const verifyImap = httpsCallable(functions, 'verifyImap');
        
        const imapResult: any = await verifyImap({
          imapHost: config.imapHost,
          imapPort: config.imapPort,
          imapUser: config.imapUser,
          imapPass: config.imapPass,
          useTls: config.imapUseTls !== false,
        });

        if (imapResult.data.success) {
          resultMessage += ' | IMAP connection verified! ✓';
        } else {
          resultMessage += ` | IMAP failed: ${imapResult.data.message || 'Unknown error'}`;
          hasErrors = true;
        }
      }

      setTestResults(prev => ({ ...prev, [testKey]: { success: !hasErrors, message: resultMessage } }));
      
      if (!hasErrors) {
        toast({ 
          title: 'Success', 
          description: `${emailConfig.department} configuration test passed`,
          className: 'bg-green-50 border-green-200'
        });
      } else {
        toast({ 
          title: 'Test Completed with Errors', 
          description: resultMessage, 
          variant: 'destructive' 
        });
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to test email configuration';
      setTestResults(prev => ({ ...prev, [testKey]: { success: false, message: errorMessage } }));
      toast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setTestingIntegration(null);
    }
  };

  const handleSaveWhatsApp = async () => {
    if (!property?.id || !settings.whatsappIntegration?.enabled) return;

    const newErrors: string[] = [];
    if (!settings.whatsappIntegration.phoneNumberId?.trim()) newErrors.push('WhatsApp Phone Number ID is required');
    if (!settings.whatsappIntegration.accessToken?.trim()) newErrors.push('WhatsApp Access Token is required');

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors([]);
    setSavingIntegration('whatsapp');
    try {
      const propertyDocRef = doc(db, 'properties', property.id);
      await updateDoc(propertyDocRef, {
        'communicationChannelSettings.whatsappIntegration': settings.whatsappIntegration,
        updatedAt: serverTimestamp(),
      });
      toast({ title: 'Success', description: 'WhatsApp configuration saved' });
    } catch (error) {
      console.error('Error saving WhatsApp settings:', error);
      toast({ title: 'Error', description: 'Failed to save WhatsApp settings', variant: 'destructive' });
    } finally {
      setSavingIntegration(null);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!settings.whatsappIntegration?.enabled) {
      setTestResults(prev => ({ ...prev, whatsapp: { success: false, message: 'WhatsApp configuration is not enabled' } }));
      return;
    }

    setTestingIntegration('whatsapp');
    try {
      const config = settings.whatsappIntegration;
      if (!config.phoneNumberId || !config.accessToken) {
        setTestResults(prev => ({ ...prev, whatsapp: { success: false, message: 'Phone Number ID and Access Token are required' } }));
        return;
      }
      setTestResults(prev => ({ ...prev, whatsapp: { success: true, message: 'WhatsApp configuration is valid' } }));
      toast({ title: 'Success', description: 'WhatsApp configuration test passed' });
    } catch (error) {
      setTestResults(prev => ({ ...prev, whatsapp: { success: false, message: 'Failed to validate WhatsApp credentials' } }));
      toast({ title: 'Error', description: 'WhatsApp configuration test failed', variant: 'destructive' });
    } finally {
      setTestingIntegration(null);
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
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Guests & Communication</h1>
            <p className="text-sm text-muted-foreground mt-1">Configure email, IMAP, and WhatsApp communication channels</p>
          </div>
          <PropertySettingsSubtabs subtabs={communicationSubtabs} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="space-y-5">
          {/* Error Alert */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-800 mb-2">Validation Errors:</p>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Email Configurations */}
          <Card className="border-r border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Icons.Mail className="h-4 w-4" />
                    Email Addresses & Mailboxes
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">Configure multiple email addresses for different departments with SMTP and/or IMAP</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(settings.emailConfigurations || []).length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-4">No email configurations yet</p>
                  <Button onClick={addEmailConfiguration}>
                    Add Email Configuration
                  </Button>
                </div>
              ) : (
                <>
                  {/* Saved Email Configurations Table */}
                  {(settings.emailConfigurations || []).length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <Label className="text-base font-semibold mb-2 block">Saved Configurations</Label>
                      <div className=" border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-slate-200 bg-slate-50/30">
                              <TableHead className="border-r border-slate-200 text-sm font-medium h-8 px-2 py-2 w-8"></TableHead>
                              <TableHead className="border-r border-slate-200 text-sm font-medium h-8 px-3 py-2">Department/Purpose</TableHead>
                              <TableHead className="border-r border-slate-200 text-sm font-medium h-8 px-3 py-2">Email Address</TableHead>
                              <TableHead className="border-r border-slate-200 text-sm font-medium h-8 px-3 py-2">From Name</TableHead>
                              <TableHead className="border-r border-slate-200 text-sm font-medium h-8 px-3 py-2">Host</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(settings.emailConfigurations || []).map((config) => (
                              <React.Fragment key={config.id}>
                                <TableRow className="border-b border-slate-200 hover:bg-slate-50/50">
                                  <TableCell className="border-r border-slate-200 text-sm px-2 py-2 w-8">
                                    <button
                                      onClick={() => toggleEmailConfigExpanded(config.id)}
                                      className="hover:opacity-75 transition-opacity"
                                      type="button"
                                    >
                                      <Icons.DropdownArrow
                                        className={`h-4 w-4 transition-transform ${
                                          expandedEmailConfigs.has(config.id) ? 'rotate-180' : ''
                                        }`}
                                      />
                                    </button>
                                  </TableCell>
                                  <TableCell className="border-r border-slate-200 text-sm px-3 py-2 text-left">
                                    <span className="font-medium">{config.department || '—'}</span>
                                  </TableCell>
                                  <TableCell className="border-r border-slate-200 text-sm px-3 py-2 text-left">
                                    {config.smtpUser || '—'}
                                  </TableCell>
                                  <TableCell className="border-r border-slate-200 text-sm px-3 py-2 text-left">
                                    {config.fromName || '—'}
                                  </TableCell>
                                  <TableCell className="border-r border-slate-200 text-sm px-3 py-2 text-left">
                                    <div className="flex gap-1">
                                      {config.smtpHost && (
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-sm">SMTP</span>
                                      )}
                                      {config.imapHost && (
                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-sm">IMAP</span>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                                {expandedEmailConfigs.has(config.id) && (
                                  <TableRow className="bg-muted/20">
                                    <TableCell colSpan={5} className="px-3 py-3">
                                      <div className="space-y-3">
                                        {/* Department Name */}
                                        <div className="space-y-1">
                                          <Label className="text-base font-medium">Department/Purpose *</Label>
                                          <Input
                                            placeholder="e.g., Auto-replies, Support, Sales, Reservations"
                                            value={config.department || ''}
                                            onChange={(e) =>
                                              updateEmailConfiguration(config.id, { department: e.target.value })
                                            }
                                            className="h-8 text-sm"
                                          />
                                        </div>

                                        {/* SMTP Configuration */}
                                        <div className="border-t pt-3">
                                          <Label className="text-base font-semibold mb-2 block">SMTP (Outgoing Email)</Label>
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-3">
                                              <div className="space-y-1">
                                                <Label className="text-sm text-slate-500">SMTP Host *</Label>
                                                <Input
                                                  placeholder="smtp.gmail.com"
                                                  value={config.smtpHost || ''}
                                                  onChange={(e) =>
                                                    updateEmailConfiguration(config.id, { smtpHost: e.target.value })
                                                  }
                                                  className="h-8 text-sm"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-sm text-slate-500">SMTP Port *</Label>
                                                <Input
                                                  type="number"
                                                  placeholder="587"
                                                  value={config.smtpPort || ''}
                                                  onChange={(e) =>
                                                    updateEmailConfiguration(config.id, {
                                                      smtpPort: parseInt(e.target.value) || undefined,
                                                    })
                                                  }
                                                  className="h-8 text-sm"
                                                />
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                              <div className="space-y-1">
                                                <Label className="text-sm text-slate-500">SMTP User *</Label>
                                                <Input
                                                  type="email"
                                                  placeholder="email@gmail.com"
                                                  value={config.smtpUser || ''}
                                                  onChange={(e) =>
                                                    updateEmailConfiguration(config.id, { smtpUser: e.target.value })
                                                  }
                                                  className="h-8 text-sm"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-sm text-slate-500">SMTP Password *</Label>
                                                <Input
                                                  type="password"
                                                  placeholder="••••••••"
                                                  value={config.smtpPass || ''}
                                                  onChange={(e) =>
                                                    updateEmailConfiguration(config.id, { smtpPass: e.target.value })
                                                  }
                                                  className="h-8 text-sm"
                                                />
                                              </div>
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-sm text-slate-500">From Name *</Label>
                                              <Input
                                                placeholder="Property Name or Sender Name"
                                                value={config.fromName || ''}
                                                onChange={(e) =>
                                                  updateEmailConfiguration(config.id, { fromName: e.target.value })
                                                }
                                                className="h-8 text-sm"
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {/* IMAP Configuration */}
                                        <div className="border-t pt-3">
                                          <Label className="text-base font-semibold mb-2 block">IMAP (Incoming Email) - Optional</Label>
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-3">
                                              <div className="space-y-1">
                                                <Label className="text-sm text-slate-500">IMAP Host</Label>
                                                <Input
                                                  placeholder="imap.gmail.com"
                                                  value={config.imapHost || ''}
                                                  onChange={(e) =>
                                                    updateEmailConfiguration(config.id, { imapHost: e.target.value })
                                                  }
                                                  className="h-8 text-sm"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-sm text-slate-500">IMAP Port</Label>
                                                <Input
                                                  type="number"
                                                  placeholder="993"
                                                  value={config.imapPort || ''}
                                                  onChange={(e) =>
                                                    updateEmailConfiguration(config.id, {
                                                      imapPort: parseInt(e.target.value) || undefined,
                                                    })
                                                  }
                                                  className="h-8 text-sm"
                                                />
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                              <div className="space-y-1">
                                                <Label className="text-sm text-slate-500">IMAP User</Label>
                                                <Input
                                                  type="email"
                                                  placeholder="email@gmail.com"
                                                  value={config.imapUser || ''}
                                                  onChange={(e) =>
                                                    updateEmailConfiguration(config.id, { imapUser: e.target.value })
                                                  }
                                                  className="h-8 text-sm"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-sm text-slate-500">IMAP Password</Label>
                                                <Input
                                                  type="password"
                                                  placeholder="••••••••"
                                                  value={config.imapPass || ''}
                                                  onChange={(e) =>
                                                    updateEmailConfiguration(config.id, { imapPass: e.target.value })
                                                  }
                                                  className="h-8 text-sm"
                                                />
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-2 pt-1">
                                              <Switch
                                                checked={config.imapUseTls || false}
                                                onCheckedChange={(checked) =>
                                                  updateEmailConfiguration(config.id, { imapUseTls: checked })
                                                }
                                              />
                                              <Label className="text-xs text-slate-500 cursor-pointer">Use TLS Encryption</Label>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Test Result */}
                                        {testResults[`email-${config.id}`] && (
                                          <div
                                            className={`p-2 rounded text-xs border ${
                                              testResults[`email-${config.id}`]?.success
                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                : 'bg-red-50 text-red-700 border-red-200'
                                            }`}
                                          >
                                            {testResults[`email-${config.id}`]?.message}
                                          </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex gap-2 pt-2 border-t">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleTestEmailConfig(config.id)}
                                            disabled={testingIntegration === `email-${config.id}`}
                                            className="text-xs h-8"
                                          >
                                            {testingIntegration === `email-${config.id}`
                                              ? 'Testing Connection...'
                                              : 'Test Connection'}
                                          </Button>
                                          <Button
                                            size="sm"
                                            onClick={() => handleSaveEmailConfig(config.id)}
                                            disabled={savingIntegration === `email-${config.id}`}
                                            className="text-xs h-8"
                                          >
                                            {savingIntegration === `email-${config.id}`
                                              ? 'Saving...'
                                              : 'Save'}
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPendingDeleteId(config.id)}
                                            className="text-red-600 hover:text-red-700 text-xs h-8 ml-auto"
                                          >
                                            Delete
                                          </Button>
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  <Button onClick={addEmailConfiguration} variant="outline" size="sm" className="w-full h-8 text-xs">
                    Add Another Email
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* WhatsApp Integration */}
          <Card className="border-r border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Icons.MessageCircle className="h-4 w-4" />
                    WhatsApp Integration
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">Connect WhatsApp Business API for guest communication</CardDescription>
                </div>
                <Switch
                  checked={settings.whatsappIntegration?.enabled || false}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      whatsappIntegration: { ...prev.whatsappIntegration!, enabled: checked },
                    }))
                  }
                />
              </div>
            </CardHeader>
            {settings.whatsappIntegration?.enabled && (
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Phone Number ID *</Label>
                    <Input
                      placeholder="123456789012345"
                      value={settings.whatsappIntegration?.phoneNumberId || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          whatsappIntegration: { ...prev.whatsappIntegration!, phoneNumberId: e.target.value },
                        }))
                      }
                      className="h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Found in WhatsApp Business Manager</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Business Account ID</Label>
                    <Input
                      placeholder="123456789012345"
                      value={settings.whatsappIntegration?.businessAccountId || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          whatsappIntegration: { ...prev.whatsappIntegration!, businessAccountId: e.target.value },
                        }))
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Access Token *</Label>
                  <Input
                    type="password"
                    placeholder="Your permanent access token"
                    value={settings.whatsappIntegration?.accessToken || ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        whatsappIntegration: { ...prev.whatsappIntegration!, accessToken: e.target.value },
                      }))
                    }
                    className="h-8 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Generate from Meta Business Suite</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Webhook Verify Token</Label>
                  <Input
                    placeholder="Random string for verification"
                    value={settings.whatsappIntegration?.webhookVerifyToken || ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        whatsappIntegration: { ...prev.whatsappIntegration!, webhookVerifyToken: e.target.value },
                      }))
                    }
                    className="h-8 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Use when setting up webhooks in Meta</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">App Secret (Optional)</Label>
                  <Input
                    type="password"
                    placeholder="Your WhatsApp App Secret"
                    value={settings.whatsappIntegration?.appSecret || ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        whatsappIntegration: { ...prev.whatsappIntegration!, appSecret: e.target.value },
                      }))
                    }
                    className="h-8 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Meta for Developers → Your App → Settings → Basic
                  </p>
                </div>
                {testResults.whatsapp && (
                  <div
                    className={`p-2 rounded text-xs border ${
                      testResults.whatsapp.success
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {testResults.whatsapp.message}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestWhatsApp}
                    disabled={testingIntegration === 'whatsapp' || !settings.whatsappIntegration?.enabled}
                    className="text-xs h-8"
                  >
                    {testingIntegration === 'whatsapp' ? 'Testing Connection...' : 'Test Connection'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveWhatsApp}
                    disabled={savingIntegration === 'whatsapp' || !settings.whatsappIntegration?.enabled}
                    className="text-xs h-8"
                  >
                    {savingIntegration === 'whatsapp' ? 'Saving...' : 'Save'}
                  </Button>
                </div>

                <div className="border-t pt-3 mt-3">
                  <Label className="text-xs font-semibold mb-2 block">Webhook URL</Label>
                  <p className="text-xs text-muted-foreground mb-2">Configure this in your Meta Business Suite</p>
                  <div className="space-y-1">
                    <Label className="text-xs">Callback URL</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`https://europe-west1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'your-project'}.cloudfunctions.net/whatsappWebhook`}
                        className="font-mono text-xs h-8"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`https://europe-west1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'your-project'}.cloudfunctions.net/whatsappWebhook`);
                          toast({ title: 'Copied!', description: 'Webhook URL copied to clipboard' });
                        }}
                        className="text-xs h-8 px-2"
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add in WhatsApp Business Manager → Configuration → Webhooks
                    </p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Email Configuration</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this email configuration? This action will remove the configuration and revoke access. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex gap-3 justify-end">
                <AlertDialogCancel onClick={() => setPendingDeleteId(null)}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteEmailConfig}
                  disabled={isDeletingConfig}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDeletingConfig ? 'Deleting...' : 'Delete Configuration'}
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
