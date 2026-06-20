
"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { useAuth } from '@/contexts/auth-context';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Archive, Mail, MessageSquare, Bot, Settings, Bell, MessageCircle, RefreshCw, MailPlus, Inbox, Paperclip, ChevronLeft, ChevronRight, Send, MailWarning, AlertCircle, Trash2, Users, UserCheck, CalendarClock, LogOut, CheckCircle2, X, Search, Star } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '@/lib/firebase';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, isValid, isToday, isYesterday } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Property } from '@/types/property';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog';
import ReplyEmailForm from '@/components/guests/reply-email-form';
import type { Email } from '@/contexts/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from 'react-i18next';
import SMTPConfigurationForm from '@/components/guests/communication/SMTPConfigurationForm';
import IMAPConfigurationForm from '@/components/guests/communication/IMAPConfigurationForm';
import EmailDetailView from '../../../../components/guests/communication/EmailDetailView';
import LabelManager from '@/components/guests/communication/LabelManager';
import { emailApi } from '@/lib/communication-api';
import NewConversationDialog, { type ConversationChannel, type ConversationSearchResult } from '@/components/guests/communication/NewConversationDialog';

type ActiveView = 
    | 'inbox_all' 
    | 'inbox_unread' 
    | 'inbox_archived' 
    | 'channel_email' 
    | 'channel_chatbot'
    | 'channel_guest_portal'
  | 'sent'
  | 'spam'
  | 'trash'
  | 'contacts'
  | 'portal_inbox'
  | 'portal_checked_in'
  | 'portal_confirmed'
  | 'portal_checked_out'
  | 'whatsapp'
  | 'settings_email'
    | 'settings_autoresponse'
    | 'settings_integrations';

type EmailConversation = {
  key: string;
  contactName: string;
  contactEmail: string;
  latestEmail: Email;
  messages: Email[];
  unreadCount: number;
};

type ThreadChannel = 'all' | ConversationChannel;

const NavLink = ({ active, onClick, children, collapsed }: { active: boolean; onClick: () => void; children: React.ReactNode; collapsed?: boolean }) => (
  <Button
    variant="ghost"
    className={cn(
      "w-full",
      collapsed ? 'justify-center px-2' : 'justify-start',
      active && "bg-muted font-semibold"
    )}
    onClick={onClick}
  >
    {children}
  </Button>
);

const ViewPlaceholder = ({ title, description, icon }: { title: string; description: string; icon: React.ReactNode; }) => (
    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
        <div className="mb-4">{icon}</div>
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm">{description}</p>
    </div>
);

import GuestPortalChatView from '@/components/guests/communication/GuestPortalChatView';
import WhatsAppChatView from '@/components/guests/communication/WhatsAppChatView';

// Guest Portal state and handlers will be managed at the page level (see below).

