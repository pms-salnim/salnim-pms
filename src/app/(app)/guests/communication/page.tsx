
"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { useAuth } from '@/contexts/auth-context';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Archive, Mail, MessageSquare, Bot, Settings, Bell, MessageCircle, RefreshCw, MailPlus, Inbox, Paperclip, ChevronLeft, ChevronRight, Send, MailWarning, AlertCircle, Trash2, Users, UserCheck, CalendarClock, LogOut, CheckCircle2, X, Search, Star, Pin, PinOff, ArchiveRestore, Info, Clock, BedDouble, ChevronsUp, CheckSquare, Square, ArrowDownCircle, Reply } from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import type { Guest } from '@/types/guest';
import type { Reservation } from '@/types/reservation';
import { createClient } from '@/utils/supabase/client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import GuestPortalChatView from '@/components/guests/communication/GuestPortalChatView';
import WhatsAppChatView from '@/components/guests/communication/WhatsAppChatView';
import ReservationDetailModal from '@/components/reservations/reservation-detail-modal';

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
type ThreadMailbox = 'all' | 'pinned' | 'archived' | 'trash' | 'needs_reply';
type PendingThreadAction = {
  type: 'archive' | 'move_to_trash' | 'permanent_delete';
  conversationKeys: string[];
  isBulk: boolean;
} | null;

const GuestProfile = dynamic(() => import('@/components/guests/guest-profile'), {
  loading: () => <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});

const normalizePhone = (value?: string | null): string => String(value || '').replace(/\D/g, '');

const normalizeGuestFromRow = (guestRow: any): Guest => ({
  id: String(guestRow.id || ''),
  propertyId: String(guestRow.property_id || guestRow.propertyId || ''),
  fullName: String(
    guestRow.name
    || guestRow.full_name
    || guestRow.fullName
    || [guestRow.first_name, guestRow.last_name].filter(Boolean).join(' ').trim()
    || 'Guest'
  ),
  firstName: guestRow.first_name || guestRow.firstName || '',
  lastName: guestRow.last_name || guestRow.lastName || '',
  email: String(guestRow.email || ''),
  phone: String(guestRow.phone || ''),
  nationality: String(guestRow.nationality || guestRow.country || ''),
  country: String(guestRow.country || guestRow.nationality || ''),
  passportOrId: guestRow.passport_id || guestRow.passportOrId,
  loyaltyStatus: guestRow.loyalty_status || guestRow.loyaltyStatus || 'not-enrolled',
  loyaltyPoints: guestRow.loyalty_points || guestRow.loyaltyPoints || 0,
  spendForNextPoint: guestRow.spend_for_next_point || guestRow.spendForNextPoint || 0,
  totalPointsEarned: guestRow.total_points_earned || guestRow.totalPointsEarned || 0,
  totalPointsRedeemed: guestRow.total_points_redeemed || guestRow.totalPointsRedeemed || 0,
  gender: guestRow.gender,
  birthdate: guestRow.birthdate,
  address: guestRow.address,
  internalNotes: guestRow.notes || guestRow.internal_notes || '',
  roomPreferences: guestRow.room_preferences || '',
  dietaryRestrictions: guestRow.dietary_restrictions || '',
  specialOccasion: guestRow.special_occasion || '',
  communicationPreference: guestRow.communication_preference || '',
});

