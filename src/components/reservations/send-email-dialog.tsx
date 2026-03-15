
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/icons";
import { toast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import type { Reservation } from '@/components/calendar/types';
import type { Property } from '@/types/property';
import type { EmailTemplateType } from '@/types/emailTemplate';
import { emailTemplateTypes } from '@/types/emailTemplate';
import { useTranslation } from 'react-i18next';

interface SendEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation;
  propertySettings: Property | null;
}

export default function SendEmailDialog({ isOpen, onClose, reservation, propertySettings }: SendEmailDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateType | null>(null);
  const [isSending, setIsSending] = useState(false);
  const { t } = useTranslation(['send-email-guest']);
  
  const handleSend = async () => {
    if (!selectedTemplate) {
        toast({ title: t('toasts.no_template_selected.title'), description: t('toasts.no_template_selected.description'), variant: "destructive" });
        return;
    }
    if (!reservation.guestEmail) {
        toast({ title: t('toasts.no_guest_email.title'), description: t('toasts.no_guest_email.description'), variant: "destructive" });
        return;
    }
    setIsSending(true);

    try {
        const functions = getFunctions(app, 'europe-west1');
        const sendTemplatedEmailToGuest = httpsCallable(functions, 'sendTemplatedEmailToGuest');

        await sendTemplatedEmailToGuest({
            reservationId: reservation.id,
            templateType: selectedTemplate,
        });
        
        const templateInfo = emailTemplateTypes.find(t => t.type === selectedTemplate);
        const templateName = templateInfo ? templateInfo.name : selectedTemplate;

        toast({ title: t('toasts.email_sent.title'), description: t('toasts.email_sent.description', { templateName, email: reservation.guestEmail }) });
        onClose();
    } catch (error: any) {
        console.error("Error sending email:", error);
        toast({ title: t('toasts.send_error.title'), description: error.message || t('toasts.send_error.description'), variant: "destructive" });
    } finally {
        setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{t('title', { guestName: reservation.guestName })}</DialogTitle>
                <DialogDescription>
                    {t('description', { email: reservation.guestEmail })}
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="space-y-1">
                    <Label htmlFor="email-template-select">{t('email_template_label')}</Label>
                    <Select onValueChange={(value) => setSelectedTemplate(value as EmailTemplateType)}>
                        <SelectTrigger id="email-template-select">
                            <SelectValue placeholder={t('select_template_placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            {emailTemplateTypes.map(template => (
                                <SelectItem key={template.type} value={template.type}>
                                    {template.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                    {t('template_info')}
                </p>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline">{t('buttons.cancel')}</Button></DialogClose>
                <Button onClick={handleSend} disabled={!selectedTemplate || isSending}>
                    {isSending && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                    {t('buttons.send')}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
