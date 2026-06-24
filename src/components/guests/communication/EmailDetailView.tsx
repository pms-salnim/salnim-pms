"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { format, isValid } from 'date-fns';
import { ArrowLeft, Clock3, Paperclip, Plus, Send } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import type { Email } from '@/contexts/auth-context';
import { emailApi, guestPortalApi, whatsappApi } from '@/lib/communication-api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
};

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

  const [guestContext, setGuestContext] = useState<GuestContextPayload | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

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
  }, [email.id, isNewConversation, requireManualEmailSubject]);

  const latestIncoming = useMemo(() => {
    const copy = [...threadMessages].reverse();
    return copy.find((item) => !isSentMessage(item));
  }, [threadMessages]);

  const recipientEmail = useMemo(() => {
    return String(latestIncoming?.from?.email || email.from?.email || email.from_email || '').trim();
  }, [latestIncoming, email]);

  const threadPrimarySource = useMemo<'email' | 'whatsapp' | 'guest_portal' | 'sms'>(() => {
    const latest = latestIncoming || email;
    return normalizeMessageSource(latest as any);
  }, [latestIncoming, email]);

  const contactLine = useMemo(() => {
    if (threadPrimarySource === 'guest_portal') {
      const preferredReservation = (guestContext?.reservations || []).find((reservation) =>
        Boolean(String(reservation?.reservationNumber || '').trim())
      ) || guestContext?.reservations?.[0];
      const reservationNumber = String(preferredReservation?.reservationNumber || '').trim();
      if (reservationNumber) return `Res. N° ${reservationNumber}`;
      return 'Res. N° -';
    }
    return recipientEmail || 'Unknown contact';
  }, [guestContext?.reservations, recipientEmail, threadPrimarySource]);

  const recipientPhone = useMemo(() => {
    return normalizePhone(guestContext?.guest?.phone || initialContactPhone || '');
  }, [guestContext?.guest?.phone, initialContactPhone]);

  const guestDisplayName = useMemo(() => {
    const fromName = String(latestIncoming?.from?.name || email.from?.name || email.from_name || '').trim();
    return String(guestContext?.guest?.fullName || fromName || recipientEmail || 'Guest').trim();
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

  const sourceMessageIdFromThread = useMemo(() => {
    const fromSelected = String((email as any).sourceMessageId || (email as any).source_message_id || '').trim();
    if (fromSelected) return fromSelected;

    for (let i = threadMessages.length - 1; i >= 0; i -= 1) {
      const item = threadMessages[i] as any;
      const id = String(item?.sourceMessageId || item?.source_message_id || '').trim();
      if (id) return id;
    }
    return '';
  }, [email, threadMessages]);

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

  const sendViaGuestPortal = async (body: string): Promise<string> => {
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
      const sendResult = await guestPortalApi.sendMessage(user.propertyId, conversationId, body, []);
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
    if (!body) return;

    setIsSending(true);
    try {
      if (composerChannel === 'sms') {
        throw new Error('SMS sending is not yet available in this workspace.');
      }

      if (composerChannel === 'whatsapp') {
        const conversationId = await sendViaWhatsApp(body);
        const messagesResult = await whatsappApi.getMessages(user!.propertyId!, conversationId, 100);
        setWhatsAppMessages(messagesResult?.messages || []);
        setComposerText('');
        toast({ title: 'Sent', description: 'WhatsApp message sent.' });
        return;
      }

      if (composerChannel === 'guest_portal') {
        const conversationId = await sendViaGuestPortal(body);
        const messagesResult = await guestPortalApi.getMessages(user!.propertyId!, conversationId, 100);
        setGuestPortalMessages(messagesResult?.messages || []);
        setComposerText('');
        toast({ title: 'Sent', description: 'Guest portal message sent.' });
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

      const result = replyReferenceId
        ? await emailApi.sendReply(
            user.propertyId,
            replyReferenceId,
            recipientEmail,
            normalizedSubject,
            body.replace(/\n/g, '<br>'),
            body,
            [],
            threadContactName
          )
        : await emailApi.sendComposed(
            user.propertyId,
            recipientEmail,
            normalizedSubject,
            body.replace(/\n/g, '<br>'),
            body,
            [],
            undefined,
            undefined,
            threadContactName
          );

      if (!result?.success) {
        throw new Error('Failed to send email');
      }

      const optimisticSent: Email = {
        id: result.savedEmailId ? String(result.savedEmailId) : undefined,
        uid: 0,
        from: {
          name: guestDisplayName || recipientEmail || 'Guest',
          email: recipientEmail,
        },
        subject: normalizedSubject,
        date: new Date().toISOString(),
        snippet: body.slice(0, 150),
        body,
        bodyText: body,
        unread: false,
        starred: false,
        archived: false,
        attachments: [],
      };

      setThreadMessages((prev) => [...prev, optimisticSent]);
      onNewEmailSent?.(optimisticSent, { isFirstMessage: showNewConversationFields });
      setComposerText('');
      if (showNewConversationFields) {
        setShowNewConversationFields(false);
      }
      toast({ title: 'Sent', description: 'Your message has been sent.' });
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

      const lookupEmail = String(latestIncoming?.from?.email || email.from?.email || '').trim();
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
          sourceReservationIdFromThread || undefined,
          sourceConversationIdFromThread || undefined,
          sourceMessageIdFromThread || undefined
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
  }, [email.id, email.from?.email, latestIncoming, sourceConversationIdFromThread, sourceMessageIdFromThread, sourceReservationIdFromThread, user?.propertyId]);

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
  }, [guestContext, recipientPhone, user?.propertyId]);

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
    }));
  }, [whatsAppMessages]);

  const mappedGuestPortalMessages = useMemo<UnifiedMessage[]>(() => {
    const apiMapped = (guestPortalMessages || []).map((message: any) => ({
      id: `gp-${message.id}`,
      source: 'guest_portal',
      outgoing: String(message.senderType || message.sender_type || '').toLowerCase() === 'property',
      date: String(message.timestamp || message.created_at || new Date().toISOString()),
      timestampMs: toTimestampMs(message.timestampMs || message.timestamp || message.created_at),
      senderName: String(message.senderName || message.sender_name || 'Guest Portal User'),
      text: String(message.message || ''),
      attachmentsCount: Array.isArray(message.attachments) ? message.attachments.length : 0,
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
                <p className="truncate text-xs text-slate-500">{contactLine}</p>
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
                    <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{message.text || 'No readable content.'}</p>
                    {!!message.attachmentsCount && message.attachmentsCount > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500">
                        <Paperclip className="h-3 w-3" />
                        {message.attachmentsCount} attachment{message.attachmentsCount > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <footer className="border-t border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Template
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs">
              Variables
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs">
              Upload
            </Button>
            <Select value={composerChannel} onValueChange={(value: SendChannel) => setComposerChannel(value)}>
              <SelectTrigger className="ml-auto h-8 w-[150px] rounded-lg text-xs">
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

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              {showNewConversationFields && composerChannel === 'email' && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subject</p>
                  <Input
                    value={newConversationSubject}
                    onChange={(event) => setNewConversationSubject(event.target.value)}
                    placeholder="Enter email subject"
                    className="h-9 rounded-lg border-slate-200"
                  />
                </div>
              )}
              <Textarea
                value={composerText}
                onChange={(event) => setComposerText(event.target.value)}
                placeholder={
                  composerChannel === 'email'
                    ? 'Write your email reply...'
                    : composerChannel === 'whatsapp'
                    ? 'Write WhatsApp message...'
                    : composerChannel === 'guest_portal'
                    ? 'Write guest portal message...'
                    : 'SMS will be available soon.'
                }
                className="min-h-[72px] resize-none rounded-xl border-slate-200"
              />
            </div>
            <Button
              onClick={handleSendEmail}
              disabled={
                isSending ||
                !composerText.trim() ||
                composerChannel === 'sms' ||
                (showNewConversationFields && composerChannel === 'email' && !newConversationSubject.trim())
              }
              className="h-10 rounded-xl"
            >
              {isSending ? <Clock3 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </footer>
      </div>

    </div>
  );
}