export default function CommunicationHubPage() {
  const { user, property, isLoadingAuth, emails, isLoadingEmails, refetchEmails, lastEmailSyncAt, isSyncingEmails } = useAuth();
  const { t } = useTranslation('pages/guests/communication/content');
  const [activeView, setActiveView] = useState<ActiveView>('inbox_all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [guestPortalUnreadCount, setGuestPortalUnreadCount] = useState(0);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  
  const [isTestingImap, setIsTestingImap] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [selectedThreadChannel, setSelectedThreadChannel] = useState<ThreadChannel>('all');
  const [isSelectedThreadNewConversation, setIsSelectedThreadNewConversation] = useState(false);
  const [shouldPromptSubjectForSelectedThread, setShouldPromptSubjectForSelectedThread] = useState(false);
  const [selectedThreadContactPhone, setSelectedThreadContactPhone] = useState('');
  const [manualConversationKeys, setManualConversationKeys] = useState<string[]>([]);
  const [conversationDisplayNames, setConversationDisplayNames] = useState<Record<string, string>>({});
  const [optimisticallyReadEmailKeys, setOptimisticallyReadEmailKeys] = useState<string[]>([]);

  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const [replyingToEmail, setReplyingToEmail] = useState<Email | null>(null);
  
  // Mailbox-specific states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterStarred, setFilterStarred] = useState(false);
  const [filterAttachments, setFilterAttachments] = useState(false);
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);
  const [emailForLabeling, setEmailForLabeling] = useState<Email | null>(null);
  
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  const getOptimisticEmailKey = (email: Email) => {
    if (email.id) return `id:${email.id}`;
    return `uid:${email.uid}-${email.date}-${email.from?.email || 'unknown'}`;
  };

  const getEmailIdentity = (email: Email) => {
    const uid = Number(email.uid || 0);
    const normalizedFrom = String(email.from?.email || '').trim().toLowerCase() || 'unknown';

    // Inbound emails can occasionally be persisted more than once with different DB ids.
    // Prefer UID-based identity so the same received message is rendered only once.
    if (uid > 0) return `uid:${uid}-${normalizedFrom}`;

    if (email.id) return `id:${email.id}`;

    return `fallback:${email.date}-${normalizedFrom}-${String(email.subject || '').trim().toLowerCase()}`;
  };

  const getConversationKey = (email: Email) => {
    const senderEmail = String(email.from?.email || '').trim().toLowerCase();
    if (senderEmail) return `email:${senderEmail}`;
    const senderName = String(email.from?.name || '').trim().toLowerCase();
    if (senderName) return `name:${senderName}`;
    return `fallback:${getEmailIdentity(email)}`;
  };

  const getConversationChannels = (conversation: EmailConversation) => {
    const detected = new Set<string>();

    conversation.messages.forEach((message) => {
      const rawChannel = String((message as any)?.source || '').trim().toLowerCase();
      if (rawChannel === 'guest_portal') {
        detected.add('Guest Portal');
      } else if (rawChannel === 'whatsapp') {
        detected.add('WhatsApp');
      } else if (rawChannel === 'sms') {
        detected.add('SMS');
      } else {
        detected.add('Email');
      }
    });

    return Array.from(detected);
  };

  const getChannelBadgeClassName = (channel: string) => {
    switch (channel) {
      case 'Email':
        return 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50';
      case 'WhatsApp':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50';
      case 'Guest Portal':
        return 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50';
      case 'SMS':
        return 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50';
    }
  };

  const getStatusBadgeClassName = (email: Email) => {
    return isSentEmail(email)
      ? 'border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-600'
      : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100';
  };

  const getLastMessageStatus = (email: Email) => (isSentEmail(email) ? 'replied' : 'not replied');

  const isSentEmail = useCallback((email: Email) => {
    // DB-persisted outgoing emails are stored with null uid and are mapped to uid 0 in client state.
    if (!email.uid || Number(email.uid) <= 0) return true;

    const fromEmail = String(email.from?.email || '').trim().toLowerCase();
    const userEmail = String(user?.email || '').trim().toLowerCase();
    const smtpUser = String((property as any)?.emailConfiguration?.smtpUser || '').trim().toLowerCase();

    return !!fromEmail && (fromEmail === userEmail || (smtpUser && fromEmail === smtpUser));
  }, [property, user?.email]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [activeView]);

  // Track optimistic sent emails
  const [optimisticSentEmails, setOptimisticSentEmails] = useState<Email[]>([]);

  const displayEmails = useMemo(() => {
    // Merge optimistic sent emails (not yet in backend) with fetched emails
    let merged = [...emails];
    // Only add optimistic sent emails not already present (by id or by subject/date/from)
    optimisticSentEmails.forEach(sent => {
      const exists = merged.some(e =>
        (e.id && sent.id && e.id === sent.id) ||
        (e.subject === sent.subject && e.date === sent.date && e.from?.email === sent.from?.email)
      );
      if (!exists) merged.unshift(sent);
    });

    if (optimisticallyReadEmailKeys.length === 0) return merged;

    const readKeySet = new Set(optimisticallyReadEmailKeys);
    return merged.map((email) => {
      const optimisticKey = getOptimisticEmailKey(email);
      if (!readKeySet.has(optimisticKey)) return email;
      return { ...email, unread: false };
    });
  }, [emails, optimisticallyReadEmailKeys, optimisticSentEmails]);

  const { currentList, totalPages } = useMemo<{ currentList: EmailConversation[]; totalPages: number }>(() => {
    // Always show all conversations by default (inbound + outbound).
    let sourceList: Email[] = [...displayEmails];

    // Apply mailbox filters (only for email views)
    const isMailboxView = activeView === 'inbox_all' || activeView === 'inbox_unread' || activeView === 'channel_email' || activeView === 'sent';
    if (isMailboxView) {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        sourceList = sourceList.filter(e => 
          e.subject.toLowerCase().includes(query) ||
          e.from.name.toLowerCase().includes(query) ||
          e.from.email.toLowerCase().includes(query) ||
          e.snippet.toLowerCase().includes(query)
        );
      }
      // Advanced filters
      if (filterUnread) {
        sourceList = sourceList.filter(e => e.unread);
      }
      if (filterStarred) {
        sourceList = sourceList.filter(e => e.starred);
      }
      if (filterAttachments) {
        sourceList = sourceList.filter(e => e.attachments && e.attachments.length > 0);
      }

      sourceList = [...sourceList].sort((a, b) => {
        const aDate = new Date(a.date).getTime();
        const bDate = new Date(b.date).getTime();
        return bDate - aDate;
      });
    }

    const conversationMap = new Map<string, Email[]>();
    sourceList.forEach((email) => {
      const key = getConversationKey(email);
      const current = conversationMap.get(key) || [];
      current.push(email);
      conversationMap.set(key, current);
    });

    const conversations: EmailConversation[] = Array.from(conversationMap.entries()).map(([key, messages]) => {
      const sortedMessages = [...messages].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latestEmail = sortedMessages[0];
      return {
        key,
        contactName: conversationDisplayNames[key] || latestEmail.from?.name || latestEmail.from?.email || 'Unknown sender',
        contactEmail: latestEmail.from?.email || 'unknown@example.com',
        latestEmail,
        messages: sortedMessages,
        unreadCount: sortedMessages.filter((item) => item.unread).length,
      };
    }).sort((a, b) => new Date(b.latestEmail.date).getTime() - new Date(a.latestEmail.date).getTime());
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    return {
      currentList: conversations.slice(startIndex, endIndex),
      totalPages: Math.ceil(conversations.length / itemsPerPage) || 1
    };
  }, [conversationDisplayNames, currentPage, displayEmails, filterAttachments, filterStarred, filterUnread, itemsPerPage, searchQuery]);

  const groupedConversations = useMemo(() => {
    const groups: { label: string; items: EmailConversation[] }[] = [];

    currentList.forEach((conversation) => {
      const emailDate = new Date(conversation.latestEmail.date);
      let label = 'Unknown date';

      if (isValid(emailDate)) {
        if (isToday(emailDate)) {
          label = 'Today';
        } else if (isYesterday(emailDate)) {
          label = 'Yesterday';
        } else {
          label = format(emailDate, 'EEEE, MMM d');
        }
      }

      const existingGroup = groups.find((group) => group.label === label);
      if (existingGroup) {
        existingGroup.items.push(conversation);
      } else {
        groups.push({ label, items: [conversation] });
      }
    });

    return groups;
  }, [currentList]);

  const conversationHistoryByKey = useMemo(() => {
    const map = new Map<string, Email[]>();

    displayEmails.forEach((email) => {
      const key = getConversationKey(email);
      const current = map.get(key) || [];
      current.push(email);
      map.set(key, current);
    });

    map.forEach((messages, key) => {
      map.set(key, [...messages].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });

    return map;
  }, [displayEmails]);

  const selectedConversationHistory = useMemo(() => {
    if (!selectedEmail) return [] as Email[];
    // Always include optimistic sent emails in the thread if they match the conversation
    const key = getConversationKey(selectedEmail);
    const thread = conversationHistoryByKey.get(key) || [selectedEmail];
    const optimisticInThread = optimisticSentEmails.filter(e => getConversationKey(e) === key);
    // Merge, dedupe by stable message identity, and sort by date desc.
    const dedupedByIdentity = new Map<string, Email>();
    [...thread, ...optimisticInThread].forEach((message) => {
      dedupedByIdentity.set(getEmailIdentity(message), message);
    });
    return Array.from(dedupedByIdentity.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [conversationHistoryByKey, selectedEmail, optimisticSentEmails]);

  const safeRefetchEmails = useCallback(() => {
    if (user?.propertyId) {
      refetchEmails();
    }
  }, [user?.propertyId, refetchEmails]);

  const forceRefetchEmails = useCallback(() => {
    if (user?.propertyId) {
      refetchEmails(false, true);
    }
  }, [user?.propertyId, refetchEmails]);

  useEffect(() => {
    if (!initialFetchDone && user?.propertyId) {
      setInitialFetchDone(true);
      forceRefetchEmails();
    }
  }, [initialFetchDone, user?.propertyId, forceRefetchEmails]);

  useEffect(() => {
    const isEmailView = activeView === 'inbox_all' || activeView === 'inbox_unread' || activeView === 'channel_email' || activeView === 'sent';
    if (isEmailView && user?.propertyId) {
      forceRefetchEmails();
    }
  }, [activeView, user?.propertyId, forceRefetchEmails]);

  const emailSyncCooldownMs = 2 * 60 * 1000;
  const isEmailSyncOnCooldown = lastEmailSyncAt ? (Date.now() - lastEmailSyncAt) < emailSyncCooldownMs : false;
  const lastSyncLabel = lastEmailSyncAt ? format(new Date(lastEmailSyncAt), 'PPp') : 'Never';

  const handleTestSmtpConnection = async (settingsToTest: any) => {
    if (!settingsToTest.smtpHost || !settingsToTest.smtpPort || !settingsToTest.smtpUser || !settingsToTest.smtpPass) {
        toast({ title: "Missing Information", description: t('toasts.smtp_missing_info'), variant: "destructive" });
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
             toast({ title: t('toasts.smtp_failed_title'), description: result.data.message || t('toasts.smtp_failed_description'), variant: "destructive" });
        }
    } catch (error: any) {
        toast({ title: t('toasts.smtp_failed_title'), description: error.message, variant: "destructive" });
    } finally {
        setIsTestingSmtp(false);
    }
  };
  
  const handleTestImapConnection = async (settingsToTest: any) => {
    if (!settingsToTest.imapHost || !settingsToTest.imapPort || !settingsToTest.imapUser || !settingsToTest.imapPass) {
        toast({ title: "Missing Information", description: t('toasts.imap_missing_info'), variant: "destructive" });
        return;
    }
    setIsTestingImap(true);
    toast({ title: t('toasts.imap_testing_title'), description: t('toasts.imap_testing_description') });
    try {
        const functions = getFunctions(app, 'europe-west1');
        const verifyImap = httpsCallable(functions, 'verifyImap');
        const result: any = await verifyImap(settingsToTest);
        if (result.data.success) {
            toast({ title: t('toasts.imap_success_title'), description: result.data.message, variant: 'default', className: 'bg-green-100 border-green-300 text-green-800' });
        } else {
             toast({ title: t('toasts.imap_failed_title'), description: result.data.message || t('toasts.imap_failed_description'), variant: "destructive" });
        }
    } catch (error: any) {
        toast({ title: t('toasts.imap_failed_title'), description: error.message, variant: "destructive" });
    } finally {
        setIsTestingImap(false);
    }
  };

  const handleSaveSettings = async (settingsData: { imapSettings?: any, smtpSettings?: any }) => {
    if (!user?.propertyId) {
        toast({ title: t('toasts.save_settings_error_title'), description: t('toasts.save_settings_error_description'), variant: "destructive" });
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
        toast({ title: t('toasts.save_settings_error_title'), description: error.message, variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  // Check for guest portal notifications when not on guest portal tabs
  const checkGuestPortalNotifications = useCallback(async () => {
    if (!user?.propertyId || activeView.startsWith('channel_guest_portal') || activeView.startsWith('portal_')) {
      return; // Don't check if already on guest portal tabs
    }

    try {
      const response = await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/guestPortalChat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'getConversations', 
          data: { propertyId: user.propertyId },
          authToken: await auth.currentUser?.getIdToken()
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.conversations) {
          // Calculate total unread count from all conversations
          const totalUnread = result.conversations.reduce((total: number, conv: any) => {
            return total + (conv.unreadCount || 0);
          }, 0);
          setGuestPortalUnreadCount(totalUnread);
        }
      }
    } catch (error) {
      // Silently handle errors to avoid console spam
      console.warn('Failed to check guest portal notifications:', error);
    }
  }, [user?.propertyId, activeView]);

  useEffect(() => {
    // Check notifications every 5 seconds when not on guest portal tabs
    const interval = setInterval(checkGuestPortalNotifications, 5000);
    return () => clearInterval(interval);
  }, [checkGuestPortalNotifications]);

  // Clear guest portal notifications when switching to guest portal tabs
  useEffect(() => {
    if (activeView.startsWith('channel_guest_portal') || activeView.startsWith('portal_')) {
      setGuestPortalUnreadCount(0);
    }
  }, [activeView]);

  const handleReply = (email: Email) => {
    setReplyingToEmail(email);
    setIsReplyModalOpen(true);
  };

  const handleChannelChangeFromThread = (channel: 'all' | 'email' | 'whatsapp' | 'sms' | 'guest_portal') => {
    if (channel === 'all') {
      setActiveView('inbox_all');
      return;
    }
    if (channel === 'email') {
      setActiveView('inbox_all');
      return;
    }
    if (channel === 'whatsapp') {
      setActiveView('whatsapp');
      return;
    }
    if (channel === 'guest_portal') {
      setActiveView('channel_guest_portal');
      return;
    }
    toast({ title: 'SMS channel', description: 'SMS channel view will be available soon.' });
  };
  
  // Email action handlers
  const handleStar = async (email: Email) => {
    toast({ title: email.starred ? "Unstarred" : "Starred", description: "Email updated" });
    // TODO: Implement Firebase update for starred status
  };

  const handleArchive = async (email: Email) => {
    toast({ title: "Archived", description: "Email moved to archive" });
    // TODO: Implement Firebase update for archived status
    setSelectedEmail(null);
  };

  const handleDelete = async (email: Email) => {
    toast({ title: "Deleted", description: "Email moved to trash" });
    // TODO: Implement Firebase update for deletion
    setSelectedEmail(null);
  };

  const handleMarkUnread = async (email: Email) => {
    toast({ title: "Marked as unread", description: "Email updated" });
    // TODO: Implement Firebase update for unread status
  };

  const handleForward = (email: Email) => {
    toast({ title: "Forward", description: "Forward feature coming soon" });
    // TODO: Implement forward email modal
  };

  const handleAddLabel = (email: Email) => {
    setEmailForLabeling(email);
    setLabelManagerOpen(true);
  };

  const handleApplyLabels = (labels: string[]) => {
    if (emailForLabeling) {
      toast({ 
        title: "Labels updated", 
        description: `Applied ${labels.length} label${labels.length !== 1 ? 's' : ''}`,
        className: "bg-green-50 border-green-200"
      });
      // TODO: Update Firebase with new labels
    }
  };
  
  const handleSelectEmail = async (
    emailToSelect: Email,
    initialChannel: ThreadChannel = 'all',
    options?: { promptSubjectForEmail?: boolean }
  ) => {
    const readOptimistically = { ...emailToSelect, unread: false };
    setSelectedEmail(readOptimistically);
    setSelectedThreadChannel(initialChannel);
    setIsSelectedThreadNewConversation(false);
    setShouldPromptSubjectForSelectedThread(Boolean(options?.promptSubjectForEmail));
    setSelectedThreadContactPhone('');

    if (emailToSelect.unread) {
      const optimisticKey = getOptimisticEmailKey(emailToSelect);
      setOptimisticallyReadEmailKeys(prev => prev.includes(optimisticKey) ? prev : [...prev, optimisticKey]);
        try {
        if (user?.propertyId) {
          const markReadResult = await emailApi.markRead(
            user.propertyId,
            emailToSelect.id ? [emailToSelect.id] : [],
            Number.isFinite(emailToSelect.uid) ? [Number(emailToSelect.uid)] : []
          );
          if (!markReadResult?.success) {
            throw new Error('Failed to mark email as read in communication API');
          }
        }

        // Best effort: keep external mailbox flags in sync for other mail apps.
        const token = await auth.currentUser?.getIdToken();
        if (token) {
          await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/markEmailAsRead', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ messageUid: emailToSelect.uid })
          });
        }
            safeRefetchEmails();
        } catch (error: any) {
            console.error("Failed to mark email as read on server:", error);
            setOptimisticallyReadEmailKeys(prev => prev.filter(key => key !== getOptimisticEmailKey(emailToSelect)));
            setSelectedEmail(emailToSelect);
            toast({
                title: t('toasts.mark_read_error_title'),
                description: t('toasts.mark_read_error_description'),
                variant: "destructive"
            });
        }
    }
  };

  const handleStartConversation = async (result: ConversationSearchResult, channel: ConversationChannel) => {
    const resultEmail = String(result.email || '').trim().toLowerCase();
    const existing = resultEmail
      ? displayEmails.find((email) => String(email.from?.email || '').trim().toLowerCase() === resultEmail)
      : undefined;

    setIsNewConversationOpen(false);
    setActiveView('inbox_all');

    if (existing) {
      const existingKey = getConversationKey(existing);
      const resolvedDisplayName = String(result.guestName || '').trim();
      if (resolvedDisplayName) {
        setConversationDisplayNames((prev) => ({ ...prev, [existingKey]: resolvedDisplayName }));
      }
      await handleSelectEmail(existing, channel, {
        promptSubjectForEmail: channel === 'email',
      });
      return;
    }

    const synthetic: Email = {
      uid: 0,
      from: {
        name: result.guestName || 'Guest',
        email: resultEmail || `guest-${Date.now()}@unknown.local`,
      },
      subject: result.reservationNumber
        ? `Reservation ${result.reservationNumber}`
        : 'New conversation',
      date: new Date().toISOString(),
      snippet: '',
      body: '',
      unread: false,
      starred: false,
      archived: false,
      labels: [],
      attachments: [],
    };

    const manualKey = getConversationKey(synthetic);
    const resolvedDisplayName = String(result.guestName || '').trim();
    if (resolvedDisplayName) {
      setConversationDisplayNames((prev) => ({ ...prev, [manualKey]: resolvedDisplayName }));
    }
    setManualConversationKeys((prev) => (prev.includes(manualKey) ? prev : [...prev, manualKey]));
    setOptimisticSentEmails((prev) => {
      const exists = prev.some((item) => getEmailIdentity(item) === getEmailIdentity(synthetic));
      return exists ? prev : [synthetic, ...prev];
    });

    setSelectedEmail(synthetic);
    setSelectedThreadChannel(channel);
    setIsSelectedThreadNewConversation(true);
    setShouldPromptSubjectForSelectedThread(channel === 'email');
    setSelectedThreadContactPhone(String(result.phone || '').trim());
  };

  const handleThreadEmailSent = (sentEmail: Email, options?: { isFirstMessage?: boolean }) => {
    const manualKey = getConversationKey(sentEmail);
    setManualConversationKeys((prev) => (prev.includes(manualKey) ? prev : [...prev, manualKey]));
    setConversationDisplayNames((prev) => {
      if (prev[manualKey]) return prev;
      const fallbackName = String(selectedEmail?.from?.name || sentEmail.from?.name || '').trim();
      if (!fallbackName) return prev;
      return { ...prev, [manualKey]: fallbackName };
    });

    setOptimisticSentEmails((prev) => {
      const exists = prev.some((item) => getEmailIdentity(item) === getEmailIdentity(sentEmail));
      if (exists) return prev;
      return [sentEmail, ...prev];
    });

    if (options?.isFirstMessage) {
      setIsSelectedThreadNewConversation(false);
      setShouldPromptSubjectForSelectedThread(false);
      setSelectedEmail(sentEmail);
    }
  };

  if (isLoadingAuth) {
    return <div className="flex h-screen items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user?.permissions?.guests) {
    return (
      <div className="h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <Icons.AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('access_denied.title')}</AlertTitle>
          <AlertDescription>
            {t('access_denied.description')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white border border-slate-200" style={{ height: 'calc(96vh - var(--app-header-height))' }}>
      <div className="flex h-full min-w-0">
        <aside className="flex w-[320px] shrink-0 flex-col border-r border-slate-200 bg-slate-50">
          <div className="flex-shrink-0 border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-sm font-semibold text-slate-900">{t('nav.inbox_header')}</h1>
                <p className="text-[11px] text-slate-500">Conversation list</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsNewConversationOpen(true)}
                  title="Start new conversation"
                >
                  <MailPlus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => safeRefetchEmails()}
                  disabled={isLoadingEmails || isSyncingEmails || isEmailSyncOnCooldown}
                  title="Refresh"
                >
                  {(isLoadingEmails || isSyncingEmails) ? <Icons.Spinner className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <div className="relative">
                <Icons.Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  placeholder="Search name, phone, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm outline-none transition-all focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  All conversations
                </h3>
                <span className="text-[10px] text-slate-400">{currentList.length} threads</span>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="divide-y divide-slate-100 bg-white">
              {currentList.length > 0 ? (
                groupedConversations.map((group) => (
                  <section key={group.label} className="px-2 py-2">
                    <h4 className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{group.label}</h4>
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      {group.items.map((conversation) => {
                        const email = conversation.latestEmail;
                        const latestThreadEmail = conversationHistoryByKey.get(conversation.key)?.[0] || email;
                        const emailDate = new Date(latestThreadEmail.date);
                        const formattedDate = isValid(emailDate) ? format(emailDate, 'p') : '—';
                        const isSelected = selectedEmail && getConversationKey(selectedEmail) === conversation.key;

                        return (
                          <button
                            key={conversation.key}
                            type="button"
                            onClick={() => handleSelectEmail(email)}
                            className={cn(
                              'block w-full border-b border-slate-100 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50',
                              isSelected && 'bg-slate-50',
                              conversation.unreadCount > 0 && 'bg-blue-50/40'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-2">
                                {conversation.unreadCount > 0 && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                                <span className={cn('truncate text-sm', conversation.unreadCount > 0 ? 'font-semibold text-slate-900' : 'font-medium text-slate-700')}>
                                  {conversation.contactName}
                                </span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {getConversationChannels(conversation).map((channel) => (
                                    <Badge key={channel} variant="outline" className={cn('h-5 rounded-full px-2 text-[10px] font-medium', getChannelBadgeClassName(channel))}>
                                      {channel}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <span className="text-[11px] font-medium text-slate-400">{formattedDate}</span>
                                <Badge
                                  variant="outline"
                                  className={cn('h-5 rounded-full px-2 text-[10px] font-medium', getStatusBadgeClassName(latestThreadEmail))}
                                >
                                  {getLastMessageStatus(latestThreadEmail)}
                                </Badge>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">No conversations</div>
              )}
            </div>
          </ScrollArea>
        </aside>

        <main className="flex-1 min-w-0 bg-white">
          {selectedEmail ? (
            <EmailDetailView
              email={selectedEmail}
              onBack={() => setSelectedEmail(null)}
              onReply={handleReply}
              onForward={handleForward}
              onStar={handleStar}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onMarkUnread={handleMarkUnread}
              onAddLabel={handleAddLabel}
              conversationHistory={isSelectedThreadNewConversation ? [] : selectedConversationHistory}
              onChannelChange={handleChannelChangeFromThread}
              onRefreshEmails={safeRefetchEmails}
              initialChannel={selectedThreadChannel}
              isNewConversation={isSelectedThreadNewConversation}
              requireManualEmailSubject={shouldPromptSubjectForSelectedThread}
              initialContactPhone={selectedThreadContactPhone}
              onNewEmailSent={handleThreadEmailSent}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-slate-50/30 text-center">
              <div className="max-w-sm space-y-3 px-6">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
                  <MessageSquare className="h-8 w-8 text-slate-300" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Select a conversation</h2>
                <p className="text-sm text-slate-400">Choose a message from the left panel to view details and reply.</p>
              </div>
            </div>
          )}
        </main>
      </div>

      <NewConversationDialog
        open={isNewConversationOpen}
        onOpenChange={setIsNewConversationOpen}
        propertyId={user?.propertyId || ''}
        onStartConversation={handleStartConversation}
      />

      {/* Reply Modal */}
      <Dialog open={isReplyModalOpen} onOpenChange={setIsReplyModalOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('modals.reply_title', { name: replyingToEmail?.from?.name || replyingToEmail?.from?.email || 'Guest' })}</DialogTitle>
            <DialogDescription>{t('modals.reply_description')}</DialogDescription>
          </DialogHeader>
          {replyingToEmail && (
            <ReplyEmailForm
              originalEmail={{
                id: replyingToEmail.id || '',
                from_name: replyingToEmail.from?.name,
                from_email: replyingToEmail.from?.email,
                from: replyingToEmail.from,
                subject: replyingToEmail.subject,
                body_text: replyingToEmail.bodyText || replyingToEmail.body || '',
                body_html: replyingToEmail.bodyHtml || '',
                date: replyingToEmail.date,
              }}
              onClose={() => { setIsReplyModalOpen(false); setReplyingToEmail(null); }}
              onSent={(sent) => {
                // Optimistically add reply to conversation and sent mailbox
                if (sent && selectedEmail) {
                  const optimistic: Email = {
                    ...sent,
                    uid: Math.random(),
                    id: undefined,
                    unread: false,
                    starred: false,
                    archived: false,
                    labels: [],
                    attachments: sent.attachments || [],
                    snippet: sent.body.slice(0, 150),
                    date: sent.date,
                    // Keep thread key aligned with the conversation contact.
                    from: selectedEmail.from,
                    body: sent.body,
                  };
                  setOptimisticSentEmails(prev => [optimistic, ...prev]);
                  setSelectedEmail(optimistic);
                  safeRefetchEmails();
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Label Manager */}
      <LabelManager
        open={labelManagerOpen}
        onClose={() => {
          setLabelManagerOpen(false);
          setEmailForLabeling(null);
        }}
        currentLabels={emailForLabeling?.labels || []}
        onApplyLabels={handleApplyLabels}
      />
    </div>
  );
}
