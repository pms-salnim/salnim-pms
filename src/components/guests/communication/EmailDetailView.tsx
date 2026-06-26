"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, isValid } from 'date-fns';
import { ArrowLeft, Clock3, Download, FileText, Image as ImageIcon, Paperclip, Plus, Send, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import type { Email } from '@/contexts/auth-context';
import { emailApi, guestPortalApi, whatsappApi } from '@/lib/communication-api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { uploadFile } from '@/lib/uploadHelper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ChannelKey = 'all' | 'email' | 'whatsapp' | 'sms' | 'guest_portal';
type SendChannel = 'email' | 'whatsapp' | 'sms' | 'guest_portal';
type GuestContextPayload = {
  guest: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    country: string | null;
    city: string | null;
  };
  reservations?: Array<{
    id: string;
    reservationNumber?: string | null;
    status?: string;
    arrival?: string | null;
    departure?: string | null;
    room?: string | null;
    outstandingBalance?: number | null;
  }>;
};

type UnifiedMessage = {
  id: string;
  source: 'email' | 'whatsapp' | 'guest_portal' | 'sms';
  outgoing: boolean;
  date: string;
  timestampMs: number;
  senderName: string;
  senderEmail?: string;
  subject?: string;
  text: string;
  attachmentsCount?: number;
  attachments?: Array<{
    name: string;
    contentType?: string;
    size?: number;
    url?: string;
  }>;
};

type PropertyTemplate = {
  template_id?: string;
  name?: string;
  enabled?: boolean;
  subject?: string;
  html_content?: string;
  plain_text_content?: string;
};

type ComposerAttachment = {
  id: string;
  file: File;
  filename: string;
  contentType: string;
  fileSize: number;
};

type AttachmentViewerState = {
  name: string;
  url: string;
  contentType?: string;
};

const MAX_COMPOSER_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_COMPOSER_ATTACHMENTS_COUNT = 5;
const MAX_COMPOSER_ATTACHMENTS_TOTAL_SIZE = 30 * 1024 * 1024;

interface EmailDetailViewProps {
  email: Email & {
    from_name?: string;
    from_email?: string;
  };
  onBack: () => void;
  onReply: (email: Email) => void;
  onForward?: (email: Email) => void;
  onStar?: (email: Email) => void;
  onArchive?: (email: Email) => void;
  onDelete?: (email: Email) => void;
  onMarkUnread?: (email: Email) => void;
  onAddLabel?: (email: Email) => void;
  conversationHistory?: Email[];
  onChannelChange?: (channel: ChannelKey) => void;
  onRefreshEmails?: () => void;
  initialChannel?: ChannelKey;
  isNewConversation?: boolean;
  requireManualEmailSubject?: boolean;
  initialContactPhone?: string;
  onNewEmailSent?: (sentEmail: Email, options?: { isFirstMessage?: boolean }) => void;
}

const CHANNELS: Array<{ key: ChannelKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'sms', label: 'SMS' },
  { key: 'guest_portal', label: 'Guest Portal' },
];

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const normalizePhone = (value?: string | null) => String(value || '').replace(/[^\d+]/g, '');
const isSyntheticGuestPortalAddress = (value?: string | null): boolean => {
  const normalized = String(value || '').trim().toLowerCase();
  return /^guest-portal\+[^@]+@guest-portal\.local$/.test(normalized);
};

const normalizeMessageSource = (message: any): 'email' | 'whatsapp' | 'guest_portal' | 'sms' => {
  const source = String(message?.source || '').trim().toLowerCase();
  if (source === 'guest_portal') return 'guest_portal';
  if (source === 'whatsapp') return 'whatsapp';
  if (source === 'sms') return 'sms';
  return 'email';
};

