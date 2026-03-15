
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from '@/contexts/auth-context';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { EmailTemplate, EmailTemplateType } from '@/types/emailTemplate';
import { emailTemplateTypes } from '@/types/emailTemplate';
import EmailTemplateEditor from '@/components/guests/email-template-editor';
import { Icons } from '@/components/icons';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import SMTPConfigurationForm from '@/components/guests/communication/SMTPConfigurationForm';
import IMAPConfigurationForm from '@/components/guests/communication/IMAPConfigurationForm';

export default function EmailTemplatesPage() {
  const { user, property, isLoadingAuth } = useAuth();
  const { t } = useTranslation('pages/settings/email-templates/content');
  const [templates, setTemplates] = useState<Record<EmailTemplateType, EmailTemplate | null>>({
    reservation_confirmation: null,
    booking_confirmation: null,
    reservation_modification: null,
    reservation_cancellation: null,
    payment_confirmation: null,
    bank_transfer_info: null,
    mail_order_info: null,
    invoice_email: null,
    internal_new_reservation: null,
    internal_cancellation_alert: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [editingTemplateType, setEditingTemplateType] = useState<EmailTemplateType | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isTestingImap, setIsTestingImap] = useState(false);

  useEffect(() => {
    if (!user?.propertyId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const templatesQuery = query(collection(db, "emailTemplates"), where("propertyId", "==", user.propertyId));
    const unsubscribe = onSnapshot(templatesQuery, (snapshot) => {
      const fetchedTemplates: Partial<Record<EmailTemplateType, EmailTemplate>> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Omit<EmailTemplate, 'id'>;
        fetchedTemplates[data.type] = { id: docSnap.id, ...data };
      });

      const allTemplatesState = emailTemplateTypes.reduce((acc, typeInfo) => {
        acc[typeInfo.type] = fetchedTemplates[typeInfo.type] || null;
        return acc;
      }, {} as any);
      
      setTemplates(allTemplatesState);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching email templates:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.propertyId]);

  const handleCustomize = (type: EmailTemplateType) => {
    const templateData = templates[type];
    const typeInfo = emailTemplateTypes.find(t => t.type === type)!;

    setEditingTemplateType(type);
    setEditingTemplate(templateData || {
      id: `${type}_${user?.propertyId}`,
      propertyId: user?.propertyId || '',
      type: type,
      subject: typeInfo.defaultSubject,
      body: typeInfo.defaultBody,
      status: 'draft',
    });
    setIsEditorOpen(true);
  };

  const handleSave = async (templateData: Omit<EmailTemplate, 'id' | 'propertyId' | 'lastEditedBy' | 'lastEditedAt'>) => {
    if (!user?.propertyId || !editingTemplateType) return;

    const docRef = doc(db, "emailTemplates", `${editingTemplateType}_${user.propertyId}`);
    const dataToSave = {
      ...templateData,
      propertyId: user.propertyId,
      type: editingTemplateType,
      lastEditedAt: serverTimestamp(),
      lastEditedBy: user.name || user.email,
    };
    
    await setDoc(docRef, dataToSave, { merge: true });
    const templateInfo = emailTemplateTypes.find(t => t.type === editingTemplateType);
    const templateName = templateInfo ? templateInfo.name : editingTemplateType;
    toast({ title: t('toasts.success_save', { name: templateName, status: t(`status.${templateData.status}`) }) });
    if (templateData.status === 'live') {
        setIsEditorOpen(false);
    }
  };

    const handleTestSmtpConnection = async (settingsToTest: any) => {
    if (!settingsToTest.smtpHost || !settingsToTest.smtpPort || !settingsToTest.smtpUser || !settingsToTest.smtpPass) {
      toast({ title: 'Missing Information', description: t('toasts.smtp_missing_info'), variant: 'destructive' });
      return;
    }
    setIsTestingSmtp(true);
    toast({ title: t('toasts.smtp_testing_title'), description: t('toasts.smtp_testing_description') });
    try {
      const functions = getFunctions(app, 'europe-west1');
      const verifySmtp = httpsCallable(functions, 'verifySmtp');
      const result: any = await verifySmtp(settingsToTest);
      if (result.data.success) {
        toast({ title: t('toasts.smtp_success_title'), description: result.data.message, variant: 'default', className: 'bg-green-100 border-green-300 text-green-800' });
      } else {
         toast({ title: t('toasts.smtp_failed_title'), description: result.data.message || t('toasts.smtp_failed_description'), variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: t('toasts.smtp_failed_title'), description: error.message, variant: 'destructive' });
    } finally {
      setIsTestingSmtp(false);
    }
    };

    const handleTestImapConnection = async (settingsToTest: any) => {
    if (!settingsToTest.imapHost || !settingsToTest.imapPort || !settingsToTest.imapUser || !settingsToTest.imapPass) {
      toast({ title: 'Missing Information', description: t('toasts.imap_missing_info'), variant: 'destructive' });
      return;
    }
    setIsTestingImap(true);
    toast({ title: t('toasts.imap_testing_title'), description: t('toasts.imap_testing_description') });
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/verifyImap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settingsToTest)
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast({ title: t('toasts.imap_success_title'), description: result.message, variant: 'default', className: 'bg-green-100 border-green-300 text-green-800' });
      } else {
         toast({ title: t('toasts.imap_failed_title'), description: result.error || t('toasts.imap_failed_description'), variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: t('toasts.imap_failed_title'), description: error.message, variant: 'destructive' });
    } finally {
      setIsTestingImap(false);
    }
    };

    const handleSaveSettings = async (settingsData: { imapSettings?: any, smtpSettings?: any }) => {
    if (!user?.propertyId) {
      toast({ title: t('toasts.save_settings_error_title'), description: t('toasts.save_settings_error_description'), variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const functions = getFunctions(app, 'europe-west1');
    const saveSettingsFn = httpsCallable(functions, 'saveCommunicationSettings');
    try {
      const result: any = await saveSettingsFn(settingsData);
      if (result.data.success) {
        toast({ title: t('toasts.save_settings_success_title'), description: t('toasts.save_settings_success_description') });
      } else {
        throw new Error(result.data.message || t('toasts.save_settings_failed_description'));
      }
    } catch (error: any) {
      toast({ title: t('toasts.save_settings_error_title'), description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
    };

  if (isLoadingAuth || isLoading) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!user?.permissions?.settings) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('access_denied.title')}</AlertTitle>
        <AlertDescription>
          {t('access_denied.description')}
        </AlertDescription>
      </Alert>
    );
  }

  const getStatusBadgeClass = (status: EmailTemplate['status'] | undefined) => {
    switch (status) {
        case 'live':
            return 'bg-green-100 border-green-300 text-green-700';
        case 'disabled':
            return 'bg-red-100 border-red-300 text-red-700';
        default: // draft
            return 'bg-yellow-100 border-yellow-300 text-yellow-700';
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
            {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {emailTemplateTypes.map((templateInfo) => {
            const template = templates[templateInfo.type];
            return (
              <Card key={templateInfo.type} className="flex flex-col">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>{templateInfo.name}</CardTitle>
                    <Badge variant={'outline'} className={cn('capitalize', getStatusBadgeClass(template?.status))}>
                      {t(`status.${template?.status || 'draft'}`)}
                    </Badge>
                  </div>
                  <CardDescription>{templateInfo.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="bg-muted/50 p-3 rounded-md h-24 text-sm text-muted-foreground italic">
                     <p className="font-semibold line-clamp-1">Sub: {template?.subject || templateInfo.defaultSubject}</p>
                     <p className="line-clamp-2">{template?.body || templateInfo.defaultBody}</p>
                  </div>
                  {template?.lastEditedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                          {t('last_edited', { distance: formatDistanceToNow((template.lastEditedAt as any).toDate(), { addSuffix: true }), name: template.lastEditedBy })}
                      </p>
                  )}
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t pt-4">
                  <Button variant="outline" onClick={() => handleCustomize(templateInfo.type)}>
                    <Icons.Edit className="mr-2 h-4 w-4" /> {t('buttons.customize')}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{t('integrations.section_title', { defaultValue: 'Email Integration' })}</h2>
          <p className="text-muted-foreground">{t('integrations.section_description', { defaultValue: 'Configure SMTP sending and IMAP inbox fetching.' })}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SMTPConfigurationForm 
              initialSettings={property?.emailConfiguration}
              onSave={(smtpSettings: any) => handleSaveSettings({ smtpSettings })}
              isSaving={isSaving}
              isLoading={isLoadingAuth}
              onTestConnection={handleTestSmtpConnection}
              isTesting={isTestingSmtp}
            />
            <IMAPConfigurationForm 
              initialSettings={property?.imapConfiguration}
              onSave={(imapSettings: any) => handleSaveSettings({ imapSettings })}
              isSaving={isSaving}
              isLoading={isLoadingAuth}
              onTestConnection={handleTestImapConnection}
              isTesting={isTestingImap}
            />
          </div>
        </div>
      </div>
      
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>{t('editor.title', { templateName: emailTemplateTypes.find(t=>t.type === editingTemplateType)?.name || '' })}</DialogTitle>
                <DialogDescription>{t('editor.description')}</DialogDescription>
            </DialogHeader>
            {editingTemplate && (
                <EmailTemplateEditor
                    key={editingTemplate.id} // Re-mount component when template changes
                    initialData={editingTemplate}
                    onSave={handleSave}
                />
            )}
        </DialogContent>
      </Dialog>
    </>
  );
}
