"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { EmailTemplate, EmailTemplateType } from '@/types/emailTemplate';
import { emailTemplateTypes } from '@/types/emailTemplate';
import EmailTemplateEditor from '@/components/guests/email-template-editor';
import { Icons } from '@/components/icons';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';

export default function EmailTemplatesPage() {
  const { user, isLoadingAuth } = useAuth();
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
    toast({ title: "Success", description: `Template "${emailTemplateTypes.find(t=>t.type===editingTemplateType)?.name}" saved as ${templateData.status}.` });
    if (templateData.status === 'live') {
        setIsEditorOpen(false);
    }
  };

  if (isLoadingAuth || isLoading) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!user?.permissions?.settings) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to manage email templates. Please contact an administrator.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
            Email Templates
          </h1>
          <p className="text-muted-foreground">
            Customize and manage email templates sent to guests at each key stage of the reservation lifecycle.
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
                    <Badge variant={template?.status === 'live' ? 'default' : 'outline'} className={template?.status === 'live' ? 'bg-green-100 border-green-300 text-green-700' : ''}>
                      {template?.status || 'draft'}
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
                          Last edited {formatDistanceToNow((template.lastEditedAt as any).toDate(), { addSuffix: true })} by {template.lastEditedBy}
                      </p>
                  )}
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t pt-4">
                  <Button variant="outline" onClick={() => handleCustomize(templateInfo.type)}>
                    <Icons.Edit className="mr-2 h-4 w-4" /> Customize
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
      
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Customize: {emailTemplateTypes.find(t=>t.type === editingTemplateType)?.name}</DialogTitle>
                <DialogDescription>Modify the subject and body of the email. Use dynamic variables to personalize the content.</DialogDescription>
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
