
"use client";

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/auth-context';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Icons } from '../icons';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO, isValid } from 'date-fns';
import type { Email } from '@/app/(app)/guests/communication/page';
import { Paperclip, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const replySchema = z.object({
  subject: z.string().min(1, "Subject is required."),
  body: z.string().min(1, "Message body cannot be empty."),
});

type ReplyFormValues = z.infer<typeof replySchema>;

interface ReplyEmailFormProps {
  originalEmail: Email;
  onClose: () => void;
}

const fileToDataUri = (file: File) => new Promise<{ filename: string; path: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        resolve({ filename: file.name, path: reader.result as string });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

export default function ReplyEmailForm({ originalEmail, onClose }: ReplyEmailFormProps) {
  const { user } = useAuth();
  const { t } = useTranslation('pages/guests/communication/content');
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

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


  const quotedBody = useMemo(() => {
    const dateString = originalEmail.date;
    let formattedDate = '—';
    
    try {
      const parsedDate = typeof originalEmail.date === 'string' ? parseISO(originalEmail.date) : new Date(originalEmail.date);
      if (isValid(parsedDate)) {
        formattedDate = format(parsedDate, 'PPp');
      }
    } catch (error) {
      console.warn('Invalid date in reply email:', originalEmail.date);
    }
    
    const originalDate = `On ${formattedDate}, ${originalEmail.from.name} <${originalEmail.from.email}> wrote:`;
    // A simple text-based quote. A full HTML quote is more complex.
    const originalContent = originalEmail.body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
    const quotedLines = originalContent.split('\n').map(line => `> ${line}`).join('\n');
    return `\n\n\n---\n${originalDate}\n${quotedLines}`;
  }, [originalEmail]);

  const onSubmit = async (data: ReplyFormValues) => {
    if (!user?.propertyId || !originalEmail.from.email) {
      toast({ title: "Error", description: "Cannot send reply. Missing required information.", variant: "destructive" });
      return;
    }
    setIsSending(true);

    const fullBody = `${data.body}${quotedBody}`;

    try {
      const attachmentPayloads = await Promise.all(attachments.map(fileToDataUri));
      const functions = getFunctions(app, 'europe-west1');
      const sendReplyByEmail = httpsCallable(functions, 'sendReplyByEmail');
      await sendReplyByEmail({
        propertyId: user.propertyId,
        to: originalEmail.from.email,
        subject: data.subject,
        htmlBody: fullBody.replace(/\n/g, '<br>'),
        attachments: attachmentPayloads,
      });

      toast({ title: "Success", description: "Your reply has been sent." });
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
          <span className="text-muted-foreground">{t('reply_form.replying_to_label')}</span> <span className="font-semibold">{originalEmail.from.email}</span>
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
