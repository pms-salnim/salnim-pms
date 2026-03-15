
"use client";

import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/auth-context';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Icons } from '../icons';
import { 
    Paperclip, 
    X, 
    Minimize2, 
    Maximize2, 
    Send, 
    Type, 
    Image as ImageIcon, 
    Smile,
    Trash2,
    ChevronDown,
    Link as LinkIcon,
    AlignLeft
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import EmojiPicker from './communication/EmojiPicker';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";


const emailSchema = z.object({
  to: z.string().email({ message: "Please enter a valid email address." }),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string().min(1, { message: "Subject cannot be empty." }).max(150, { message: "Subject is too long." }),
  body: z.string().min(1, { message: "Message body cannot be empty." }),
});

type EmailFormValues = z.infer<typeof emailSchema>;

interface ComposeEmailFormProps {
  onClose: () => void;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
}

const fileToDataUri = (file: File) => new Promise<{ filename: string; path: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        resolve({ filename: file.name, path: reader.result as string });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
});


export default function ComposeEmailForm({ onClose, initialTo, initialSubject, initialBody }: ComposeEmailFormProps) {
  const { user } = useAuth();
  const { t } = useTranslation('pages/guests/communication/content');
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);


  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      to: initialTo || '',
      cc: '',
      bcc: '',
      subject: initialSubject || '',
      body: initialBody || '',
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

  const onSubmit = async (data: EmailFormValues) => {
    if (!user?.propertyId) {
      toast({ title: "Error", description: "Property information is missing.", variant: "destructive" });
      return;
    }
    setIsSending(true);

    try {
      const attachmentPayloads = await Promise.all(attachments.map(fileToDataUri));
      const functions = getFunctions(app, 'europe-west1');
      const sendComposedEmail = httpsCallable(functions, 'sendComposedEmail');
      await sendComposedEmail({
        propertyId: user.propertyId,
        to: data.to,
        cc: data.cc,
        bcc: data.bcc,
        subject: data.subject,
        htmlBody: data.body.replace(/\n/g, '<br>'),
        attachments: attachmentPayloads,
      });

      toast({ 
        title: "Sent!", 
        description: "Your email has been sent successfully.",
        className: "bg-green-50 border-green-200 text-green-900"
      });
      onClose();
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({ title: "Sending Failed", description: error.message || "An unknown error occurred.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = bodyTextareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = form.getValues('body');
      const newValue = currentValue.slice(0, start) + emoji + currentValue.slice(end);
      form.setValue('body', newValue);
      
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    }
  };

  const handleImageInsert = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      // For now, add as attachment - could be enhanced to embed inline
      setAttachments(prev => [...prev, file]);
      toast({ 
        title: "Image added", 
        description: "Image added as attachment",
        className: "bg-green-50 border-green-200"
      });
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-0 right-6 w-80 bg-white border border-slate-300 rounded-t-lg shadow-2xl z-[100]">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 text-white rounded-t-lg cursor-pointer hover:bg-slate-700 transition-colors"
          onClick={() => setIsMinimized(false)}
        >
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            <span className="font-medium text-sm">New Message</span>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-white hover:bg-slate-600 hover:text-white"
              onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-white hover:bg-slate-600 hover:text-white"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 right-6 w-[650px] bg-white border border-slate-300 rounded-t-lg shadow-2xl z-[100] flex flex-col max-h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 text-white rounded-t-lg flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[15px]">New Message</span>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-white hover:bg-slate-700 hover:text-white"
            onClick={() => setIsMinimized(true)}
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-white hover:bg-slate-700 hover:text-white"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-3">
              {/* To Field */}
              <FormField
                control={form.control}
                name="to"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2 border-b pb-2">
                      <Label className="text-xs text-slate-500 w-12 flex-shrink-0">To</Label>
                      <FormControl>
                        <Input 
                          placeholder="recipients@example.com" 
                          className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                          {...field} 
                        />
                      </FormControl>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-slate-600 hover:text-slate-900"
                          onClick={() => setShowCc(!showCc)}
                        >
                          Cc
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-slate-600 hover:text-slate-900"
                          onClick={() => setShowBcc(!showBcc)}
                        >
                          Bcc
                        </Button>
                      </div>
                    </div>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              {/* Cc Field */}
              {showCc && (
                <FormField
                  control={form.control}
                  name="cc"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2 border-b pb-2">
                        <Label className="text-xs text-slate-500 w-12 flex-shrink-0">Cc</Label>
                        <FormControl>
                          <Input 
                            placeholder="cc@example.com" 
                            className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                            {...field} 
                          />
                        </FormControl>
                      </div>
                    </FormItem>
                  )}
                />
              )}

              {/* Bcc Field */}
              {showBcc && (
                <FormField
                  control={form.control}
                  name="bcc"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2 border-b pb-2">
                        <Label className="text-xs text-slate-500 w-12 flex-shrink-0">Bcc</Label>
                        <FormControl>
                          <Input 
                            placeholder="bcc@example.com" 
                            className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                            {...field} 
                          />
                        </FormControl>
                      </div>
                    </FormItem>
                  )}
                />
              )}

              {/* Subject Field */}
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2 border-b pb-2">
                      <FormControl>
                        <Input 
                          placeholder="Subject" 
                          className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-sm font-medium"
                          {...field} 
                        />
                      </FormControl>
                    </div>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              {/* Body Field */}
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        ref={bodyTextareaRef}
                        placeholder="Compose your message..."
                        className="min-h-[250px] border-0 p-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm leading-relaxed"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              {/* Attachments Display */}
              {attachments.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium text-slate-600">Attachments ({attachments.length})</p>
                  <div className="space-y-1.5">
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between text-sm bg-slate-50 px-3 py-2 rounded-md border border-slate-100">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Paperclip className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                          <span className="truncate text-xs">{file.name}</span>
                          <span className="text-[10px] text-slate-500 flex-shrink-0">
                            {formatFileSize(file.size)}
                          </span>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Toolbar */}
          <div className="border-t bg-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1">
              <Button 
                type="submit" 
                disabled={isSending}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSending && <Icons.Spinner className="h-3.5 w-3.5 animate-spin" />}
                {isSending ? 'Sending...' : 'Send'}
              </Button>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9"
                      onClick={() => document.getElementById('compose-file-upload')?.click()}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach files</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <input 
                id="compose-file-upload" 
                type="file" 
                multiple 
                className="hidden" 
                onChange={handleFileChange} 
              />

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9"
                      onClick={() => document.getElementById('compose-image-upload')?.click()}
                    >
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Insert image</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <input 
                id="compose-image-upload" 
                type="file" 
                accept="image/*"
                className="hidden" 
                onChange={handleImageInsert} 
              />

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <EmojiPicker onEmojiSelect={handleEmojiSelect}>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                          <Smile className="h-4 w-4" />
                        </Button>
                      </EmojiPicker>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Insert emoji</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Insert link</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Formatting options</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 hover:bg-red-50 hover:text-red-600"
              onClick={onClose}
              title="Discard"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