const normalizeReservationFromRow = (reservationRow: any): Reservation => ({
  id: String(reservationRow.id || ''),
  propertyId: String(reservationRow.propertyId || reservationRow.property_id || ''),
  guestId: reservationRow.guestId || reservationRow.guest_id || null,
  guestName: reservationRow.guestName || reservationRow.guest_name,
  guestEmail: reservationRow.guestEmail || reservationRow.guest_email,
  guestPhone: reservationRow.guestPhone || reservationRow.guest_phone,
  guestPassportOrId: reservationRow.guestPassportOrId || reservationRow.guest_passport_id,
  guestCountry: reservationRow.guestCountry || reservationRow.guest_country,
  source: reservationRow.source,
  rooms: reservationRow.rooms || reservationRow.rooms_data || [],
  startDate: reservationRow.startDate ? new Date(reservationRow.startDate) : reservationRow.start_date ? new Date(reservationRow.start_date) : new Date(),
  endDate: reservationRow.endDate ? new Date(reservationRow.endDate) : reservationRow.end_date ? new Date(reservationRow.end_date) : new Date(),
  status: reservationRow.status || 'Pending',
  reservationNumber: reservationRow.reservationNumber || reservationRow.reservation_number,
  totalPrice: reservationRow.totalPrice || reservationRow.total_price || 0,
  priceBeforeDiscount: reservationRow.priceBeforeDiscount || reservationRow.price_before_discount || 0,
  notes: reservationRow.notes,
  paymentStatus: reservationRow.paymentStatus || reservationRow.payment_status,
  partialPaymentAmount: reservationRow.partialPaymentAmount || reservationRow.partial_payment_amount,
  paidWithPoints: reservationRow.paidWithPoints || reservationRow.paid_with_points,
  createdAt: reservationRow.createdAt ? new Date(reservationRow.createdAt) : reservationRow.created_at ? new Date(reservationRow.created_at) : undefined,
  updatedAt: reservationRow.updatedAt ? new Date(reservationRow.updatedAt) : reservationRow.updated_at ? new Date(reservationRow.updated_at) : undefined,
  actualCheckInTime: reservationRow.actualCheckInTime || reservationRow.actual_check_in_time,
  actualCheckOutTime: reservationRow.actualCheckOutTime || reservationRow.actual_check_out_time,
  isCheckedOut: reservationRow.isCheckedOut || reservationRow.is_checked_out || false,
  selectedExtras: reservationRow.selectedExtras || reservationRow.selected_extras,
  promotionApplied: reservationRow.promotionApplied || reservationRow.promotion_applied,
  packageInfo: reservationRow.packageInfo || reservationRow.package_info,
  color: reservationRow.color,
  roomsTotal: reservationRow.roomsTotal || reservationRow.rooms_total,
  extrasTotal: reservationRow.extrasTotal || reservationRow.extras_total,
  subtotal: reservationRow.subtotal,
  discountAmount: reservationRow.discountAmount || reservationRow.discount_amount,
  netAmount: reservationRow.netAmount || reservationRow.net_amount,
  taxAmount: reservationRow.taxAmount || reservationRow.tax_amount,
  groupBooking: reservationRow.groupBooking || reservationRow.group_booking,
  groupName: reservationRow.groupName || reservationRow.group_name,
  companyName: reservationRow.companyName || reservationRow.company_name,
  roomId: reservationRow.roomId || '',
});

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
  const [persistedChannelSettings, setPersistedChannelSettings] = useState<any | null>(null);
  const [isLoadingChannelSettings, setIsLoadingChannelSettings] = useState(false);
  const [guestDirectory, setGuestDirectory] = useState<Guest[]>([]);
  const [guestReservations, setGuestReservations] = useState<Reservation[]>([]);
  const [isLoadingGuestPanel, setIsLoadingGuestPanel] = useState(false);
  const [isGuestInfoPanelOpen, setIsGuestInfoPanelOpen] = useState(false);
  const [isReservationDetailsOpen, setIsReservationDetailsOpen] = useState(false);
  const [selectedReservationForPanel, setSelectedReservationForPanel] = useState<Reservation | null>(null);
  const [threadMailbox, setThreadMailbox] = useState<ThreadMailbox>('all');
  const [pinnedConversationKeys, setPinnedConversationKeys] = useState<string[]>([]);
  const [archivedConversationKeys, setArchivedConversationKeys] = useState<string[]>([]);
  const [trashedConversationKeys, setTrashedConversationKeys] = useState<string[]>([]);
  const [starredConversationKeys, setStarredConversationKeys] = useState<string[]>([]);
  
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [bulkSelectedKeys, setBulkSelectedKeys] = useState<string[]>([]);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [pendingThreadAction, setPendingThreadAction] = useState<PendingThreadAction>(null);
  const unreadAnchorRef = useRef<HTMLDivElement | null>(null);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);
  const threadListRef = useRef<HTMLDivElement | null>(null);
  const filterChipsScrollRef = useRef<HTMLDivElement | null>(null);
  const filterScrollbarTrackRef = useRef<HTMLDivElement | null>(null);
  const [hasFilterChipsOverflow, setHasFilterChipsOverflow] = useState(false);
  const [filterScrollbarThumbWidthPct, setFilterScrollbarThumbWidthPct] = useState(0);
  const [filterScrollbarThumbLeftPct, setFilterScrollbarThumbLeftPct] = useState(0);
  const [isFilterScrollbarDragging, setIsFilterScrollbarDragging] = useState(false);
  
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
    const source = String((email as any)?.source || '').trim().toLowerCase();
    if (source === 'guest_portal') {
      const sourceReservationId = String((email as any)?.sourceReservationId || (email as any)?.source_reservation_id || '').trim();
      if (sourceReservationId) return `guest_portal_reservation:${sourceReservationId}`;

      const sourceConversationId = String((email as any)?.sourceConversationId || (email as any)?.source_conversation_id || '').trim();
      if (sourceConversationId) return `guest_portal:${sourceConversationId}`;
    }

    const senderEmail = String(email.from?.email || '').trim().toLowerCase();
    if (senderEmail) return `email:${senderEmail}`;
    const senderName = String(email.from?.name || '').trim().toLowerCase();
    if (senderName) return `name:${senderName}`;
    return `fallback:${getEmailIdentity(email)}`;
  };

  const syncFilterScrollbar = useCallback(() => {
    const el = filterChipsScrollRef.current;
    if (!el) {
      setHasFilterChipsOverflow(false);
      setFilterScrollbarThumbWidthPct(0);
      setFilterScrollbarThumbLeftPct(0);
      return;
    }

    const { scrollWidth, clientWidth, scrollLeft } = el;
    const hasOverflow = scrollWidth - clientWidth > 1;
    setHasFilterChipsOverflow(hasOverflow);

    if (!hasOverflow || scrollWidth <= 0) {
      setFilterScrollbarThumbWidthPct(0);
      setFilterScrollbarThumbLeftPct(0);
      return;
    }

    const thumbWidthPct = Math.max((clientWidth / scrollWidth) * 100, 18);
    const maxScrollLeft = Math.max(scrollWidth - clientWidth, 1);
    const thumbLeftPct = (scrollLeft / maxScrollLeft) * (100 - thumbWidthPct);

    setFilterScrollbarThumbWidthPct(thumbWidthPct);
    setFilterScrollbarThumbLeftPct(thumbLeftPct);
  }, []);

  const handleFilterScrollbarTrackMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const scrollEl = filterChipsScrollRef.current;
    const trackEl = event.currentTarget;
    if (!scrollEl) return;

    event.preventDefault();

    const rect = trackEl.getBoundingClientRect();
    const trackWidth = rect.width;
    if (trackWidth <= 0) return;

    const thumbWidthPx = (filterScrollbarThumbWidthPct / 100) * trackWidth;
    const maxThumbLeft = Math.max(trackWidth - thumbWidthPx, 1);
    const clickedX = event.clientX - rect.left;
    const thumbLeftPx = Math.min(
      Math.max(clickedX - thumbWidthPx / 2, 0),
      maxThumbLeft
    );

    const ratio = thumbLeftPx / maxThumbLeft;
    const maxScrollLeft = Math.max(scrollEl.scrollWidth - scrollEl.clientWidth, 0);
    scrollEl.scrollLeft = ratio * maxScrollLeft;
    syncFilterScrollbar();
  }, [filterScrollbarThumbWidthPct, syncFilterScrollbar]);

  const handleFilterScrollbarThumbMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const scrollEl = filterChipsScrollRef.current;
    const trackEl = filterScrollbarTrackRef.current;
    if (!scrollEl || !trackEl) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = trackEl.getBoundingClientRect();
    const trackWidth = rect.width;
    const thumbWidthPx = (filterScrollbarThumbWidthPct / 100) * trackWidth;
    const maxThumbTravelPx = Math.max(trackWidth - thumbWidthPx, 1);
    const maxScrollLeft = Math.max(scrollEl.scrollWidth - scrollEl.clientWidth, 0);

    if (maxScrollLeft <= 0) return;

    const startClientX = event.clientX;
    const startScrollLeft = scrollEl.scrollLeft;
    setIsFilterScrollbarDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startClientX;
      const deltaScroll = (deltaX / maxThumbTravelPx) * maxScrollLeft;
      const nextScrollLeft = Math.min(Math.max(startScrollLeft + deltaScroll, 0), maxScrollLeft);
      scrollEl.scrollLeft = nextScrollLeft;
      syncFilterScrollbar();
    };

    const onMouseUp = () => {
      setIsFilterScrollbarDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [filterScrollbarThumbWidthPct, syncFilterScrollbar]);

  useEffect(() => {
    syncFilterScrollbar();

    const el = filterChipsScrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      syncFilterScrollbar();
    });

    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    window.addEventListener('resize', syncFilterScrollbar);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncFilterScrollbar);
    };
  }, [syncFilterScrollbar, sidebarCollapsed, selectedEmail]);

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

  const getStatusBadgeClassName = (email: Email, isTrashed = false) => {
    if (isTrashed) {
      return 'border-red-200 bg-red-50 text-red-600 hover:bg-red-50';
    }

    return isSentEmail(email)
      ? 'border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-600'
      : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100';
  };

  const getLastMessageStatus = (email: Email, isTrashed = false) => (isTrashed ? 'trash' : (isSentEmail(email) ? 'replied' : 'not replied'));

  const isSentEmail = useCallback((email: Email) => {
    const source = String((email as any)?.source || '').trim().toLowerCase();
    if (source === 'guest_portal') {
      const senderType = String((email as any)?.sourceSenderType || (email as any)?.source_sender_type || '').trim().toLowerCase();
      if (senderType) return senderType === 'property';
    }

    // DB-persisted outgoing emails are stored with null uid and are mapped to uid 0 in client state.
    if (!email.uid || Number(email.uid) <= 0) return true;

    const fromEmail = String(email.from?.email || '').trim().toLowerCase();
    const userEmail = String(user?.email || '').trim().toLowerCase();
    const smtpUser = String((property as any)?.emailConfiguration?.smtpUser || '').trim().toLowerCase();

    return !!fromEmail && (fromEmail === userEmail || (smtpUser && fromEmail === smtpUser));
  }, [property, user?.email]);

  const getThreadPreviewText = useCallback((email: Email) => {
    const rawPreview = String(email.bodyText || email.body || email.snippet || email.subject || '')
      .replace(/\s+/g, ' ')
      .trim();

    return rawPreview || 'No message preview available';
  }, []);

  const getThreadPreviewLabel = useCallback((email: Email) => {
    return isSentEmail(email) ? 'You' : 'Guest';
  }, [isSentEmail]);

  useEffect(() => {
    let isMounted = true;

    const loadCommunicationSettings = async () => {
      if (!user?.propertyId) {
        if (isMounted) {
          setPersistedChannelSettings(null);
          setIsLoadingChannelSettings(false);
        }
        return;
      }

      if (isMounted) {
        setIsLoadingChannelSettings(true);
      }

      try {
        const url = new URL('/api/property-settings/communication-channels', window.location.origin);
        url.searchParams.set('propertyId', user.propertyId);

        const response = await fetch(url.toString(), {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          if (isMounted) {
            setPersistedChannelSettings(null);
          }
          return;
        }

        const data = await response.json();
        if (isMounted) {
          setPersistedChannelSettings(data?.settings || null);
        }
      } catch (error) {
        if (isMounted) {
          setPersistedChannelSettings(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingChannelSettings(false);
        }
      }
    };

    loadCommunicationSettings();

    return () => {
      isMounted = false;
    };
  }, [user?.propertyId]);

  const hasImapChannelConfigured = useCallback((): boolean => {
    if (!property && !persistedChannelSettings) return false;

    const prop = property as any;
    const imap =
      prop?.imapConfiguration
      || persistedChannelSettings?.imapSettings
      || persistedChannelSettings?.imapConfiguration
      || persistedChannelSettings?.imap_configuration
      || persistedChannelSettings?.imap;

    return !!(
      (imap?.host || imap?.imapHost) &&
      (imap?.user || imap?.imapUser)
    );
  }, [persistedChannelSettings, property]);

  // Check if any communication channels are configured
  const hasAnyCommunicationChannels = useCallback((): boolean => {
    if (!property && !persistedChannelSettings) return false;
    
    const prop = property as any;
    const persisted = persistedChannelSettings as any;

    const smtpConfig =
      prop?.emailConfiguration
      || persisted?.smtpSettings
      || persisted?.emailConfiguration
      || persisted?.email;
    
    // Check for email configuration (SMTP)
    const hasEmailConfig = !!(
      (smtpConfig?.smtpUser || smtpConfig?.user) &&
      (smtpConfig?.smtpHost || smtpConfig?.host)
    );

    // Check for inbound email channel (IMAP)
    const hasImapConfig = hasImapChannelConfigured();
    
    // Check for WhatsApp integration
    const whatsappIntegration = prop?.whatsappIntegration || persisted?.whatsappIntegration || persisted?.whatsapp;
    const hasWhatsApp = !!(whatsappIntegration?.enabled && whatsappIntegration?.accessToken);
    
    // Check for guest portal (basic check - if the property has guest portal settings)
    const guestPortal = prop?.guestPortal || persisted?.guestPortal;
    const hasGuestPortal = !!(guestPortal?.enabled);
    
    return hasEmailConfig || hasImapConfig || hasWhatsApp || hasGuestPortal;
  }, [hasImapChannelConfigured, persistedChannelSettings, property]);
  
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

  const { currentList, totalPages, totalConversationCount } = useMemo<{ currentList: EmailConversation[]; totalPages: number; totalConversationCount: number }>(() => {
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

    let conversations: EmailConversation[] = Array.from(conversationMap.entries()).map(([key, messages]) => {
      const sortedMessages = [...messages].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latestEmail = sortedMessages[0];
      return {
        key,
        contactName: conversationDisplayNames[key] || latestEmail.from?.name || latestEmail.from?.email || 'Unknown sender',
        contactEmail: latestEmail.from?.email || '',
        latestEmail,
        messages: sortedMessages,
        unreadCount: sortedMessages.filter((item) => item.unread).length,
      };
    });

    conversations = conversations.filter((conversation) => {
      const key = conversation.key;
      const messages = conversationHistoryByKey.get(key) || conversation.messages;
      const isDbTrashed = messages.length > 0 && messages.every((message) => !!(message as any).trash);
      const isTrashed = isDbTrashed || trashedConversationKeys.includes(key);
      const isDbArchived = !isDbTrashed && messages.length > 0 && messages.every((message) => !!message.archived);
      const isArchived = !isTrashed && (isDbArchived || archivedConversationKeys.includes(key));
      const isPinned = pinnedConversationKeys.includes(key);

      if (threadMailbox === 'archived') return isArchived && !isTrashed;
      if (threadMailbox === 'trash') return isTrashed;
      if (threadMailbox === 'pinned') return isPinned && !isArchived && !isTrashed;
      if (threadMailbox === 'needs_reply') {
        if (isArchived || isTrashed) return false;
        const msgs = conversationHistoryByKey.get(key) || conversation.messages;
        const latest = msgs[0] || conversation.latestEmail;
        const hasUnread = msgs.some((message) => !!message.unread);
        const needsReply = latest ? !isSentEmail(latest) : false;
        return hasUnread || needsReply;
      }
      return !isArchived && !isTrashed;
    });

    conversations = conversations.sort((a, b) => {
      const aPinned = pinnedConversationKeys.includes(a.key) ? 1 : 0;
      const bPinned = pinnedConversationKeys.includes(b.key) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.latestEmail.date).getTime() - new Date(a.latestEmail.date).getTime();
    });
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    return {
      currentList: conversations.slice(startIndex, endIndex),
      totalPages: Math.ceil(conversations.length / itemsPerPage) || 1,
      totalConversationCount: conversations.length,
    };
  }, [archivedConversationKeys, conversationDisplayNames, conversationHistoryByKey, currentPage, displayEmails, filterAttachments, filterStarred, filterUnread, isSentEmail, itemsPerPage, pinnedConversationKeys, searchQuery, threadMailbox, trashedConversationKeys]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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

  // SLA: minutes since last inbound message when it hasn't been replied to yet
  const getSlaInfo = useCallback((conversation: EmailConversation): { label: string; urgent: boolean } | null => {
    const latestMsg = conversationHistoryByKey.get(conversation.key)?.[0];
    if (!latestMsg || isSentEmail(latestMsg)) return null; // last msg was sent by us — no SLA pending
    const minutesAgo = Math.floor((Date.now() - new Date(latestMsg.date).getTime()) / 60000);
    if (minutesAgo < 30) return null; // not overdue yet
    const urgent = minutesAgo >= 120;
    if (minutesAgo < 60) return { label: `${minutesAgo}m`, urgent };
    if (minutesAgo < 1440) return { label: `${Math.floor(minutesAgo / 60)}h`, urgent };
    return { label: `${Math.floor(minutesAgo / 1440)}d`, urgent };
  }, [conversationHistoryByKey, isSentEmail]);

  // Current stay indicator: find checked-in reservation matching conversation contact
  const getActiveStay = useCallback((conversation: EmailConversation): Reservation | null => {
    const contactEmail = String(conversation.contactEmail || '').trim().toLowerCase();
    const contactName = String(conversation.contactName || '').trim().toLowerCase();
    const today = new Date();
    return guestReservations.find((res) => {
      const matchEmail = contactEmail && String(res.guestEmail || '').trim().toLowerCase() === contactEmail;
      const matchName = contactName && String(res.guestName || '').trim().toLowerCase() === contactName;
      if (!matchEmail && !matchName) return false;
      const start = res.startDate instanceof Date ? res.startDate : new Date(res.startDate);
      const end = res.endDate instanceof Date ? res.endDate : new Date(res.endDate);
      // Only show as checked-in if status is explicitly 'Checked-in' AND within stay dates
      return start <= today && end >= today && res.status === 'Checked-in';
    }) || null;
  }, [guestReservations]);


  const safeRefetchEmails = useCallback(() => {
    if (user?.propertyId) {
      refetchEmails();
    }
  }, [user?.propertyId, refetchEmails]);

  const forceRefetchEmails = useCallback(() => {
    if (user?.propertyId) {
      // Automatic page refreshes should not show destructive toasts.
      refetchEmails(true, true);
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

  useEffect(() => {
    if (!user?.propertyId) {
      setGuestDirectory([]);
      setGuestReservations([]);
      return;
    }

    let cancelled = false;

    const loadGuestPanelData = async () => {
      setIsLoadingGuestPanel(true);
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) return;

        const [guestResponse, reservationResponse] = await Promise.all([
          supabase
            .from('guests')
            .select('*')
            .eq('property_id', user.propertyId)
            .order('updated_at', { ascending: false }),
          fetch(`/api/reservations/list?propertyId=${encodeURIComponent(user.propertyId)}`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }),
        ]);

        if (guestResponse.error) {
          throw guestResponse.error;
        }

        const reservationPayload = await reservationResponse.json();
        if (!reservationResponse.ok) {
          throw new Error(String(reservationPayload?.error || 'Failed to load reservations for guest panel'));
        }

        if (cancelled) return;

        setGuestDirectory((guestResponse.data || []).map(normalizeGuestFromRow));
        setGuestReservations((reservationPayload?.reservations || []).map(normalizeReservationFromRow));
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load guest profile panel data:', error);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingGuestPanel(false);
        }
      }
    };

    loadGuestPanelData();

    return () => {
      cancelled = true;
    };
  }, [user?.propertyId]);

  const emailSyncCooldownMs = 2 * 60 * 1000;
  const isEmailSyncOnCooldown = lastEmailSyncAt ? (Date.now() - lastEmailSyncAt) < emailSyncCooldownMs : false;
  const lastSyncLabel = lastEmailSyncAt ? format(new Date(lastEmailSyncAt), 'PPp') : 'Never';

  const threadStoragePrefix = useMemo(() => {
    const propertyId = String(user?.propertyId || 'default');
    return `communication-threads:${propertyId}`;
  }, [user?.propertyId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const pinnedRaw = window.localStorage.getItem(`${threadStoragePrefix}:pinned`);
      const archivedRaw = window.localStorage.getItem(`${threadStoragePrefix}:archived`);
      const trashedRaw = window.localStorage.getItem(`${threadStoragePrefix}:trashed`);
      const starredRaw = window.localStorage.getItem(`${threadStoragePrefix}:starred`);
      setPinnedConversationKeys(pinnedRaw ? JSON.parse(pinnedRaw) : []);
      setArchivedConversationKeys(archivedRaw ? JSON.parse(archivedRaw) : []);
      setTrashedConversationKeys(trashedRaw ? JSON.parse(trashedRaw) : []);
      setStarredConversationKeys(starredRaw ? JSON.parse(starredRaw) : []);
    } catch {
      setPinnedConversationKeys([]);
      setArchivedConversationKeys([]);
      setTrashedConversationKeys([]);
      setStarredConversationKeys([]);
    }
  }, [threadStoragePrefix]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`${threadStoragePrefix}:pinned`, JSON.stringify(pinnedConversationKeys));
  }, [pinnedConversationKeys, threadStoragePrefix]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`${threadStoragePrefix}:archived`, JSON.stringify(archivedConversationKeys));
  }, [archivedConversationKeys, threadStoragePrefix]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`${threadStoragePrefix}:trashed`, JSON.stringify(trashedConversationKeys));
  }, [threadStoragePrefix, trashedConversationKeys]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`${threadStoragePrefix}:starred`, JSON.stringify(starredConversationKeys));
  }, [starredConversationKeys, threadStoragePrefix]);

  const getThreadMessageRefs = useCallback((conversationKey: string) => {
    const threadMessages = conversationHistoryByKey.get(conversationKey) || [];
    const emailIds = Array.from(
      new Set(
        threadMessages
          .map((message) => String(message.id || '').trim())
          .filter(Boolean)
      )
    );

    const emailUids = Array.from(
      new Set(
        threadMessages
          .map((message) => Number(message.uid))
          .filter((uid) => Number.isFinite(uid) && uid > 0)
      )
    );

    return { threadMessages, emailIds, emailUids };
  }, [conversationHistoryByKey]);

  const isConversationPinned = useCallback((conversationKey: string) => pinnedConversationKeys.includes(conversationKey), [pinnedConversationKeys]);
  const isConversationArchived = useCallback((conversationKey: string, fallback?: Email[]) => {
    if (archivedConversationKeys.includes(conversationKey)) return true;

    const messages = fallback || conversationHistoryByKey.get(conversationKey) || [];
    if (messages.length === 0) return false;
    const isTrashed = messages.every((message) => !!(message as any).trash);
    if (isTrashed) return false;
    return messages.every((message) => !!message.archived);
  }, [archivedConversationKeys, conversationHistoryByKey]);
  const isConversationTrashed = useCallback((conversationKey: string, fallback?: Email[]) => {
    if (trashedConversationKeys.includes(conversationKey)) return true;

    const messages = fallback || conversationHistoryByKey.get(conversationKey) || [];
    if (messages.length === 0) return false;
    return messages.every((message) => !!(message as any).trash);
  }, [conversationHistoryByKey, trashedConversationKeys]);
  const isConversationStarred = useCallback((conversationKey: string, fallback?: Email[]) => {
    if (starredConversationKeys.includes(conversationKey)) return true;
    const messages = fallback || conversationHistoryByKey.get(conversationKey) || [];
    return messages.some((message) => !!message.starred);
  }, [conversationHistoryByKey, starredConversationKeys]);

  const handleTogglePin = useCallback((conversationKey: string) => {
    setPinnedConversationKeys((prev) => prev.includes(conversationKey)
      ? prev.filter((key) => key !== conversationKey)
      : [conversationKey, ...prev]
    );
  }, []);

  const handleToggleStarThread = useCallback(async (conversationKey: string) => {
    const currentlyStarred = isConversationStarred(conversationKey);
    const { emailIds } = getThreadMessageRefs(conversationKey);

    setStarredConversationKeys((prev) => currentlyStarred
      ? prev.filter((key) => key !== conversationKey)
      : [conversationKey, ...prev]
    );

    if (!user?.propertyId || emailIds.length === 0) return;

    const response = currentlyStarred
      ? await emailApi.unstar(user.propertyId, emailIds)
      : await emailApi.star(user.propertyId, emailIds);

    if (!response?.success) {
      setStarredConversationKeys((prev) => currentlyStarred
        ? [conversationKey, ...prev.filter((key) => key !== conversationKey)]
        : prev.filter((key) => key !== conversationKey)
      );
      toast({ title: 'Update failed', description: 'Could not update star status for this thread.', variant: 'destructive' });
      return;
    }

    safeRefetchEmails();
  }, [getThreadMessageRefs, isConversationStarred, safeRefetchEmails, user?.propertyId]);

  const handleArchiveThread = useCallback(async (conversationKey: string) => {
    const { emailIds } = getThreadMessageRefs(conversationKey);

    setArchivedConversationKeys((prev) => prev.includes(conversationKey) ? prev : [conversationKey, ...prev]);
    setTrashedConversationKeys((prev) => prev.filter((key) => key !== conversationKey));

    if (selectedEmail && getConversationKey(selectedEmail) === conversationKey) {
      setSelectedEmail(null);
    }

    if (!user?.propertyId || emailIds.length === 0) return;

    const response = await emailApi.archive(user.propertyId, emailIds);
    if (!response?.success) {
      setArchivedConversationKeys((prev) => prev.filter((key) => key !== conversationKey));
      toast({ title: 'Archive failed', description: 'Could not archive this thread.', variant: 'destructive' });
      return;
    }

    safeRefetchEmails();
  }, [getThreadMessageRefs, safeRefetchEmails, selectedEmail, user?.propertyId]);

  const handleUnarchiveThread = useCallback(async (conversationKey: string) => {
    const { emailIds } = getThreadMessageRefs(conversationKey);

    setArchivedConversationKeys((prev) => prev.filter((key) => key !== conversationKey));

    if (!user?.propertyId || emailIds.length === 0) return;

    const response = await emailApi.unarchive(user.propertyId, emailIds);
    if (!response?.success) {
      setArchivedConversationKeys((prev) => [conversationKey, ...prev.filter((key) => key !== conversationKey)]);
      toast({ title: 'Unarchive failed', description: 'Could not move this thread back to inbox.', variant: 'destructive' });
      return;
    }

    safeRefetchEmails();
  }, [getThreadMessageRefs, safeRefetchEmails, user?.propertyId]);

  const handleDeleteThread = useCallback(async (conversationKey: string) => {
    const { emailIds } = getThreadMessageRefs(conversationKey);

    setTrashedConversationKeys((prev) => prev.includes(conversationKey) ? prev : [conversationKey, ...prev]);
    setArchivedConversationKeys((prev) => prev.filter((key) => key !== conversationKey));

    if (selectedEmail && getConversationKey(selectedEmail) === conversationKey) {
      setSelectedEmail(null);
    }

    if (!user?.propertyId || emailIds.length === 0) return;

    const response = await emailApi.delete(user.propertyId, emailIds);
    if (!response?.success) {
      setTrashedConversationKeys((prev) => prev.filter((key) => key !== conversationKey));
      toast({ title: 'Delete failed', description: 'Could not move this thread to trash.', variant: 'destructive' });
      return;
    }

    safeRefetchEmails();
  }, [getThreadMessageRefs, safeRefetchEmails, selectedEmail, user?.propertyId]);

  const handlePermanentDeleteThread = useCallback(async (conversationKey: string) => {
    const { emailIds } = getThreadMessageRefs(conversationKey);

    setTrashedConversationKeys((prev) => prev.filter((key) => key !== conversationKey));

    if (selectedEmail && getConversationKey(selectedEmail) === conversationKey) {
      setSelectedEmail(null);
    }

    if (!user?.propertyId || emailIds.length === 0) return;

    const response = await emailApi.deletePermanently(user.propertyId, emailIds);
    if (!response?.success) {
      setTrashedConversationKeys((prev) => [conversationKey, ...prev.filter((key) => key !== conversationKey)]);
      toast({ title: 'Permanent delete failed', description: 'Could not permanently delete this thread.', variant: 'destructive' });
      return;
    }

    safeRefetchEmails();
  }, [getThreadMessageRefs, safeRefetchEmails, selectedEmail, user?.propertyId]);

  const handleRestoreThread = useCallback(async (conversationKey: string) => {
    const { emailIds } = getThreadMessageRefs(conversationKey);

    setTrashedConversationKeys((prev) => prev.filter((key) => key !== conversationKey));

    if (!user?.propertyId || emailIds.length === 0) return;

    const response = await emailApi.restore(user.propertyId, emailIds);
    if (!response?.success) {
      setTrashedConversationKeys((prev) => [conversationKey, ...prev.filter((key) => key !== conversationKey)]);
      toast({ title: 'Restore failed', description: 'Could not restore this thread.', variant: 'destructive' });
      return;
    }

    safeRefetchEmails();
  }, [getThreadMessageRefs, safeRefetchEmails, user?.propertyId]);

  const handleMarkThreadUnread = useCallback(async (conversationKey: string) => {
    const { threadMessages, emailIds } = getThreadMessageRefs(conversationKey);

    const threadOptimisticKeys = threadMessages.map(getOptimisticEmailKey);
    setOptimisticallyReadEmailKeys((prev) => prev.filter((key) => !threadOptimisticKeys.includes(key)));

    if (!user?.propertyId || emailIds.length === 0) return;

    const response = await emailApi.markUnread(user.propertyId, emailIds);
    if (!response?.success) {
      toast({ title: 'Update failed', description: 'Could not mark this thread as unread.', variant: 'destructive' });
      return;
    }

    safeRefetchEmails();
  }, [getThreadMessageRefs, safeRefetchEmails, user?.propertyId]);

  const handleMarkThreadRead = useCallback(async (conversationKey: string) => {
    const { threadMessages, emailIds, emailUids } = getThreadMessageRefs(conversationKey);

    const threadOptimisticKeys = threadMessages.map(getOptimisticEmailKey);
    setOptimisticallyReadEmailKeys((prev) => {
      const merged = new Set(prev);
      threadOptimisticKeys.forEach((key) => merged.add(key));
      return Array.from(merged);
    });

    if (!user?.propertyId || (emailIds.length === 0 && emailUids.length === 0)) return;

    const response = await emailApi.markRead(user.propertyId, emailIds, emailUids);
    if (!response?.success) {
      toast({ title: 'Update failed', description: 'Could not mark this thread as read.', variant: 'destructive' });
      return;
    }

    safeRefetchEmails();
  }, [getThreadMessageRefs, safeRefetchEmails, user?.propertyId]);

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
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/communication/guest-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          action: 'listConversations', 
          data: { propertyId: user.propertyId },
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.conversations) {
          // Calculate total unread count from all conversations
          const totalUnread = result.conversations.reduce((total: number, conv: any) => {
            return total + (conv.unreadCount || conv.unread_count || 0);
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
  
  // ── Bulk actions ──────────────────────────────────────────────────────────
  const handleBulkToggleSelect = useCallback((key: string) => {
    setBulkSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const handleBulkSelectAll = useCallback(() => {
    setBulkSelectedKeys(currentList.map((c) => c.key));
  }, [currentList]);

  const handleBulkClear = useCallback(() => {
    setBulkSelectedKeys([]);
    setIsBulkMode(false);
  }, []);

  const openThreadActionConfirm = useCallback((type: 'archive' | 'move_to_trash' | 'permanent_delete', conversationKeys: string[], isBulk = false) => {
    const uniqueKeys = Array.from(new Set(conversationKeys.filter(Boolean)));
    if (uniqueKeys.length === 0) return;
    setPendingThreadAction({ type, conversationKeys: uniqueKeys, isBulk });
  }, []);

  const handleBulkArchive = useCallback(() => {
    openThreadActionConfirm('archive', bulkSelectedKeys, true);
  }, [bulkSelectedKeys, openThreadActionConfirm]);

  const handleBulkDelete = useCallback(() => {
    const deleteType = threadMailbox === 'trash' ? 'permanent_delete' : 'move_to_trash';
    openThreadActionConfirm(deleteType, bulkSelectedKeys, true);
  }, [bulkSelectedKeys, openThreadActionConfirm, threadMailbox]);

  const handleBulkRestore = useCallback(async () => {
    for (const key of bulkSelectedKeys) await handleRestoreThread(key);
    toast({ title: `Recovered ${bulkSelectedKeys.length} thread(s)` });
    handleBulkClear();
  }, [bulkSelectedKeys, handleBulkClear, handleRestoreThread]);

  const handleBulkMarkRead = useCallback(async () => {
    for (const key of bulkSelectedKeys) await handleMarkThreadRead(key);
    toast({ title: `Marked ${bulkSelectedKeys.length} thread(s) as read` });
    handleBulkClear();
  }, [bulkSelectedKeys, handleBulkClear, handleMarkThreadRead]);

  const handleBulkMarkUnread = useCallback(async () => {
    for (const key of bulkSelectedKeys) await handleMarkThreadUnread(key);
    toast({ title: `Marked ${bulkSelectedKeys.length} thread(s) as unread` });
    handleBulkClear();
  }, [bulkSelectedKeys, handleBulkClear, handleMarkThreadUnread]);

  const handleBulkStar = useCallback(async () => {
    for (const key of bulkSelectedKeys) await handleToggleStarThread(key);
    toast({ title: `Starred ${bulkSelectedKeys.length} thread(s)` });
    handleBulkClear();
  }, [bulkSelectedKeys, handleToggleStarThread, handleBulkClear]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === 'j') {
        setCurrentPage((p) => {
          const idx = currentList.findIndex((c) => selectedEmail && getConversationKey(selectedEmail) === c.key);
          const next = currentList[idx + 1];
          if (next) handleSelectEmail(next.latestEmail, 'all', { markReadOnOpen: true });
          return p;
        });
      }
      if (e.key === 'k') {
        setCurrentPage((p) => {
          const idx = currentList.findIndex((c) => selectedEmail && getConversationKey(selectedEmail) === c.key);
          const prev = currentList[idx - 1];
          if (prev) handleSelectEmail(prev.latestEmail, 'all', { markReadOnOpen: true });
          return p;
        });
      }
      if (e.key === 'e' && selectedEmail) {
        e.preventDefault();
        handleArchive(selectedEmail);
      }
      if (e.key === '#' && selectedEmail) {
        e.preventDefault();
        handleDelete(selectedEmail);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentList, selectedEmail]);

  // Email action handlers
  const handleStar = async (email: Email) => {
    const conversationKey = getConversationKey(email);
    await handleToggleStarThread(conversationKey);
  };

  const handleArchive = async (email: Email) => {
    const conversationKey = getConversationKey(email);
    openThreadActionConfirm('archive', [conversationKey]);
  };

  const handleDelete = async (email: Email) => {
    const conversationKey = getConversationKey(email);
    const deleteType = isConversationTrashed(conversationKey) ? 'permanent_delete' : 'move_to_trash';
    openThreadActionConfirm(deleteType, [conversationKey]);
  };

  const executePendingThreadAction = useCallback(async () => {
    if (!pendingThreadAction) return;

    const { type, conversationKeys, isBulk } = pendingThreadAction;
    setPendingThreadAction(null);

    if (type === 'archive') {
      for (const key of conversationKeys) {
        await handleArchiveThread(key);
      }
      toast({ title: `Archived ${conversationKeys.length} thread(s)` });
    } else if (type === 'move_to_trash') {
      for (const key of conversationKeys) {
        await handleDeleteThread(key);
      }
      toast({ title: `Moved ${conversationKeys.length} thread(s) to trash` });
    } else {
      for (const key of conversationKeys) {
        await handlePermanentDeleteThread(key);
      }
      toast({ title: `Permanently deleted ${conversationKeys.length} thread(s)` });
    }

    if (isBulk) {
      handleBulkClear();
    }
  }, [handleArchiveThread, handleBulkClear, handleDeleteThread, handlePermanentDeleteThread, pendingThreadAction]);

  const handleMarkUnread = async (email: Email) => {
    const conversationKey = getConversationKey(email);
    await handleMarkThreadUnread(conversationKey);
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
    options?: { promptSubjectForEmail?: boolean; markReadOnOpen?: boolean }
  ) => {
    const selectedConversationKey = getConversationKey(emailToSelect);
    const isSameSelectedConversation = !!selectedEmail && getConversationKey(selectedEmail) === selectedConversationKey;
    const shouldMarkRead = Boolean(options?.markReadOnOpen);
    const readOptimistically = shouldMarkRead ? { ...emailToSelect, unread: false } : emailToSelect;
    setSelectedEmail(readOptimistically);
    setSelectedThreadChannel(initialChannel);
    setIsSelectedThreadNewConversation(false);
    setShouldPromptSubjectForSelectedThread(Boolean(options?.promptSubjectForEmail));
    setSelectedThreadContactPhone('');

    if (shouldMarkRead && emailToSelect.unread && !isSameSelectedConversation) {
      const threadKey = selectedConversationKey;
      const threadMessages = conversationHistoryByKey.get(threadKey) || [emailToSelect];
      const unreadThreadMessages = threadMessages.filter((message) => message.unread);
      const messagesToMarkRead = unreadThreadMessages.length > 0 ? unreadThreadMessages : [emailToSelect];

      const threadOptimisticKeys = messagesToMarkRead.map(getOptimisticEmailKey);
      const threadEmailIds = Array.from(
        new Set(
          messagesToMarkRead
            .map((message) => String(message.id || '').trim())
            .filter(Boolean)
        )
      );
      const threadEmailUids = Array.from(
        new Set(
          messagesToMarkRead
            .map((message) => Number(message.uid))
            .filter((uid) => Number.isFinite(uid) && uid > 0)
        )
      );

      setOptimisticallyReadEmailKeys((prev) => {
        const merged = new Set(prev);
        threadOptimisticKeys.forEach((key) => merged.add(key));
        return Array.from(merged);
      });

      try {
        if (user?.propertyId) {
          const markReadResult = await emailApi.markRead(
            user.propertyId,
            threadEmailIds,
            threadEmailUids
          );
          if (!markReadResult?.success) {
            throw new Error('Failed to mark email thread as read in communication API');
          }
        }

        // Best effort: keep external mailbox flags in sync for other mail apps.
        const token = await auth.currentUser?.getIdToken();
        if (token && threadEmailUids.length > 0) {
          await Promise.all(
            threadEmailUids.map((uid) =>
              fetch('https://europe-west1-protrack-hub.cloudfunctions.net/markEmailAsRead', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ messageUid: uid })
              }).catch(() => null)
            )
          );
        }

        safeRefetchEmails();
      } catch (error: any) {
        console.error("Failed to mark email as read on server:", error);
        toast({
          title: t('toasts.mark_read_error_title'),
          description: 'Read status will be retried on next sync.',
          variant: "destructive"
        });
      }
    }
  };

  const handleStartConversation = async (result: ConversationSearchResult, channel: ConversationChannel) => {
    const resultEmail = String(result.email || '').trim().toLowerCase();
    const resultPhone = normalizePhone(result.phone || '');
    const resultReservationId = String(result.reservationId || '').trim();
    const resultReservationNumber = String(result.reservationNumber || '').trim();
    const reservationTokenCandidates = [resultReservationId, resultReservationNumber]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);

    const existing = [...displayEmails]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .find((email) => {
        const source = String((email as any)?.source || '').trim().toLowerCase();
        const senderEmail = String(email.from?.email || '').trim().toLowerCase();
        const sourceReservationId = String((email as any)?.sourceReservationId || (email as any)?.source_reservation_id || '').trim().toLowerCase();

        if (resultEmail && senderEmail && senderEmail === resultEmail) {
          return true;
        }

        if (resultPhone) {
          const senderPhone = normalizePhone(email.from?.email || '');
          if (senderPhone && senderPhone === resultPhone) {
            return true;
          }
        }

        if (reservationTokenCandidates.length > 0) {
          if (sourceReservationId && reservationTokenCandidates.includes(sourceReservationId)) {
            return true;
          }

          if (senderEmail.startsWith('guest-portal+') && senderEmail.endsWith('@guest-portal.local')) {
            const aliasToken = senderEmail.slice('guest-portal+'.length, senderEmail.indexOf('@guest-portal.local')).trim().toLowerCase();
            if (aliasToken && reservationTokenCandidates.includes(aliasToken)) {
              return true;
            }
          }
        }

        if (channel === 'guest_portal' && source === 'guest_portal' && reservationTokenCandidates.length > 0) {
          return reservationTokenCandidates.some((token) => sourceReservationId === token);
        }

        return false;
      });

    if (channel === 'guest_portal' && !resultReservationId) {
      toast({
        title: 'Reservation required',
        description: 'Guest portal chat requires a reservation.',
        variant: 'destructive',
      });
      return;
    }

    setIsNewConversationOpen(false);
    setActiveView('inbox_all');

    if (existing) {
      const existingKey = getConversationKey(existing);
      const resolvedDisplayName = String(result.guestName || '').trim();
      if (resolvedDisplayName) {
        setConversationDisplayNames((prev) => ({ ...prev, [existingKey]: resolvedDisplayName }));
      }
      setSelectedThreadContactPhone(String(result.phone || '').trim());
      await handleSelectEmail(existing, channel, {
        promptSubjectForEmail: channel === 'email',
        markReadOnOpen: true,
      });
      return;
    }

    const synthetic: Email = {
      uid: 0,
      source: channel === 'guest_portal' ? 'guest_portal' : channel,
      sourceReservationId: channel === 'guest_portal' ? String(result.reservationId || '').trim() : undefined,
      from: {
        name: result.guestName || 'Guest',
        email: channel === 'guest_portal' ? '' : resultEmail,
      },
      subject: channel === 'guest_portal'
        ? 'Guest portal chat'
        : (result.reservationNumber
            ? `Reservation ${result.reservationNumber}`
            : 'New conversation'),
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

  const resolveReservationFromThread = useCallback((email: Email): Reservation | null => {
    const conversationKey = getConversationKey(email);
    const thread = conversationHistoryByKey.get(conversationKey) || [email];

    const hasOnlyGuestPortalMessages = thread.length > 0 && thread.every((item) => String((item as any).source || '').trim().toLowerCase() === 'guest_portal');
    if (!hasOnlyGuestPortalMessages) return null;

    const containsRealEmailIdentifier = thread.some((item) => {
      const fromEmail = String(item.from?.email || '').trim().toLowerCase();
      if (!fromEmail) return false;
      return !fromEmail.endsWith('@guest-portal.local');
    });

    const containsPhoneIdentifier = Boolean(normalizePhone(selectedThreadContactPhone || ''));
    if (containsRealEmailIdentifier || containsPhoneIdentifier) {
      return null;
    }

    const explicitReservationId = thread
      .map((item) => String((item as any)?.sourceReservationId || (item as any)?.source_reservation_id || '').trim())
      .find(Boolean);

    const senderEmail = String(thread[thread.length - 1]?.from?.email || '').trim().toLowerCase();
    const reservationIdFromSender = (() => {
      const match = senderEmail.match(/^guest-portal\+([^@]+)@guest-portal\.local$/i);
      return match?.[1] ? String(match[1]).trim() : '';
    })();

    const targetReservationId = explicitReservationId || reservationIdFromSender;
    if (!targetReservationId) return null;

    const matched = guestReservations.find((reservation) => String(reservation.id || '').trim() === targetReservationId);
    return matched || null;
  }, [conversationHistoryByKey, getConversationKey, guestReservations, selectedThreadContactPhone]);

  const openGuestInfoFromEmail = useCallback(async (email: Email) => {
    await handleSelectEmail(email, 'all', { markReadOnOpen: true });

    const reservationOnlyThread = resolveReservationFromThread(email);
    if (reservationOnlyThread) {
      setSelectedReservationForPanel(reservationOnlyThread);
      setIsGuestInfoPanelOpen(false);
      setIsReservationDetailsOpen(true);
      return;
    }

    setSelectedReservationForPanel(null);
    setIsReservationDetailsOpen(false);
    setIsGuestInfoPanelOpen(true);
  }, [handleSelectEmail, resolveReservationFromThread]);

  const selectedGuestForPanel = useMemo(() => {
    if (!selectedEmail) return null;

    const selectedEmailValue = String(selectedEmail.from?.email || '').trim().toLowerCase();
    const selectedPhoneValue = normalizePhone(selectedThreadContactPhone || '');
    const selectedNameValue = String(selectedEmail.from?.name || '').trim().toLowerCase();

    const matchedGuest = guestDirectory.find((guest) => {
      const guestEmail = String(guest.email || '').trim().toLowerCase();
      const guestPhone = normalizePhone(guest.phone || '');
      const guestName = String(guest.fullName || '').trim().toLowerCase();

      if (selectedEmailValue && guestEmail && selectedEmailValue === guestEmail) return true;
      if (selectedPhoneValue && guestPhone && selectedPhoneValue === guestPhone) return true;
      if (selectedNameValue && guestName && selectedNameValue === guestName) return true;
      return false;
    });

    if (matchedGuest) return matchedGuest;

    const linkedGuestId = guestReservations.find((reservation) => {
      const sourceReservationId = String((selectedEmail as any)?.sourceReservationId || (selectedEmail as any)?.source_reservation_id || '').trim();
      if (sourceReservationId && String(reservation.id || '').trim() === sourceReservationId) {
        return true;
      }

      const reservationEmail = String(reservation.guestEmail || '').trim().toLowerCase();
      const reservationPhone = normalizePhone(reservation.guestPhone || '');
      const reservationName = String(reservation.guestName || '').trim().toLowerCase();
      if (selectedEmailValue && reservationEmail && selectedEmailValue === reservationEmail) return true;
      if (selectedPhoneValue && reservationPhone && selectedPhoneValue === reservationPhone) return true;
      if (selectedNameValue && reservationName && selectedNameValue === reservationName) return true;
      return false;
    })?.guestId;

    if (linkedGuestId) {
      const matchedById = guestDirectory.find((guest) => guest.id === linkedGuestId);
      if (matchedById) return matchedById;
    }

    return null;
  }, [guestDirectory, guestReservations, selectedEmail, selectedThreadContactPhone]);

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

  if (isLoadingChannelSettings) {
    return <div className="flex h-screen items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  // Show message if no communication channels are configured
  if (!hasAnyCommunicationChannels()) {
    return (
      <div className="h-screen flex items-center justify-center p-4 bg-white rounded-lg border border-slate-200">
        <div className="max-w-sm space-y-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
            <AlertCircle className="h-10 w-10 text-slate-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Communication channels aren't set up</h2>
            <p className="mt-2 text-sm text-slate-600">
              You need to configure at least one communication channel (Email, WhatsApp, or Guest Portal) to start managing conversations with guests.
            </p>
          </div>
          <Button
            onClick={() => {
              if (user?.propertyId) {
                window.location.href = `/property-settings/communication/communication-channels?propertyId=${user.propertyId}`;
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Set up communication channels
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white border border-slate-200" style={{ height: 'calc(96vh - var(--app-header-height))' }}>
      <div className="flex h-full min-w-0 flex-col md:flex-row">
        <aside
          className={cn(
            'flex min-h-0 w-full shrink-0 flex-col overflow-x-hidden bg-slate-50 md:w-[360px] lg:w-[390px] md:border-r md:border-slate-200',
            selectedEmail ? 'hidden md:flex' : 'flex'
          )}
        >
          <div className="flex-shrink-0 border-b border-slate-200 bg-white px-4 py-3">
            {isBulkMode && bulkSelectedKeys.length > 0 ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleBulkClear} title="Cancel selection">
                    <X className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium text-slate-700">{bulkSelectedKeys.length} selected</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={handleBulkMarkRead} title="Mark selected as read">
                    <Mail className="h-3.5 w-3.5" /> Mark read
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={handleBulkMarkUnread} title="Mark selected as unread">
                    <MailWarning className="h-3.5 w-3.5" /> Mark unread
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={handleBulkStar} title="Star selected">
                    <Star className="h-3.5 w-3.5" /> Star
                  </Button>
                  {threadMailbox === 'trash' ? (
                    <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-emerald-600 hover:text-emerald-700" onClick={handleBulkRestore} title="Recover selected">
                      <ArchiveRestore className="h-3.5 w-3.5" /> Recover
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={handleBulkArchive} title="Archive selected">
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-red-500 hover:text-red-600" onClick={handleBulkDelete} title="Delete selected">
                    <Trash2 className="h-3.5 w-3.5" /> {threadMailbox === 'trash' ? 'Delete forever' : 'Delete'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h1 className="text-sm font-semibold text-slate-900">{t('nav.inbox_header')}</h1>
                  <p className="text-[11px] text-slate-500">Conversation list</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsBulkMode((v) => !v)}
                    title="Select conversations"
                  >
                    <CheckSquare className="h-4 w-4" />
                  </Button>
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
            )}

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
                <span className="text-[10px] text-slate-400">{totalConversationCount} threads</span>
              </div>

              <div className="group/filters relative">
                <div
                  id="conversation-filters-scroll"
                  ref={filterChipsScrollRef}
                  onScroll={syncFilterScrollbar}
                  onMouseEnter={syncFilterScrollbar}
                  className="overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:h-0"
                >
                  <div className="flex gap-1 pb-1">
                    {(
                      [['all','Primary'],['needs_reply','Needs Reply'],['pinned','Pinned'],['archived','Archived'],['trash','Trash']] as [ThreadMailbox, string][]
                    ).map(([val, label]) => (
                      <Button
                        key={val}
                        type="button"
                        variant={threadMailbox === val ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-7 rounded-full px-3 text-xs shrink-0',
                          val === 'needs_reply' && threadMailbox !== val && 'border-orange-200 bg-orange-50 text-orange-700 font-semibold'
                        )}
                        onClick={() => { setThreadMailbox(val); setCurrentPage(1); }}
                      >
                        {val === 'needs_reply' && <Reply className="mr-1 h-3 w-3" />}
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                {hasFilterChipsOverflow && (
                  <div className="absolute bottom-0 left-0 right-0 hidden opacity-0 transition-opacity duration-150 md:block md:group-hover/filters:opacity-100">
                    <div
                      ref={filterScrollbarTrackRef}
                      className={cn(
                        'h-1.5 rounded-full bg-slate-200/80',
                        isFilterScrollbarDragging ? 'cursor-grabbing' : 'cursor-pointer'
                      )}
                      onMouseDown={handleFilterScrollbarTrackMouseDown}
                      role="scrollbar"
                      aria-label="Conversation filters horizontal scrollbar"
                      aria-controls="conversation-filters-scroll"
                      aria-orientation="horizontal"
                    >
                      <div
                        className={cn(
                          'h-full rounded-full bg-slate-500/90',
                          isFilterScrollbarDragging ? 'cursor-grabbing' : 'cursor-grab'
                        )}
                        onMouseDown={handleFilterScrollbarThumbMouseDown}
                        style={{
                          width: `${filterScrollbarThumbWidthPct}%`,
                          marginLeft: `${filterScrollbarThumbLeftPct}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0 overflow-x-hidden">
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
                        const pinned = isConversationPinned(conversation.key);
                        const archived = isConversationArchived(conversation.key);
                        const trashed = isConversationTrashed(conversation.key);
                        const starred = isConversationStarred(conversation.key, conversation.messages);
                        const previewText = getThreadPreviewText(latestThreadEmail);
                        const previewLabel = getThreadPreviewLabel(latestThreadEmail);
                        const isLatestSent = isSentEmail(latestThreadEmail);
                        const slaInfo = getSlaInfo(conversation);
                        const activeStay = getActiveStay(conversation);
                        const isChecked = bulkSelectedKeys.includes(conversation.key);

                        return (
                          <div
                            key={conversation.key}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (isBulkMode) { handleBulkToggleSelect(conversation.key); return; }
                              handleSelectEmail(email, 'all', { markReadOnOpen: true });
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                if (isBulkMode) { handleBulkToggleSelect(conversation.key); return; }
                                handleSelectEmail(email, 'all', { markReadOnOpen: true });
                              }
                            }}
                            className={cn(
                              'group block w-full min-w-0 overflow-hidden cursor-pointer border-b border-slate-100 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50',
                              isSelected && 'bg-blue-50',
                              isChecked && 'bg-blue-50',
                              conversation.unreadCount > 0 && !isSelected && 'bg-blue-50/30'
                            )}
                          >
                            {/* Top row: checkbox/dot + name + time */}
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 overflow-hidden">
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="flex min-w-0 items-center gap-2">
                                  {isBulkMode ? (
                                    <span className="shrink-0">
                                      {isChecked
                                        ? <CheckSquare className="h-4 w-4 text-blue-600" />
                                        : <Square className="h-4 w-4 text-slate-400" />}
                                    </span>
                                  ) : (
                                    conversation.unreadCount > 0 && <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                                  )}
                                  {pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                                  {starred && <Star className="h-3.5 w-3.5 shrink-0 text-amber-400 fill-amber-400" />}
                                  <span className={cn('block min-w-0 truncate text-sm', conversation.unreadCount > 0 ? 'font-semibold text-slate-900' : 'font-medium text-slate-700')}>
                                    {conversation.contactName}
                                  </span>
                                </div>

                                {/* Preview line */}
                                <div className="mt-1 flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden text-xs">
                                  <span className={cn('shrink-0 font-medium', isLatestSent ? 'text-emerald-600' : 'text-blue-600')}>
                                    {previewLabel}:
                                  </span>
                                  <span className="block min-w-0 flex-1 truncate text-slate-500">
                                    {previewText}
                                  </span>
                                </div>

                                {/* Channel badges + indicator row */}
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  {getConversationChannels(conversation).map((channel) => (
                                    <Badge key={channel} variant="outline" className={cn('h-5 rounded-full px-2 text-[10px] font-medium', getChannelBadgeClassName(channel))}>
                                      {channel}
                                    </Badge>
                                  ))}
                                  {activeStay && (
                                    <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0 text-[10px] font-medium text-emerald-700">
                                      <BedDouble className="h-3 w-3" /> Checked in
                                    </span>
                                  )}
                                  {slaInfo && (
                                    <span className={cn(
                                      'flex items-center gap-1 rounded-full border px-2 py-0 text-[10px] font-medium',
                                      slaInfo.urgent
                                        ? 'border-red-200 bg-red-50 text-red-600'
                                        : 'border-amber-200 bg-amber-50 text-amber-600'
                                    )}>
                                      <Clock className="h-3 w-3" /> {slaInfo.label}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right column: time + quick actions + status */}
                              <div className="flex min-w-[80px] shrink-0 flex-col items-end gap-1">
                                <span className="text-[11px] font-medium text-slate-400">{formattedDate}</span>
                                {!isBulkMode && (
                                  <div className="flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={async (event) => { event.preventDefault(); event.stopPropagation(); await openGuestInfoFromEmail(email); }} title="Guest info">
                                      <Info className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={(event) => { event.preventDefault(); event.stopPropagation(); handleTogglePin(conversation.key); }} title={pinned ? 'Unpin' : 'Pin'}>
                                      {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={async (event) => { event.preventDefault(); event.stopPropagation(); await handleToggleStarThread(conversation.key); }} title={starred ? 'Unstar' : 'Star'}>
                                      <Star className={cn('h-3.5 w-3.5', starred && 'fill-amber-400 text-amber-500')} />
                                    </Button>
                                    {conversation.unreadCount > 0 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={async (event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          await handleMarkThreadRead(conversation.key);
                                        }}
                                        title="Mark as read"
                                      >
                                        <Mail className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {conversation.unreadCount === 0 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={async (event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          await handleMarkThreadUnread(conversation.key);
                                        }}
                                        title="Mark as unread"
                                      >
                                        <MailWarning className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {(threadMailbox === 'trash' || trashed) ? (
                                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await handleRestoreThread(conversation.key); }} title="Restore"><ArchiveRestore className="h-3.5 w-3.5" /></Button>
                                    ) : archived ? (
                                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await handleUnarchiveThread(conversation.key); }} title="Unarchive"><ArchiveRestore className="h-3.5 w-3.5" /></Button>
                                    ) : (
                                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openThreadActionConfirm('archive', [conversation.key]); }} title="Archive"><Archive className="h-3.5 w-3.5" /></Button>
                                    )}
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openThreadActionConfirm(threadMailbox === 'trash' || trashed ? 'permanent_delete' : 'move_to_trash', [conversation.key]); }} title={threadMailbox === 'trash' || trashed ? 'Delete permanently' : 'Move to trash'}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                                <Badge variant="outline" className={cn('h-5 rounded-full px-2 text-[10px] font-medium', getStatusBadgeClassName(latestThreadEmail, trashed))}>
                                  {getLastMessageStatus(latestThreadEmail, trashed)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">No conversations</div>
              )}            </div>
          </ScrollArea>
          <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Rows per page</span>
              <Select
                value={String(itemsPerPage)}
                onValueChange={(value) => {
                  const parsed = Number(value);
                  if (!Number.isFinite(parsed) || parsed <= 0) return;
                  setItemsPerPage(parsed);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-[74px] rounded-md border-slate-200 bg-white px-2 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 15, 25, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>
                {totalConversationCount === 0
                  ? '0-0 of 0'
                  : `${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, totalConversationCount)} of ${totalConversationCount}`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-1 text-xs text-slate-500">{currentPage}/{Math.max(totalPages, 1)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage((prev) => Math.min(Math.max(totalPages, 1), prev + 1))}
                disabled={currentPage >= totalPages}
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Bulk select-all bar at bottom */}
          {isBulkMode && (
            <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
              <button className="underline hover:text-slate-700" onClick={handleBulkSelectAll}>Select all {currentList.length}</button>
              <button className="underline hover:text-slate-700" onClick={handleBulkClear}>Cancel</button>
            </div>
          )}
        </aside>

        <main className={cn('min-w-0 flex-1 bg-white', selectedEmail ? 'block' : 'hidden md:block')}>
          <div className="relative h-full min-w-0">
            {selectedEmail ? (
              <>
                <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-4.5rem)] items-center gap-2">
                  {(() => {
                    const selKey = getConversationKey(selectedEmail);
                    const conv = currentList.find((c) => c.key === selKey);
                    const stay = conv ? getActiveStay(conv) : null;
                    if (!stay) return null;

                    const roomLabel = Array.isArray(stay.rooms) && stay.rooms.length > 0
                      ? stay.rooms
                        .map((room: any) => {
                          const roomType = String(room?.roomTypeName || room?.typeName || 'Room').trim();
                          const roomNumber = String(room?.roomName || room?.name || room?.roomId || '').trim();
                          return `${roomType}${roomNumber ? ` ${roomNumber}` : ''}`.trim();
                        })
                        .filter(Boolean)
                        .join(', ')
                      : String(stay.roomTypeName || stay.roomName || 'Room').trim();

                    const checkOutLabel = isValid(new Date(stay.endDate))
                      ? format(new Date(stay.endDate), 'MMM d')
                      : '—';

                    const totalGuests = Array.isArray(stay.rooms) && stay.rooms.length > 0
                      ? stay.rooms.reduce((sum: number, room: any) => sum + Number(room?.adults || 0) + Number(room?.children || 0), 0)
                      : Number(stay.adults || 0) + Number(stay.children || 0);

                    const details = `Currently checked in - ${roomLabel} - Check-out: ${checkOutLabel} - Guests: ${totalGuests}`;

                    return (
                      <span
                        className="hidden max-w-[720px] items-center truncate rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 lg:inline-flex"
                        title={details}
                      >
                        <BedDouble className="mr-1.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        {details}
                      </span>
                    );
                  })()}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-white"
                    onClick={async () => {
                      if (selectedEmail) {
                        await openGuestInfoFromEmail(selectedEmail);
                      }
                    }}
                    title="Guest info"
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </div>
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
              </>
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
          </div>
        </main>
      </div>

      <Sheet open={isGuestInfoPanelOpen} onOpenChange={setIsGuestInfoPanelOpen}>
        <SheetContent side="right" className="w-[min(1100px,96vw)] sm:max-w-none p-0">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-slate-200 px-6 py-4 pr-12 text-left">
              <SheetTitle>Guest Details</SheetTitle>
              <SheetDescription>Profile and reservation history</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {!selectedEmail ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
                  Select a conversation to view guest profile details.
                </div>
              ) : isLoadingGuestPanel ? (
                <div className="flex h-full items-center justify-center">
                  <Icons.Spinner className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : selectedGuestForPanel ? (
                <GuestProfile
                  guest={selectedGuestForPanel}
                  allReservations={guestReservations}
                  onGuestDeleted={() => {
                    setGuestDirectory((current) => current.filter((guest) => guest.id !== selectedGuestForPanel.id));
                    setSelectedEmail(null);
                    setIsGuestInfoPanelOpen(false);
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
                  Guest details are unavailable for this conversation.
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ReservationDetailModal
        isOpen={isReservationDetailsOpen}
        onClose={() => {
          setIsReservationDetailsOpen(false);
          setSelectedReservationForPanel(null);
        }}
        initialData={selectedReservationForPanel}
        propertySettings={property}
        canManage={false}
        displayMode="sidepanel"
      />

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

      <AlertDialog open={!!pendingThreadAction} onOpenChange={(open) => { if (!open) setPendingThreadAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingThreadAction?.type === 'archive'
                ? 'Archive thread(s)?'
                : pendingThreadAction?.type === 'move_to_trash'
                  ? 'Move thread(s) to trash?'
                  : 'Permanently delete thread(s)?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingThreadAction
                ? pendingThreadAction.type === 'archive'
                  ? `You are about to archive ${pendingThreadAction.conversationKeys.length} conversation thread(s). This action requires confirmation to avoid accidental archival.`
                  : pendingThreadAction.type === 'move_to_trash'
                    ? `You are about to move ${pendingThreadAction.conversationKeys.length} conversation thread(s) to trash. This action requires confirmation to avoid accidental deletion.`
                    : `You are about to permanently delete ${pendingThreadAction.conversationKeys.length} conversation thread(s) from trash. This action cannot be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={pendingThreadAction?.type === 'move_to_trash' || pendingThreadAction?.type === 'permanent_delete' ? 'bg-red-600 text-white hover:bg-red-700' : ''}
              onClick={executePendingThreadAction}
            >
              {pendingThreadAction?.type === 'archive'
                ? 'Archive'
                : pendingThreadAction?.type === 'move_to_trash'
                  ? 'Move to trash'
                  : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
