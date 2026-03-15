"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icons } from '@/components/icons';
import { useAuth } from '@/contexts/auth-context';
import { db, app, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, deleteDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send, CheckCircle2, XCircle, AlertCircle, Trash2, Plus, BookOpen } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  webhookVerifyToken: string;
  appSecret?: string; // Optional: For webhook signature verification
  enabled: boolean;
  lastVerifiedAt?: any;
  verificationStatus?: 'pending' | 'verified' | 'failed';
}

interface MessageTemplate {
  id: string;
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  components: any[];
  createdAt: any;
  rejectionReason?: string;
}

export default function WhatsAppSettingsPage() {
  const { user, property, isLoadingAuth } = useAuth();
  const { t } = useTranslation('pages/settings/whatsapp/content');
  
  const [config, setConfig] = useState<WhatsAppConfig>({
    phoneNumberId: '',
    accessToken: '',
    businessAccountId: '',
    webhookVerifyToken: '',
    appSecret: '',
    enabled: false,
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  
  // Template form state
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    language: 'en',
    category: 'UTILITY' as const,
    body: '',
  });

  useEffect(() => {
    if (!user?.propertyId) return;

    const propertyRef = doc(db, 'properties', user.propertyId);
    const unsubConfig = onSnapshot(propertyRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.whatsappConfiguration) {
          setConfig({
            phoneNumberId: data.whatsappConfiguration.phoneNumberId || '',
            accessToken: data.whatsappConfiguration.accessToken || '',
            businessAccountId: data.whatsappConfiguration.accountId || '',
            webhookVerifyToken: data.whatsappConfiguration.webhookToken || '',
            appSecret: data.whatsappConfiguration.appSecret || '',
            enabled: data.whatsappConfiguration.enabled || false,
            lastVerifiedAt: data.whatsappConfiguration.lastVerifiedAt,
            verificationStatus: data.whatsappConfiguration.verificationStatus || 'pending',
          });
        }
      }
    });

    const templatesRef = collection(db, 'properties', user.propertyId, 'whatsappTemplates');
    const unsubTemplates = onSnapshot(templatesRef, (snapshot) => {
      const templatesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MessageTemplate[];
      setTemplates(templatesList);
    });

    return () => {
      unsubConfig();
      unsubTemplates();
    };
  }, [user?.propertyId]);

  const handleSave = async () => {
    if (!user?.propertyId) return;
    
    if (!config.phoneNumberId || !config.accessToken) {
      toast({ 
        title: 'Missing Information', 
        description: 'Phone Number ID and Access Token are required',
        variant: 'destructive' 
      });
      return;
    }

    setIsSaving(true);
    try {
      const propertyRef = doc(db, 'properties', user.propertyId);
      await setDoc(propertyRef, {
        whatsappConfiguration: {
          phoneNumberId: config.phoneNumberId,
          accessToken: config.accessToken,
          accountId: config.businessAccountId,
          webhookToken: config.webhookVerifyToken,
          appSecret: config.appSecret || '',
          enabled: config.enabled,
          lastVerifiedAt: new Date(),
          verificationStatus: config.verificationStatus || 'pending',
        }
      }, { merge: true });
      
      toast({ 
        title: 'Settings Saved', 
        description: 'WhatsApp configuration saved successfully',
      });
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.phoneNumberId || !config.accessToken) {
      toast({ 
        title: 'Missing Information', 
        description: 'Please save configuration first',
        variant: 'destructive' 
      });
      return;
    }

    setIsTesting(true);
    toast({ title: 'Testing Connection...', description: 'Verifying WhatsApp credentials' });
    
    try {
      // Get auth token from Firebase Auth
      if (!auth.currentUser) {
        throw new Error('Not authenticated');
      }
      const token = await auth.currentUser.getIdToken();
      
      const response = await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/verifyWhatsAppConnection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            propertyId: user!.propertyId,
            phoneNumberId: config.phoneNumberId,
            accessToken: config.accessToken,
          }
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Verification failed');
      }
      
      if (result.success) {
        const configRef = doc(db, 'properties', user!.propertyId, 'integrations', 'whatsapp');
        await setDoc(configRef, {
          ...config,
          verificationStatus: 'verified',
          lastVerifiedAt: new Date(),
        }, { merge: true });
        
        toast({ 
          title: 'Connection Successful', 
          description: result.message || 'WhatsApp API is connected',
          className: 'bg-green-100 border-green-300 text-green-800'
        });
      } else {
        throw new Error(result.message || 'Verification failed');
      }
    } catch (error: any) {
      toast({ 
        title: 'Connection Failed', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!user?.propertyId || !newTemplate.name || !newTemplate.body) {
      toast({ 
        title: 'Missing Information', 
        description: 'Template name and body are required',
        variant: 'destructive' 
      });
      return;
    }

    try {
      // Get auth token from Firebase Auth
      if (!auth.currentUser) {
        throw new Error('Not authenticated');
      }
      const token = await auth.currentUser.getIdToken();
      
      const response = await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/createWhatsAppTemplate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            propertyId: user.propertyId,
            template: newTemplate,
          }
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to create template');
      }
      
      if (result.success) {
        toast({ 
          title: 'Template Created', 
          description: 'Template submitted for approval. It may take 24-48 hours to be approved by WhatsApp.',
        });
        setIsTemplateDialogOpen(false);
        setNewTemplate({ name: '', language: 'en', category: 'UTILITY', body: '' });
      } else {
        throw new Error(result.message || 'Failed to create template');
      }
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!user?.propertyId) return;
    
    const confirmed = window.confirm('Are you sure you want to delete this template?');
    if (!confirmed) return;

    try {
      const templateRef = doc(db, 'properties', user.propertyId, 'whatsappTemplates', templateId);
      await deleteDoc(templateRef);
      toast({ title: 'Template Deleted', description: 'Message template removed' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoadingAuth) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user?.permissions?.settings) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to manage WhatsApp settings.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
            WhatsApp Business Integration
          </h1>
          <p className="text-muted-foreground">
            Connect your WhatsApp Business account to send booking confirmations, reminders, and communicate with guests.
          </p>
        </div>
        <Link href="/settings/whatsapp/guide">
          <Button variant="outline" size="sm" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Setup Guide
          </Button>
        </Link>
      </div>

      <Alert>
        <MessageSquare className="h-4 w-4 text-green-600" />
        <AlertTitle>WhatsApp Business API Required</AlertTitle>
        <AlertDescription>
          You need a WhatsApp Business API account (not the regular Business App). 
          Sign up at <a href="https://business.facebook.com/wa/manage/home/" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Meta Business Suite</a> or use a provider like Twilio, MessageBird, or 360dialog.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="configuration">
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="templates">Message Templates</TabsTrigger>
          <TabsTrigger value="usage">Usage & Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>API Credentials</CardTitle>
                  <CardDescription>Configure your WhatsApp Business API credentials</CardDescription>
                </div>
                {config.verificationStatus && (
                  <Badge variant={config.verificationStatus === 'verified' ? 'default' : 'destructive'} className="capitalize">
                    {config.verificationStatus === 'verified' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {config.verificationStatus === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
                    {config.verificationStatus}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
                  <Input
                    id="phoneNumberId"
                    placeholder="e.g., 123456789012345"
                    value={config.phoneNumberId}
                    onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Found in your WhatsApp Business Manager</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessAccountId">Business Account ID</Label>
                  <Input
                    id="businessAccountId"
                    placeholder="e.g., 123456789012345"
                    value={config.businessAccountId}
                    onChange={(e) => setConfig({ ...config, businessAccountId: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessToken">Access Token *</Label>
                <Input
                  id="accessToken"
                  type="password"
                  placeholder="Your permanent access token"
                  value={config.accessToken}
                  onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Generate a permanent token from Meta Business Suite</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhookToken">Webhook Verify Token</Label>
                <Input
                  id="webhookToken"
                  placeholder="Random string for webhook verification"
                  value={config.webhookVerifyToken}
                  onChange={(e) => setConfig({ ...config, webhookVerifyToken: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Use this token when setting up webhooks in Meta</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appSecret">App Secret (Optional)</Label>
                <Input
                  id="appSecret"
                  type="password"
                  placeholder="Your WhatsApp App Secret from Meta"
                  value={config.appSecret || ''}
                  onChange={(e) => setConfig({ ...config, appSecret: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Found in Meta for Developers → Your App → Settings → Basic. Recommended for production to verify webhook signatures.
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="enabled"
                  checked={config.enabled}
                  onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                />
                <Label htmlFor="enabled">Enable WhatsApp Integration</Label>
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={handleTestConnection} disabled={isTesting || isSaving}>
                {isTesting && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                Test Connection
              </Button>
              <Button onClick={handleSave} disabled={isSaving || isTesting}>
                {isSaving && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhook URL</CardTitle>
              <CardDescription>Configure this in your Meta Business Suite</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Callback URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`https://europe-west1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'your-project'}.cloudfunctions.net/whatsappWebhook`}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`https://europe-west1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'your-project'}.cloudfunctions.net/whatsappWebhook`);
                      toast({ title: 'Copied!', description: 'Webhook URL copied to clipboard' });
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add this URL in WhatsApp Business Manager → Configuration → Webhooks
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Message Templates</CardTitle>
                  <CardDescription>
                    WhatsApp requires pre-approved templates for sending notifications to guests
                  </CardDescription>
                </div>
                <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      New Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create Message Template</DialogTitle>
                      <DialogDescription>
                        Templates must be approved by WhatsApp before use. This usually takes 24-48 hours.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="templateName">Template Name</Label>
                        <Input
                          id="templateName"
                          placeholder="e.g., booking_confirmation"
                          value={newTemplate.name}
                          onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="language">Language</Label>
                          <Input
                            id="language"
                            placeholder="en"
                            value={newTemplate.language}
                            onChange={(e) => setNewTemplate({ ...newTemplate, language: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="category">Category</Label>
                          <select
                            id="category"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={newTemplate.category}
                            onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value as any })}
                          >
                            <option value="UTILITY">Utility (Transactional)</option>
                            <option value="MARKETING">Marketing</option>
                            <option value="AUTHENTICATION">Authentication</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="body">Message Body</Label>
                        <Textarea
                          id="body"
                          rows={6}
                          placeholder="Hello {{1}}, your booking at {{2}} is confirmed for {{3}}."
                          value={newTemplate.body}
                          onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Use {`{{1}}, {{2}}`} etc. for variables
                        </p>
                      </div>

                      <Button onClick={handleCreateTemplate} className="w-full">
                        Submit for Approval
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50" />
                  <p>No templates created yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {templates.map((template) => (
                    <div key={template.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">{template.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {template.language} • {template.category}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            template.status === 'APPROVED' ? 'default' :
                            template.status === 'REJECTED' ? 'destructive' : 'secondary'
                          }>
                            {template.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                      <div className="bg-muted/50 p-3 rounded text-sm">
                        {template.components?.[0]?.text || 'No body defined'}
                      </div>
                      {template.status === 'REJECTED' && template.rejectionReason && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertDescription>{template.rejectionReason}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>Usage Statistics</CardTitle>
              <CardDescription>Track your WhatsApp message usage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>Usage statistics will appear here once you start sending messages</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