const toTimestampMs = (value: unknown): number => {
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  const parsed = new Date(String(value || '')).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const sortUnifiedMessages = (messages: UnifiedMessage[]): UnifiedMessage[] => {
  return [...messages].sort((a, b) => {
    if (a.timestampMs !== b.timestampMs) return a.timestampMs - b.timestampMs;
    return String(a.id).localeCompare(String(b.id));
  });
};

const isSentMessage = (message: Email) => {
  const source = String((message as any).source || '').trim().toLowerCase();
  if (source === 'guest_portal') {
    const senderType = String((message as any).sourceSenderType || (message as any).source_sender_type || '').trim().toLowerCase();
    if (senderType) return senderType === 'property';
  }
  return !message.uid || Number(message.uid) <= 0;
};

const messageText = (message: Email) => {
  if (message.bodyText?.trim()) return message.bodyText.trim();
  if (message.body?.trim()) return message.body.trim();
  if (message.bodyHtml?.trim()) return stripHtml(message.bodyHtml);
  return '';
};

const formatFileSize = (size?: number) => {
  if (!size || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageType = (contentType?: string, name?: string) => {
  const value = String(contentType || '').toLowerCase();
  return value.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(String(name || ''));
};

const isPdfType = (contentType?: string, name?: string) => {
  const value = String(contentType || '').toLowerCase();
  return value === 'application/pdf' || /\.pdf$/i.test(String(name || ''));
};

const getAttachmentFormatLabel = (contentType?: string, name?: string) => {
  const fileName = String(name || '').trim();
  const extensionMatch = fileName.match(/\.([a-z0-9]{1,10})$/i);
  if (extensionMatch?.[1]) {
    return extensionMatch[1].toLowerCase();
  }

  const rawType = String(contentType || '').toLowerCase().split(';')[0].trim();
  if (!rawType) return '';

  const knownMimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
    'application/postscript': 'ai',
    'application/illustrator': 'ai',
  };

  if (knownMimeMap[rawType]) return knownMimeMap[rawType];

  const slashIndex = rawType.indexOf('/');
  if (slashIndex < 0) return '';

  let subtype = rawType.slice(slashIndex + 1).replace(/^x-/, '');
  if (subtype.includes('+')) {
    subtype = subtype.split('+')[0] || subtype;
  }
  if (subtype.startsWith('vnd.')) {
    const parts = subtype.split('.');
    subtype = parts[parts.length - 1] || subtype;
  }

  return subtype;
};

const getRenderableMessageText = (text: string | undefined, hasAttachments: boolean) => {
  const normalized = String(text || '').trim();
  if (!hasAttachments) return normalized;

  const withoutAttachmentPlaceholders = normalized
    .split('\n')
    .filter((line) => !/^attachment\s*:/i.test(line.trim()))
    .join('\n')
    .trim();

  return withoutAttachmentPlaceholders;
};

const renderCompactAttachmentPreview = (
  attachment: { name: string; contentType?: string; size?: number; url?: string },
  outgoing: boolean,
  onOpenAttachment: (attachment: { name: string; url: string; contentType?: string }) => void,
) => {
  const imageType = isImageType(attachment.contentType, attachment.name);
  const pdfType = isPdfType(attachment.contentType, attachment.name);
  const fileSizeLabel = formatFileSize(attachment.size);
  const formatLabel = getAttachmentFormatLabel(attachment.contentType, attachment.name);
  const cardClassName = cn(
    'overflow-hidden rounded-2xl border shadow-sm transition-transform',
    outgoing
      ? 'border-emerald-200 bg-emerald-900 text-white'
      : 'border-slate-200 bg-white text-slate-900'
  );

  return (
    <div className={cn(cardClassName, 'w-full overflow-hidden')}>
      {attachment.url ? (
        <button
          type="button"
          onClick={() => onOpenAttachment({ name: attachment.name, url: attachment.url!, contentType: attachment.contentType })}
          className="block w-full"
          aria-label={`Open ${attachment.name}`}
        >
          <div className={cn('relative flex h-40 items-center justify-center', imageType ? 'bg-black/5' : outgoing ? 'bg-emerald-800' : 'bg-slate-50')}>
            {imageType ? (
              <img src={attachment.url} alt={attachment.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 px-3 text-center">
                {pdfType ? (
                  <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl font-bold', outgoing ? 'bg-white/10 text-white' : 'bg-red-500 text-white')}>
                    PDF
                  </div>
                ) : (
                  <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl', outgoing ? 'bg-white/10' : 'bg-slate-200')}>
                    <FileText className={cn('h-7 w-7', outgoing ? 'text-white' : 'text-slate-500')} />
                  </div>
                )}
              </div>
            )}
          </div>
        </button>
      ) : (
        <div className={cn('relative flex h-40 items-center justify-center', imageType ? 'bg-black/5' : outgoing ? 'bg-emerald-800' : 'bg-slate-50')}>
          {imageType ? (
            <div className="flex flex-col items-center gap-1 px-3 text-center">
              <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl', outgoing ? 'bg-white/10' : 'bg-slate-200')}>
                <ImageIcon className={cn('h-7 w-7', outgoing ? 'text-white' : 'text-slate-500')} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 px-3 text-center">
              {pdfType ? (
                <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl font-bold', outgoing ? 'bg-white/10 text-white' : 'bg-red-500 text-white')}>
                  PDF
                </div>
              ) : (
                <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl', outgoing ? 'bg-white/10' : 'bg-slate-200')}>
                  <FileText className={cn('h-7 w-7', outgoing ? 'text-white' : 'text-slate-500')} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div className={cn('flex items-start gap-2 px-3 py-2.5', outgoing ? 'bg-emerald-950/40' : 'bg-white')}>
        <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', outgoing ? 'bg-white/10' : 'bg-slate-100')}>
          {imageType ? (
            <ImageIcon className={cn('h-4 w-4', outgoing ? 'text-white' : 'text-slate-500')} />
          ) : (
            <FileText className={cn('h-4 w-4', outgoing ? 'text-white' : 'text-slate-500')} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn('truncate text-sm font-semibold', outgoing ? 'text-white' : 'text-slate-900')}>
            {attachment.name}
          </div>
          <div className={cn('mt-0.5 truncate text-[11px]', outgoing ? 'text-emerald-100/80' : 'text-slate-500')}>
            {[fileSizeLabel, formatLabel].filter(Boolean).join(' • ') || 'file'}
          </div>
        </div>
        {attachment.url ? (
          <a
            href={attachment.url}
            download={attachment.name}
            className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', outgoing ? 'bg-white/10' : 'bg-slate-100')}
            aria-label={`Download ${attachment.name}`}
          >
            <Download className={cn('h-4 w-4', outgoing ? 'text-white' : 'text-slate-500')} />
          </a>
        ) : null}
      </div>
    </div>
  );
};

export default function EmailDetailView({
  email,
  onBack,
  conversationHistory,
  onChannelChange,
  onRefreshEmails,
  initialChannel,
  isNewConversation,
  requireManualEmailSubject,
  initialContactPhone,
  onNewEmailSent,
}: EmailDetailViewProps) {
  const { user, property } = useAuth();

  const [activeChannel, setActiveChannel] = useState<ChannelKey>('all');
  const [composerChannel, setComposerChannel] = useState<SendChannel>('email');
  const [composerText, setComposerText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [whatsAppConversationId, setWhatsAppConversationId] = useState<string>('');
  const [guestPortalConversationId, setGuestPortalConversationId] = useState<string>('');
  const [whatsAppMessages, setWhatsAppMessages] = useState<any[]>([]);
  const [guestPortalMessages, setGuestPortalMessages] = useState<any[]>([]);
  const [newConversationSubject, setNewConversationSubject] = useState('');
  const [showNewConversationFields, setShowNewConversationFields] = useState(Boolean(isNewConversation));
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerFileInputRef = useRef<HTMLInputElement | null>(null);
  const [propertyTemplates, setPropertyTemplates] = useState<PropertyTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [attachmentViewer, setAttachmentViewer] = useState<AttachmentViewerState | null>(null);

  const [guestContext, setGuestContext] = useState<GuestContextPayload | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  const closeAttachmentViewer = useCallback(() => {
    setAttachmentViewer(null);
  }, []);

  const openAttachmentViewer = useCallback((attachment: { name: string; url: string; contentType?: string }) => {
    if (!attachment.url) return;
    setAttachmentViewer(attachment);
  }, []);

  const orderedHistory = useMemo(() => {
    const source = Array.isArray(conversationHistory) && conversationHistory.length > 0
      ? conversationHistory
      : [email];

    return [...source].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [conversationHistory, email]);

  const [threadMessages, setThreadMessages] = useState<Email[]>(orderedHistory);

  useEffect(() => {
    setThreadMessages(orderedHistory);
  }, [orderedHistory]);

  useEffect(() => {
    if (!initialChannel) return;
    setActiveChannel(initialChannel);
    if (initialChannel !== 'all') {
      setComposerChannel(initialChannel as SendChannel);
    }
  }, [email.id, initialChannel]);

  useEffect(() => {
    setShowNewConversationFields(Boolean(isNewConversation || requireManualEmailSubject));
    setNewConversationSubject('');
    setComposerAttachments([]);
  }, [email.id, isNewConversation, requireManualEmailSubject]);

  const latestIncoming = useMemo(() => {
    const copy = [...threadMessages].reverse();
    return copy.find((item) => !isSentMessage(item));
  }, [threadMessages]);

  const recipientEmail = useMemo(() => {
    const raw = String(latestIncoming?.from?.email || email.from?.email || email.from_email || '').trim();
    return isSyntheticGuestPortalAddress(raw) ? '' : raw;
  }, [latestIncoming, email]);

  const threadPrimarySource = useMemo<'email' | 'whatsapp' | 'guest_portal' | 'sms'>(() => {
    const latest = latestIncoming || email;
    return normalizeMessageSource(latest as any);
  }, [latestIncoming, email]);

  const contactLine = useMemo(() => {
    if (threadPrimarySource === 'guest_portal') {
      return '';
    }
    return recipientEmail || 'Unknown contact';
  }, [recipientEmail, threadPrimarySource]);

  const recipientPhone = useMemo(() => {
    return normalizePhone(guestContext?.guest?.phone || initialContactPhone || '');
  }, [guestContext?.guest?.phone, initialContactPhone]);

  const guestDisplayName = useMemo(() => {
    const fromName = String(latestIncoming?.from?.name || email.from?.name || email.from_name || '').trim();
    return String(guestContext?.guest?.fullName || fromName || 'Guest').trim();
  }, [email.from, email.from_name, guestContext?.guest?.fullName, latestIncoming, recipientEmail]);

  const replyReferenceId = useMemo(() => {
    if (latestIncoming?.id) return latestIncoming.id;
    if (email.id) return email.id;
    return '';
  }, [latestIncoming, email.id]);

  const sourceConversationIdFromThread = useMemo(() => {
    const fromSelected = String((email as any).sourceConversationId || (email as any).source_conversation_id || '').trim();
    if (fromSelected) return fromSelected;

    for (let i = threadMessages.length - 1; i >= 0; i -= 1) {
      const item = threadMessages[i] as any;
      const id = String(item?.sourceConversationId || item?.source_conversation_id || '').trim();
      if (id) return id;
    }
    return '';
  }, [email, threadMessages]);

  const sourceReservationIdFromThread = useMemo(() => {
    const fromSelected = String((email as any).sourceReservationId || (email as any).source_reservation_id || '').trim();
    if (fromSelected) return fromSelected;

    for (let i = threadMessages.length - 1; i >= 0; i -= 1) {
      const item = threadMessages[i] as any;
      const id = String(item?.sourceReservationId || item?.source_reservation_id || '').trim();
      if (id) return id;
    }
    return '';
  }, [email, threadMessages]);

  const selectedGuestPortalThreadIdentity = useMemo(() => {
    return sourceConversationIdFromThread || sourceReservationIdFromThread || String(email.id || email.uid || email.date || 'thread');
  }, [email.date, email.id, email.uid, sourceConversationIdFromThread, sourceReservationIdFromThread]);

  const activeReservation = useMemo(() => {
    const reservations = guestContext?.reservations || [];
    if (reservations.length === 0) return null;
    if (!sourceReservationIdFromThread) return reservations[0];
    return reservations.find((reservation) => String(reservation.id || '') === sourceReservationIdFromThread) || reservations[0];
  }, [guestContext?.reservations, sourceReservationIdFromThread]);

  const templateVariables = useMemo<Record<string, string>>(() => {
    const reservation = activeReservation;
    const checkInDate = reservation?.arrival ? format(new Date(reservation.arrival), 'PP') : '';
    const checkOutDate = reservation?.departure ? format(new Date(reservation.departure), 'PP') : '';
    const nights = reservation?.arrival && reservation?.departure
      ? Math.max(0, Math.ceil((new Date(reservation.departure).getTime() - new Date(reservation.arrival).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    return {
      guest_name: String(guestContext?.guest?.fullName || guestDisplayName || 'Guest').trim(),
      guest_email: String(guestContext?.guest?.email || recipientEmail || '').trim(),
      guest_phone: String(guestContext?.guest?.phone || recipientPhone || '').trim(),
      reservation_code: String(activeReservation?.reservationNumber || activeReservation?.id || sourceReservationIdFromThread || '').trim(),
      reservation_id: String(activeReservation?.id || sourceReservationIdFromThread || '').trim(),
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      number_of_nights: nights ? String(nights) : '',
      room_type: String(activeReservation?.room || '').trim(),
      outstanding_balance: activeReservation?.outstandingBalance != null ? String(activeReservation.outstandingBalance) : '',
      property_name: String((property as any)?.name || '').trim(),
      property_email: String((property as any)?.email || '').trim(),
      property_phone: String((property as any)?.phone || '').trim(),
      property_address: String((property as any)?.address || '').trim(),
      currency: String((property as any)?.currency || '').trim(),
      current_date: format(new Date(), 'PP'),
    };
  }, [activeReservation, guestContext?.guest?.email, guestContext?.guest?.fullName, guestContext?.guest?.phone, guestDisplayName, property, recipientEmail, recipientPhone, sourceReservationIdFromThread]);

  const availableVariableEntries = useMemo(() => {
    return Object.entries(templateVariables)
      .filter(([, value]) => String(value || '').trim())
      .sort(([a], [b]) => a.localeCompare(b));
  }, [templateVariables]);

  const applyTemplateVariables = useCallback((value: string) => {
    return value.replace(/\{\{\{?\s*([a-zA-Z0-9_]+)\s*\}\}?\}/g, (match, key: string) => {
      const resolved = templateVariables[key];
      if (resolved == null || String(resolved).trim() === '') return '';
      return String(resolved);
    });
  }, [templateVariables]);

  const stripTemplateHtml = useCallback((value: string) => {
    return String(value || '')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }, []);

  const insertAtCursor = useCallback((value: string) => {
    const textarea = composerTextareaRef.current;
    if (!textarea) {
      setComposerText((prev) => `${prev}${prev ? ' ' : ''}${value}`.trimStart());
      return;
    }

    const start = textarea.selectionStart ?? composerText.length;
    const end = textarea.selectionEnd ?? composerText.length;
    const next = `${composerText.slice(0, start)}${value}${composerText.slice(end)}`;
    setComposerText(next);

    window.requestAnimationFrame(() => {
      textarea.focus();
      const caretPos = start + value.length;
      textarea.setSelectionRange(caretPos, caretPos);
    });
  }, [composerText]);

  const fileToBase64 = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64 = result.includes(',') ? result.split(',')[1] || '' : result;
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  const openComposerFilePicker = useCallback(() => {
    if (composerChannel === 'sms' || composerChannel === 'whatsapp') {
      toast({
        title: 'Attachments unavailable',
        description: 'Attachments are currently available for email and guest portal only.',
      });
      return;
    }

    composerFileInputRef.current?.click();
  }, [composerChannel]);

  const handleComposerFileSelection = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    const validFiles: ComposerAttachment[] = [];
    for (const file of selectedFiles) {
      if (file.size > MAX_COMPOSER_ATTACHMENT_SIZE) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds the 10MB limit.`,
          variant: 'destructive',
        });
        continue;
      }

      validFiles.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        fileSize: file.size,
      });
    }

    if (validFiles.length > 0) {
      setComposerAttachments((prev) => {
        const existingIds = new Set(prev.map((attachment) => attachment.id));
        const dedupedIncoming = validFiles.filter((attachment) => !existingIds.has(attachment.id));
        const next = [...prev];

        for (const attachment of dedupedIncoming) {
          if (next.length >= MAX_COMPOSER_ATTACHMENTS_COUNT) {
            toast({
              title: 'Too many files',
              description: `You can attach up to ${MAX_COMPOSER_ATTACHMENTS_COUNT} files per message.`,
              variant: 'destructive',
            });
            break;
          }

          const totalSize = next.reduce((sum, item) => sum + item.fileSize, 0) + attachment.fileSize;
          if (totalSize > MAX_COMPOSER_ATTACHMENTS_TOTAL_SIZE) {
            toast({
              title: 'Attachments too large',
              description: `Total attachments per message cannot exceed 30MB.`,
              variant: 'destructive',
            });
            continue;
          }

          next.push(attachment);
        }

        return next;
      });
    }

    if (event.target) {
      event.target.value = '';
    }
  }, []);

  const removeComposerAttachment = useCallback((attachmentId: string) => {
    setComposerAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
    window.requestAnimationFrame(() => {
      composerTextareaRef.current?.focus();
    });
  }, []);

  const handleApplyTemplate = useCallback((template: PropertyTemplate) => {
    const templateSubject = applyTemplateVariables(String(template.subject || '').trim());
    const textBodySource = String(template.plain_text_content || '').trim() || stripTemplateHtml(String(template.html_content || ''));
    const templateBody = applyTemplateVariables(textBodySource);

    if (templateSubject && (composerChannel === 'email' || showNewConversationFields)) {
      setNewConversationSubject(templateSubject);
    }

    if (templateBody) {
      setComposerText(templateBody);
    }

    window.requestAnimationFrame(() => {
      composerTextareaRef.current?.focus();
    });
  }, [applyTemplateVariables, composerChannel, showNewConversationFields, stripTemplateHtml]);

  useEffect(() => {
    const loadPropertyTemplates = async () => {
      if (!user?.propertyId) {
        setPropertyTemplates([]);
        return;
      }

      setIsLoadingTemplates(true);
      try {
        const response = await fetch(`/api/property-settings/email-templates?propertyId=${encodeURIComponent(user.propertyId)}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          setPropertyTemplates([]);
          return;
        }

        const payload = await response.json().catch(() => null);
        const templates = Array.isArray(payload?.templates) ? payload.templates : [];
        setPropertyTemplates(
          templates
            .filter((item: any) => item && item.enabled !== false)
            .map((item: any) => ({
              template_id: String(item.template_id || ''),
              name: String(item.name || 'Untitled Template'),
              enabled: item.enabled !== false,
              subject: String(item.subject || ''),
              html_content: String(item.html_content || ''),
              plain_text_content: String(item.plain_text_content || ''),
            }))
        );
      } catch {
        setPropertyTemplates([]);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    loadPropertyTemplates();
  }, [user?.propertyId]);

  useEffect(() => {
    setGuestPortalConversationId('');
    setGuestPortalMessages([]);
  }, [selectedGuestPortalThreadIdentity]);

  const contactPhone = useMemo(() => normalizePhone(guestContext?.guest?.phone), [guestContext?.guest?.phone]);

  const handleSwitchChannel = (channel: ChannelKey) => {
    setActiveChannel(channel);
    if (channel === 'sms') {
      toast({ title: 'SMS channel', description: 'SMS send from this workspace is coming soon.' });
    }
    if (channel !== 'all') {
      setComposerChannel(channel as SendChannel);
    }
  };

  const sendViaWhatsApp = async (body: string): Promise<string> => {
    if (!user?.propertyId) throw new Error('Missing property context');
    const guestPhone = recipientPhone;
    if (!guestPhone) throw new Error('Guest phone is required for WhatsApp.');

    let conversationId = whatsAppConversationId;

    if (!conversationId) {
      const listResult = await whatsappApi.listConversations(user.propertyId);
      const list = listResult?.conversations || [];
      const byPhone = list.find((item: any) => normalizePhone(item?.guest_phone) === guestPhone);
      const byEmail = guestContext?.guest?.email
        ? list.find((item: any) => String(item?.guest_email || '').toLowerCase() === String(guestContext.guest.email).toLowerCase())
        : null;

      const existing = byPhone || byEmail;
      if (existing?.id) {
        conversationId = String(existing.id);
      }
    }

    if (conversationId) {
      const sendResult = await whatsappApi.sendMessage(user.propertyId, conversationId, body);
      if (!sendResult?.success) throw new Error('Failed to send WhatsApp message');
      setWhatsAppConversationId(conversationId);
      return conversationId;
    }

    const startResult = await whatsappApi.startConversation(
      user.propertyId,
      guestPhone,
      guestContext?.guest?.fullName,
      guestContext?.guest?.email || undefined,
      body
    );
    if (!startResult?.success || !startResult?.conversation?.id) {
      throw new Error('Failed to start WhatsApp conversation');
    }
    const createdConversationId = String(startResult.conversation.id);
    setWhatsAppConversationId(createdConversationId);
    return createdConversationId;
  };

  const sendViaGuestPortal = async (body: string, attachments: any[] = []): Promise<string> => {
    if (!user?.propertyId) throw new Error('Missing property context');

    const reservationId = sourceReservationIdFromThread || guestContext?.reservations?.[0]?.id;
    let conversationId = guestPortalConversationId || sourceConversationIdFromThread;

    if (!conversationId) {
      if (!reservationId) {
        throw new Error('No reservation linked for guest portal chat.');
      }

      const listResult = await guestPortalApi.listConversations(user.propertyId);
      const list = listResult?.conversations || [];
      const existing = list.find((item: any) => String(item?.reservation_id || '') === String(reservationId));
      if (existing?.id) {
        conversationId = String(existing.id);
      }
    }

    if (conversationId) {
      const sendResult = await guestPortalApi.sendMessage(user.propertyId, conversationId, body, attachments);
      if (!sendResult?.success) throw new Error('Failed to send guest portal message');
      setGuestPortalConversationId(conversationId);
      return conversationId;
    }

    const startResult = await guestPortalApi.startConversation(user.propertyId, String(reservationId), body);
    if (!startResult?.success || !startResult?.conversation?.id) {
      throw new Error('Failed to start guest portal conversation');
    }
    const createdConversationId = String(startResult.conversation.id);
    setGuestPortalConversationId(createdConversationId);
    return createdConversationId;
  };

  const loadWhatsAppHistory = async (propertyId: string) => {
    const guestPhone = recipientPhone;
    const guestEmail = String(guestContext?.guest?.email || '').toLowerCase();

    const listResult = await whatsappApi.listConversations(propertyId);
    const list = listResult?.conversations || [];
    const existing = list.find((item: any) => {
      const phoneMatch = guestPhone && normalizePhone(item?.guest_phone) === guestPhone;
      const emailMatch = guestEmail && String(item?.guest_email || '').toLowerCase() === guestEmail;
      return phoneMatch || emailMatch;
    });

    if (!existing?.id) {
      setWhatsAppMessages([]);
      return;
    }

    const conversationId = String(existing.id);
    setWhatsAppConversationId(conversationId);
    const messagesResult = await whatsappApi.getMessages(propertyId, conversationId, 100);
    setWhatsAppMessages(messagesResult?.messages || []);
  };

  const loadGuestPortalHistory = async (propertyId: string) => {
    const reservationId = sourceReservationIdFromThread || guestContext?.reservations?.[0]?.id;
    const knownConversationId = sourceConversationIdFromThread || guestPortalConversationId;

    if (knownConversationId) {
      const messagesResult = await guestPortalApi.getMessages(propertyId, knownConversationId, 100);
      setGuestPortalConversationId(knownConversationId);
      setGuestPortalMessages(messagesResult?.messages || []);
      return;
    }

    if (!reservationId) {
      setGuestPortalMessages([]);
      return;
    }

    const listResult = await guestPortalApi.listConversations(propertyId);
    const list = listResult?.conversations || [];
    const existing = list.find((item: any) => String(item?.reservation_id || '') === String(reservationId));

    if (!existing?.id) {
      setGuestPortalMessages([]);
      return;
    }

    const conversationId = String(existing.id);
    setGuestPortalConversationId(conversationId);
    const messagesResult = await guestPortalApi.getMessages(propertyId, conversationId, 100);
    setGuestPortalMessages(messagesResult?.messages || []);
  };

  const handleSendEmail = async () => {
    const body = composerText.trim();
    const attachmentOnlyBody = composerAttachments.length > 0
      ? composerAttachments.map((attachment) => `Attachment: ${attachment.filename}`).join('\n')
      : '';
    const effectiveBody = body || attachmentOnlyBody;
    if (!effectiveBody) return;

    setIsSending(true);
    try {
      if (composerChannel === 'sms') {
        throw new Error('SMS sending is not yet available in this workspace.');
      }

      if (composerChannel === 'whatsapp') {
        if (composerAttachments.length > 0) {
          throw new Error('Attachments are not yet available for WhatsApp messages.');
        }
        const conversationId = await sendViaWhatsApp(effectiveBody);
        const messagesResult = await whatsappApi.getMessages(user!.propertyId!, conversationId, 100);
        setWhatsAppMessages(messagesResult?.messages || []);
        setComposerText('');
        setComposerAttachments([]);
        focusComposer();
        return;
      }

      if (composerChannel === 'guest_portal') {
        const guestPortalAttachments: Array<{ filename: string; contentType: string; size: number; dataUri: string }> = await Promise.all(
          composerAttachments.map(async (attachment) => ({
            filename: attachment.filename,
            contentType: attachment.contentType,
            size: attachment.fileSize,
            dataUri: await uploadFile(
              `properties/${user!.propertyId!}/communication/guest-portal/${sourceConversationIdFromThread || sourceReservationIdFromThread || 'draft'}`,
              attachment.file
            ),
          }))
        );

        const conversationId = await sendViaGuestPortal(effectiveBody, guestPortalAttachments);
        const messagesResult = await guestPortalApi.getMessages(user!.propertyId!, conversationId, 100);
        setGuestPortalMessages((messagesResult?.messages || []) as any[]);
        setComposerText('');
        setComposerAttachments([]);
        focusComposer();
        return;
      }

      if (!user?.propertyId || !recipientEmail) {
        throw new Error('Missing property or recipient email.');
      }

      const manualSubject = newConversationSubject.trim();
      const normalizedSubject = showNewConversationFields
        ? manualSubject
        : /^re:/i.test(String(email.subject || ''))
          ? String(email.subject || '(No Subject)')
          : `Re: ${email.subject || '(No Subject)'}`;
      const threadContactName = String(guestDisplayName || '').trim() || undefined;

      if (showNewConversationFields && !normalizedSubject) {
        throw new Error('Subject is required for new email conversations.');
      }

      const emailAttachments = await Promise.all(
        composerAttachments.map(async (attachment) => ({
          filename: attachment.filename,
          contentType: attachment.contentType,
          content: await fileToBase64(attachment.file),
        }))
      );

      const result = replyReferenceId
        ? await emailApi.sendReply(
            user.propertyId,
            replyReferenceId,
            recipientEmail,
            normalizedSubject,
            effectiveBody.replace(/\n/g, '<br>'),
            effectiveBody,
            emailAttachments,
            threadContactName
          )
        : await emailApi.sendComposed(
            user.propertyId,
            recipientEmail,
            normalizedSubject,
            effectiveBody.replace(/\n/g, '<br>'),
            effectiveBody,
            emailAttachments,
            undefined,
            undefined,
            threadContactName
          );

      if (!result?.success) {
        throw new Error('Failed to send email');
      }

      setComposerText('');
      setComposerAttachments([]);
      focusComposer();
      if (showNewConversationFields) {
        setShowNewConversationFields(false);
      }
      onRefreshEmails?.();
    } catch (error: any) {
      toast({ title: 'Send failed', description: error?.message || 'Could not send message.', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    const loadGuestContext = async () => {
      if (!user?.propertyId) {
        setGuestContext(null);
        return;
      }

      const rawLookupEmail = String(latestIncoming?.from?.email || email.from?.email || '').trim();
      const lookupEmail = isSyntheticGuestPortalAddress(rawLookupEmail) ? '' : rawLookupEmail;
      if (!lookupEmail && !email.id) {
        setGuestContext(null);
        return;
      }

      setIsLoadingContext(true);
      try {
        const result = await emailApi.getEmailGuestContext(
          user.propertyId,
          lookupEmail,
          email.id,
          undefined,
          sourceReservationIdFromThread || undefined
        );
        const context = result?.context || null;
        setGuestContext(context);
      } catch (error) {
        console.warn('Failed to load guest context', error);
        setGuestContext(null);
      } finally {
        setIsLoadingContext(false);
      }
    };

    loadGuestContext();
  }, [email.id, email.from?.email, latestIncoming, sourceReservationIdFromThread, user?.propertyId]);

  useEffect(() => {
    const loadChannelHistory = async () => {
      if (!user?.propertyId || !guestContext) return;
      try {
        await loadWhatsAppHistory(user.propertyId);
        await loadGuestPortalHistory(user.propertyId);
      } catch (error) {
        console.warn('Failed to load channel history', error);
      }
    };
    loadChannelHistory();
  }, [guestContext, recipientPhone, selectedGuestPortalThreadIdentity, user?.propertyId]);

  const mappedEmailMessages = useMemo<UnifiedMessage[]>(() => {
    return threadMessages
      .filter((message) => normalizeMessageSource(message) === 'email')
      .map((message) => ({
      id: String(message.id || `${message.uid}-${message.date}`),
      source: 'email',
      outgoing: isSentMessage(message),
      date: message.date,
      timestampMs: toTimestampMs((message as any).dateMs || message.date),
      senderName: message.from?.name || message.from?.email || 'Unknown',
      senderEmail: message.from?.email || undefined,
      subject: message.subject || undefined,
      text: messageText(message),
      attachmentsCount: Array.isArray(message.attachments) ? message.attachments.length : 0,
      attachments: Array.isArray(message.attachments)
        ? message.attachments.map((attachment: any) => ({
            name: String(attachment.filename || 'Attachment'),
            contentType: attachment.contentType,
            size: attachment.size,
            url: attachment.dataUri || attachment.fileUrl || attachment.file_url,
          }))
        : [],
    }));
  }, [threadMessages]);

  const mappedGuestPortalThreadMessages = useMemo<UnifiedMessage[]>(() => {
    return threadMessages
      .filter((message) => normalizeMessageSource(message) === 'guest_portal')
      .map((message: any) => {
        const sourceMessageId = String(message.sourceMessageId || message.source_message_id || '').trim();
        return {
        id: sourceMessageId ? `gp-${sourceMessageId}` : `gp-thread-${String(message.id || `${message.uid}-${message.date}`)}`,
        source: 'guest_portal',
        outgoing: isSentMessage(message),
        date: message.date,
        timestampMs: toTimestampMs(message.dateMs || message.date),
        senderName: message.from?.name || message.from?.email || 'Guest Portal User',
        senderEmail: message.from?.email || undefined,
        subject: message.subject || undefined,
        text: messageText(message),
        attachmentsCount: Array.isArray(message.attachments) ? message.attachments.length : 0,
        attachments: Array.isArray(message.attachments)
          ? message.attachments.map((attachment: any) => ({
              name: String(attachment.filename || attachment.file_name || 'Attachment'),
              contentType: attachment.contentType || attachment.content_type || attachment.file_type,
              size: attachment.size || attachment.file_size,
              url: attachment.dataUri || attachment.fileUrl || attachment.file_url,
            }))
          : message.fileAttachment?.fileName
            ? [{
                name: String(message.fileAttachment.fileName),
                contentType: message.fileAttachment.fileType,
                size: message.fileAttachment.fileSize,
                url: message.fileAttachment.fileUrl,
              }]
          : [],
      };
      });
  }, [threadMessages]);

  const mappedWhatsAppMessages = useMemo<UnifiedMessage[]>(() => {
    return (whatsAppMessages || []).map((message: any) => ({
      id: `wa-${message.id}`,
      source: 'whatsapp',
      outgoing: String(message.senderType || message.sender_type || '').toLowerCase() === 'property',
      date: String(message.timestamp || message.created_at || new Date().toISOString()),
      timestampMs: toTimestampMs(message.timestampMs || message.timestamp || message.created_at),
      senderName: String(message.senderName || message.sender_name || 'WhatsApp User'),
      text: String(message.message || ''),
      attachmentsCount: 0,
      attachments: [],
    }));
  }, [whatsAppMessages]);

  const mappedGuestPortalMessages = useMemo<UnifiedMessage[]>(() => {
    const apiMapped: UnifiedMessage[] = (guestPortalMessages || []).map((message: any) => ({
      id: `gp-${message.id}`,
      source: 'guest_portal',
      outgoing: String(message.senderType || message.sender_type || '').toLowerCase() === 'property',
      date: String(message.timestamp || message.created_at || new Date().toISOString()),
      timestampMs: toTimestampMs(message.timestampMs || message.timestamp || message.created_at),
      senderName: String(message.senderName || message.sender_name || 'Guest Portal User'),
      text: String(message.message || ''),
      attachmentsCount: Array.isArray(message.attachments)
        ? message.attachments.length
        : message.fileAttachment?.fileName
          ? 1
          : 0,
      attachments: Array.isArray(message.attachments)
        ? message.attachments.map((attachment: any) => ({
            name: String(attachment.fileName || attachment.file_name || 'Attachment'),
            contentType: attachment.fileType || attachment.file_type,
            size: attachment.fileSize || attachment.file_size,
            url: attachment.fileUrl || attachment.file_url,
          }))
        : message.fileAttachment?.fileName
          ? [{
              name: String(message.fileAttachment.fileName),
              contentType: message.fileAttachment.fileType,
              size: message.fileAttachment.fileSize,
              url: message.fileAttachment.fileUrl,
            }]
          : [],
    }));

    const deduped = new Map<string, UnifiedMessage>();
    [...mappedGuestPortalThreadMessages, ...apiMapped].forEach((message) => {
      deduped.set(message.id, message);
    });
    return sortUnifiedMessages(Array.from(deduped.values()));
  }, [guestPortalMessages, mappedGuestPortalThreadMessages]);

  const displayedMessages = useMemo<UnifiedMessage[]>(() => {
    let source: UnifiedMessage[] = [];
    if (activeChannel === 'all') {
      source = [...mappedEmailMessages, ...mappedWhatsAppMessages, ...mappedGuestPortalMessages];
    } else if (activeChannel === 'email') {
      source = mappedEmailMessages;
    } else if (activeChannel === 'whatsapp') {
      source = mappedWhatsAppMessages;
    } else if (activeChannel === 'guest_portal') {
      source = mappedGuestPortalMessages;
    } else {
      source = [];
    }

    return sortUnifiedMessages(source);
  }, [activeChannel, mappedEmailMessages, mappedGuestPortalMessages, mappedWhatsAppMessages]);

  const scrollToLatestMessage = useCallback((behavior: ScrollBehavior = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  const focusComposer = useCallback(() => {
    const frame = window.requestAnimationFrame(() => {
      composerTextareaRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      scrollToLatestMessage('auto');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [email.id, activeChannel, scrollToLatestMessage]);

  useEffect(() => {
    if (displayedMessages.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      scrollToLatestMessage('smooth');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [displayedMessages.length, scrollToLatestMessage]);

  useEffect(() => {
    return focusComposer();
  }, [email.id, composerChannel, focusComposer]);

  useEffect(() => {
    if (!attachmentViewer) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAttachmentViewer();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [attachmentViewer, closeAttachmentViewer]);

  const lastInboundChannel = useMemo<SendChannel | null>(() => {
    const allMessages = [...mappedEmailMessages, ...mappedWhatsAppMessages, ...mappedGuestPortalMessages];
    const lastInbound = allMessages
      .filter((message) => !message.outgoing)
      .sort((a, b) => b.timestampMs - a.timestampMs || String(b.id).localeCompare(String(a.id)))[0];

    if (!lastInbound) return null;
    if (lastInbound.source === 'whatsapp') return 'whatsapp';
    if (lastInbound.source === 'guest_portal') return 'guest_portal';
    if (lastInbound.source === 'sms') return 'sms';
    return 'email';
  }, [mappedEmailMessages, mappedGuestPortalMessages, mappedWhatsAppMessages]);

  useEffect(() => {
    if (!lastInboundChannel) return;
    setComposerChannel(lastInboundChannel);
  }, [lastInboundChannel]);

  const channelCounts = useMemo(() => {
    const emailCount = mappedEmailMessages.length;
    const whatsappCount = mappedWhatsAppMessages.length;
    const guestPortalCount = mappedGuestPortalMessages.length;
    const smsCount = 0;

    return {
      all: emailCount + whatsappCount + guestPortalCount + smsCount,
      email: emailCount,
      whatsapp: whatsappCount,
      guest_portal: guestPortalCount,
      sms: smsCount,
    };
  }, [mappedEmailMessages.length, mappedGuestPortalMessages.length, mappedWhatsAppMessages.length]);

  const isComposerSendDisabled = useMemo(() => {
    return (
      isSending ||
      (!composerText.trim() && composerAttachments.length === 0) ||
      composerChannel === 'sms' ||
      (showNewConversationFields && composerChannel === 'email' && !newConversationSubject.trim())
    );
  }, [composerAttachments.length, composerChannel, composerText, isSending, newConversationSubject, showNewConversationFields]);

  return (
    <div className="flex h-full bg-slate-100">
      <div className="flex min-w-0 flex-1 flex-col border-r border-slate-200 bg-white">
        <header className="border-b border-slate-200 bg-white px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-slate-900">{guestDisplayName}</h2>
                {contactLine ? <p className="truncate text-xs text-slate-500">{contactLine}</p> : null}
              </div>
            </div>
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {CHANNELS.map((channel) => (
              <button
                key={channel.key}
                type="button"
                onClick={() => handleSwitchChannel(channel.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  activeChannel === channel.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <span>{channel.label}</span>
                <span
                  className={cn(
                    'min-w-[18px] rounded-full px-1.5 text-[10px] leading-4',
                    activeChannel === channel.key
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-slate-200/70 text-slate-600'
                  )}
                >
                  {channelCounts[channel.key]}
                </span>
              </button>
            ))}
          </div>
        </header>

        <ScrollArea className="flex-1 bg-slate-50 px-4 py-4">
          <div className="space-y-3">
            {displayedMessages.map((message) => {
              const outgoing = message.outgoing;
              const date = new Date(message.date);
              const label = isValid(date) ? format(date, 'PP p') : 'Unknown date';
              return (
                <div key={message.id} className={cn('flex', outgoing ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[76%] rounded-2xl border px-3 py-2 shadow-sm',
                      outgoing
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-white'
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">{message.senderName}</span>
                      <Badge variant="outline" className="h-4 rounded-full px-1.5 text-[9px] uppercase tracking-wide">
                        {message.source === 'guest_portal' ? 'Guest Portal' : message.source}
                      </Badge>
                      <span className="text-[10px] text-slate-400">{label}</span>
                    </div>
                    {message.source === 'email' && message.subject && (
                      <p className="mb-1 text-xs font-semibold text-slate-600">Subject: {message.subject}</p>
                    )}
                    {(() => {
                      const hasAttachments = !!message.attachmentsCount && message.attachmentsCount > 0;
                      const textToRender = getRenderableMessageText(message.text, hasAttachments);

                      return (
                        <>
                          {hasAttachments && (
                            <div className="mt-2 space-y-2">
                              <div className="grid gap-2">
                                {(message.attachments || []).map((attachment, index) => (
                                  <div key={`${message.id}-attachment-${index}`} className="w-full">
                                    {renderCompactAttachmentPreview(attachment, outgoing, openAttachmentViewer)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {textToRender ? (
                            <p className={cn('whitespace-pre-wrap break-words text-sm text-slate-700', hasAttachments ? 'mt-2' : 'mt-0')}>
                              {textToRender}
                            </p>
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <footer className="border-t border-slate-200 bg-white p-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
            <div className="mb-2 flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 rounded-lg bg-white text-xs">
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Template
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 w-72 overflow-auto">
                  <DropdownMenuLabel>Email templates</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoadingTemplates && (
                    <DropdownMenuItem disabled>Loading templates...</DropdownMenuItem>
                  )}
                  {!isLoadingTemplates && propertyTemplates.length === 0 && (
                    <DropdownMenuItem disabled>No templates found</DropdownMenuItem>
                  )}
                  {!isLoadingTemplates && propertyTemplates.map((template) => (
                    <DropdownMenuItem
                      key={template.template_id || template.name}
                      onSelect={() => handleApplyTemplate(template)}
                    >
                      {template.name || 'Untitled Template'}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 rounded-lg bg-white text-xs">
                    Variables
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 w-80 overflow-auto">
                  <DropdownMenuLabel>Insert reservation variables</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableVariableEntries.length === 0 && (
                    <DropdownMenuItem disabled>No reservation variables available</DropdownMenuItem>
                  )}
                  {availableVariableEntries.map(([key, value]) => (
                    <DropdownMenuItem key={key} onSelect={() => insertAtCursor(String(value))}>
                      <span className="mr-2 text-slate-500">{`{{${key}}}`}</span>
                      <span className="truncate text-slate-700">{String(value)}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg bg-white text-xs"
                onClick={openComposerFilePicker}
              >
                Upload
              </Button>
              <input
                ref={composerFileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleComposerFileSelection}
              />
              <Select value={composerChannel} onValueChange={(value: SendChannel) => setComposerChannel(value)}>
                <SelectTrigger className="ml-auto h-8 w-[154px] rounded-lg bg-white text-xs">
                  <SelectValue placeholder="Send via" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="guest_portal">Guest Portal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {showNewConversationFields && composerChannel === 'email' && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subject</p>
                  <Input
                    value={newConversationSubject}
                    onChange={(event) => setNewConversationSubject(event.target.value)}
                    placeholder="Enter email subject"
                    className="h-9 rounded-lg border-slate-200 bg-white"
                  />
                </div>
              )}

              {composerAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {composerAttachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                    >
                      <Paperclip className="h-3 w-3" />
                      <span className="max-w-[180px] truncate">{attachment.filename}</span>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-600"
                        onClick={() => removeComposerAttachment(attachment.id)}
                        aria-label={`Remove ${attachment.filename}`}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative rounded-xl border border-slate-200 bg-slate-50">
                <Textarea
                  ref={composerTextareaRef}
                  value={composerText}
                  onChange={(event) => setComposerText(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault();
                      if (!isComposerSendDisabled) {
                        void handleSendEmail();
                      }
                      return;
                    }

                    if (event.key === 'Enter' && !event.shiftKey && composerChannel !== 'email') {
                      event.preventDefault();
                      if (!isComposerSendDisabled) {
                        void handleSendEmail();
                      }
                    }
                  }}
                  placeholder={
                    composerChannel === 'email'
                      ? 'Write your email reply...'
                      : composerChannel === 'whatsapp'
                      ? 'Write WhatsApp message...'
                      : composerChannel === 'guest_portal'
                      ? 'Write guest portal message...'
                      : 'SMS will be available soon.'
                  }
                  className="min-h-[68px] resize-none rounded-lg border-0 bg-white pr-28 shadow-none focus-visible:ring-0"
                />
                <Button
                  onClick={handleSendEmail}
                  disabled={isComposerSendDisabled}
                  className="absolute bottom-2 right-2 h-8 rounded-md px-3"
                >
                  {isSending ? <Clock3 className="h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                  Send
                </Button>
              </div>
            </div>
          </div>
        </footer>

        {attachmentViewer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 py-6">
            <button
              type="button"
              onClick={closeAttachmentViewer}
              className="absolute inset-0"
              aria-label="Close attachment preview backdrop"
            />

            <button
              type="button"
              onClick={closeAttachmentViewer}
              className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
              aria-label="Close attachment preview"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative z-10 flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{attachmentViewer.name}</div>
                  <div className="text-xs text-white/60">{getAttachmentFormatLabel(attachmentViewer.contentType, attachmentViewer.name) || 'file'}</div>
                </div>
                <a
                  href={attachmentViewer.url}
                  download={attachmentViewer.name}
                  className="ml-4 inline-flex h-9 items-center gap-2 rounded-full bg-white/10 px-3 text-sm text-white transition hover:bg-white/20"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </div>

              <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4">
                {isImageType(attachmentViewer.contentType, attachmentViewer.name) ? (
                  <img
                    src={attachmentViewer.url}
                    alt={attachmentViewer.name}
                    className="max-h-full w-full object-contain"
                  />
                ) : (
                  <iframe
                    src={attachmentViewer.url}
                    title={attachmentViewer.name}
                    className="h-full w-full rounded-xl bg-white"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
