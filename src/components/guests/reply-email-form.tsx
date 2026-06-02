
"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/auth-context';
import { emailApi } from '@/lib/communication-api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Icons } from '../icons';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const replySchema = z.object({
  subject: z.string().min(1, "Subject is required."),
  body: z.string().min(1, "Message body cannot be empty."),
});

type ReplyFormValues = z.infer<typeof replySchema>;

interface ReplyEmailFormProps {
  originalEmail: {
    id: string;
    from_name?: string;
    from_email?: string;
    from?: {
      name?: string;
      email?: string;
    };
    subject: string;
    body_text?: string;
    body_html?: string;
    bodyHtml?: string;
    date: string;
  };
  onClose: () => void;
  onSent?: (reply: any) => void;
}

type EncodedAttachment = {
  filename: string;
  contentType?: string;
  content: string;
};

export default function ReplyEmailForm({ originalEmail, onClose }: ReplyEmailFormProps) {
  const { user } = useAuth();
  const { t } = useTranslation('pages/guests/communication/content');
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const recipientEmail = String(originalEmail.from_email || originalEmail.from?.email || '').trim();
  const senderDisplayName = String(originalEmail.from_name || originalEmail.from?.name || recipientEmail || 'Unknown sender').trim();

  const form = useForm<ReplyFormValues>({
    resolver: zodResolver(replySchema),
    defaultValues: {
      subject: `Re: ${originalEmail.subject}`,
      body: '',
    },
  });
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        setAttachments(prev => [...prev, ...Array.from(event.target.files!)]);
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const encodeAttachments = async (files: File[]): Promise<EncodedAttachment[]> => {
    const encoded = await Promise.all(
      files.map(async (file) => {
        const buffer = await file.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const chunkSize = 0x8000;

        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          const chunk = bytes.subarray(offset, offset + chunkSize);
          binary += String.fromCharCode(...chunk);
        }

        return {
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          content: btoa(binary),
        };
      })
    );

    return encoded;
  };
  const onSubmit = async (data: ReplyFormValues) => {
    if (!user?.propertyId || !recipientEmail) {
      toast({ title: "Error", description: "Cannot send reply. Missing required information.", variant: "destructive" });
      return;
    }
    setIsSending(true);

    const fullBody = data.body;

    try {
      const encodedAttachments = await encodeAttachments(attachments);
      const response = await emailApi.sendReply(
        user.propertyId,
        originalEmail.id,
        recipientEmail,
        data.subject,
        fullBody.replace(/\n/g, '<br>'),
        fullBody,
        encodedAttachments
      );
      
      if (!response?.success) {
        throw new Error('Failed to send reply');
      }

      toast({ title: "Success", description: "Your reply has been sent." });
      if (typeof onSent === 'function') {
        onSent({
          subject: data.subject,
          body: data.body,
          date: new Date().toISOString(),
          from: { name: user?.fullName || '', email: user?.email || '' },
          to: recipientEmail,
          attachments: attachments.map(f => ({ filename: f.name, contentType: f.type, size: f.size })),
          isLocal: true,
        });
      }
      onClose();
    } catch (error: any) {
      console.error("Error sending reply:", error);
      toast({ title: "Sending Failed", description: error.message || "An unknown error occurred.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="text-sm">
          <span className="text-muted-foreground">{t('reply_form.replying_to_label')}</span> <span className="font-semibold">{recipientEmail || '—'}</span>
        </div>
        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <Label>{t('compose_form.subject_label')}</Label>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
                <Label>{t('compose_form.message_label')}</Label>
                <FormControl>
                    <Textarea
                      placeholder={t('compose_form.message_placeholder')}
                      className="min-h-[150px] resize-y"
                      {...field}
                    />
                </FormControl>
                <FormMessage />
            </FormItem>
          )}
        />
        <div>
            <Label htmlFor="attachments-reply">{t('compose_form.attachments_label')}</Label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                    <Paperclip className="mx-auto h-12 w-12 text-muted-foreground" />
                    <div className="flex text-sm text-muted-foreground">
                        <Label htmlFor="file-upload-reply" className="relative cursor-pointer rounded-md bg-background font-medium text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:text-primary">
                            <span>{t('compose_form.upload_files_button')}</span>
                            <Input id="file-upload-reply" name="file-upload-reply" type="file" multiple className="sr-only" onChange={handleFileChange} />
                        </Label>
                    </div>
                </div>
            </div>
            {attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                    {attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded-md">
                            <span className="truncate">{file.name}</span>
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAttachment(index)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>{t('reply_form.cancel_button')}</Button>
          <Button type="submit" disabled={isSending}>
            {isSending && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
            {t('reply_form.send_reply_button')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
