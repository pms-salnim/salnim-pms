
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
import { format, isValid } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Property } from '@/types/property';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog';
import ComposeEmailForm from '@/components/guests/compose-email-form';
import ReplyEmailForm from '@/components/guests/reply-email-form';
import type { Email } from '@/contexts/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from 'react-i18next';
import SMTPConfigurationForm from '@/components/guests/communication/SMTPConfigurationForm';
import IMAPConfigurationForm from '@/components/guests/communication/IMAPConfigurationForm';
import EmailListItem from '@/components/guests/communication/EmailListItem';
import EmailDetailView from '@/components/guests/communication/EmailDetailView';
import LabelManager from '@/components/guests/communication/LabelManager';

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
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  
  const [isTestingImap, setIsTestingImap] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

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
  
  useEffect(() => {
    setCurrentPage(1);
  }, [activeView]);

  const { currentList, totalPages } = useMemo<{ currentList: Email[]; totalPages: number }>(() => {
    let sourceList: Email[] = [];
    if (activeView === 'inbox_all' || activeView === 'channel_email') {
        sourceList = emails;
    } else if (activeView === 'inbox_unread') {
        sourceList = emails.filter(e => e.unread);
    }
    
    // Apply mailbox filters (only for email views)
    const isMailboxView = activeView === 'inbox_all' || activeView === 'inbox_unread' || activeView === 'channel_email';
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
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    return {
        currentList: sourceList.slice(startIndex, endIndex),
        totalPages: Math.ceil(sourceList.length / itemsPerPage) || 1
    };
  }, [activeView, emails, currentPage, itemsPerPage, searchQuery, filterUnread, filterStarred, filterAttachments]);

  useEffect(() => {
    // This effect runs once when the component mounts to do the initial fetch.
    if (!initialFetchDone && user?.propertyId && property?.imapConfiguration) {
      setInitialFetchDone(true);
    }
  }, [user, property, initialFetchDone, refetchEmails]);

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
  
  const handleSelectEmail = async (emailToSelect: Email) => {
    setSelectedEmail(emailToSelect);

    if (emailToSelect.unread) {
        try {
        const token = await auth.currentUser?.getIdToken();
        await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/markEmailAsRead', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ messageUid: emailToSelect.uid })
        });
            refetchEmails();
        } catch (error: any) {
            console.error("Failed to mark email as read on server:", error);
            toast({
                title: t('toasts.mark_read_error_title'),
                description: t('toasts.mark_read_error_description'),
                variant: "destructive"
            });
        }
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

  const renderContent = () => {
    const isInboxView = activeView === 'inbox_all' || activeView === 'inbox_unread' || activeView === 'channel_email';
    let sourceList: Email[] = [];
    if (activeView === 'inbox_all' || activeView === 'channel_email') sourceList = emails;
    if (activeView === 'inbox_unread') sourceList = emails.filter(e => e.unread);

    if (isInboxView) {
        if (selectedEmail) {
            return (
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
                />
            );
        }
        
        let title = t('views.inbox_all_title');
        if (activeView === 'inbox_unread') title = t('views.inbox_unread_title');
        if (activeView === 'channel_email') title = t('views.inbox_channel_email_title');

        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-white z-20 flex-shrink-0">
                    <h3 className="font-semibold">{title}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Last sync: {lastSyncLabel}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => refetchEmails()}
                      disabled={isLoadingEmails || isSyncingEmails || isEmailSyncOnCooldown}
                    >
                      {(isLoadingEmails || isSyncingEmails) ? <Icons.Spinner className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {isLoadingEmails && emails.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>
                ) : sourceList.length > 0 ? (
                    <>
                    <div className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="divide-y">
                          {(() => {
                            const displayEmails: Email[] = (currentList as Email[]);
                                  return displayEmails.map((email: Email) => (
                                    <EmailListItem 
                                        key={(email as any).uid} 
                                        email={email} 
                                        onSelect={() => handleSelectEmail(email)} 
                                        isSelected={(selectedEmail as any)?.uid === (email as any).uid}
                                        onStar={handleStar}
                                        onArchive={handleArchive}
                                        onDelete={handleDelete}
                                    />
                            ));
                          })()}
                            </div>
                        </ScrollArea>
                    </div>
                    {totalPages > 1 && (
                        <CardFooter className="flex items-center justify-end space-x-6 p-2 border-t flex-shrink-0">
                            <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium">{t('pagination.rows_per_page')}</p>
                                <Select
                                    value={`${itemsPerPage}`}
                                    onValueChange={(value) => {
                                        setItemsPerPage(Number(value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    <SelectTrigger className="h-8 w-[70px]">
                                        <SelectValue placeholder={`${itemsPerPage}`} />
                                    </SelectTrigger>
                                    <SelectContent side="top">
                                      {[15, 50, 10, 150].map((pageSize) => (
                                            <SelectItem key={pageSize} value={`${pageSize}`}>
                                                {pageSize}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {t('pagination.page_of', { currentPage, totalPages })}
                            </span>
                            <div className="flex items-center space-x-2">
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>{t('pagination.previous_button')}</Button>
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>{t('pagination.next_button')}</Button>
                            </div>
                        </CardFooter>
                    )}
                    </>
                ) : (
                     <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                        <p className="text-muted-foreground">
                            {activeView === 'inbox_all' || activeView === 'channel_email' ? t('views.inbox_empty') : t('views.inbox_unread_empty')}
                        </p>
                        {(activeView === 'inbox_all' || activeView === 'channel_email') && <Button variant="link" onClick={() => refetchEmails()}>{t('views.fetch_now_button')}</Button>}
                     </div>
                )}
            </div>
        );
    }
    
    switch(activeView) {
        case 'whatsapp':
            return <WhatsAppChatView />;
        case 'inbox_archived':
            return <ViewPlaceholder title={t('views.archived_title')} description={t('views.archived_description')} icon={<Archive className="w-16 h-16" data-ai-hint="archive box" />} />;
        case 'channel_chatbot':
            return <ViewPlaceholder title={t('views.chatbot_title')} description={t('views.chatbot_description')} icon={<Bot className="w-16 h-16" data-ai-hint="robot chatbot" />} />;
        case 'channel_guest_portal':
          return <GuestPortalChatView statusFilter="all" />;
        case 'portal_checked_in':
          return <GuestPortalChatView statusFilter="checked-in" />;
        case 'portal_confirmed':
          return <GuestPortalChatView statusFilter="confirmed" />;
        case 'portal_checked_out':
          return <GuestPortalChatView statusFilter="checked-out" />;
        case 'settings_autoresponse':
            return <ViewPlaceholder title={t('views.autoresponse_title')} description={t('views.autoresponse_description')} icon={<MessageCircle className="w-16 h-16" data-ai-hint="auto reply message" />} />;
        case 'settings_email':
          return (
            <ScrollArea className="flex-1 h-full">
              <div className="p-4 space-y-6">
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
            </ScrollArea>
          );
        case 'settings_integrations':
            return (
                <ScrollArea className="flex-1 h-full">
                    <div className="p-4 space-y-6">
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
                </ScrollArea>
            );
        default:
            return <ViewPlaceholder title={t('views.select_section_title')} description={t('views.select_section_description')} icon={<Inbox className="w-16 h-16" data-ai-hint="inbox messages" />} />;
    }
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white border border-slate-200" style={{ height: 'calc(96vh - var(--app-header-height))' }}>
      <div className="flex h-full">
        {/* LEFT SIDEBAR */}
        <aside className={`bg-slate-50 border-r border-slate-200 flex flex-col transition-all duration-300 h-full ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
          <div className="p-6 flex items-center justify-between border-b bg-white">
            {!sidebarCollapsed && <h1 className="font-black text-sm tracking-tighter">{t('nav.inbox_header')}</h1>}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarCollapsed(s => !s)}>
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setIsComposeModalOpen(true)}
                title="Compose new email"
              >
                <MailPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <nav className="py-4 px-3 space-y-6">
            <div>
              {!sidebarCollapsed && <p className="px-3 text-[10px] font-black uppercase text-slate-400 mb-2">MailBox</p>}
              <div className="space-y-1">
                <NavLink collapsed={sidebarCollapsed} active={activeView === 'inbox_all'} onClick={() => setActiveView('inbox_all')}>
                  <Inbox className="h-4 w-4" />
                  <span className={sidebarCollapsed ? 'hidden' : 'ml-2'}>{t('nav.inbox_all')}</span>
                </NavLink>
                <NavLink collapsed={sidebarCollapsed} active={activeView === 'sent'} onClick={() => setActiveView('sent')}>
                  <Send className="h-4 w-4" />
                  <span className={sidebarCollapsed ? 'hidden' : 'ml-2'}>Sent</span>
                </NavLink>
                <NavLink collapsed={sidebarCollapsed} active={activeView === 'inbox_unread'} onClick={() => setActiveView('inbox_unread')}>
                  <MailWarning className="h-4 w-4" />
                  <span className={sidebarCollapsed ? 'hidden' : 'ml-2'}>{t('nav.inbox_unread')}</span>
                </NavLink>
                <NavLink collapsed={sidebarCollapsed} active={activeView === 'spam'} onClick={() => setActiveView('spam')}>
                  <AlertCircle className="h-4 w-4" />
                  <span className={sidebarCollapsed ? 'hidden' : 'ml-2'}>Spam</span>
                </NavLink>
                <NavLink collapsed={sidebarCollapsed} active={activeView === 'trash'} onClick={() => setActiveView('trash')}>
                  <Trash2 className="h-4 w-4" />
                  <span className={sidebarCollapsed ? 'hidden' : 'ml-2'}>Trash</span>
                </NavLink>
                <NavLink collapsed={sidebarCollapsed} active={activeView === 'inbox_archived'} onClick={() => setActiveView('inbox_archived')}>
                  <Archive className="h-4 w-4" />
                  <span className={sidebarCollapsed ? 'hidden' : 'ml-2'}>{t('nav.inbox_archived')}</span>
                </NavLink>
                <NavLink collapsed={sidebarCollapsed} active={activeView === 'contacts'} onClick={() => setActiveView('contacts')}>
                  <Users className="h-4 w-4" />
                  <span className={sidebarCollapsed ? 'hidden' : 'ml-2'}>Contacts</span>
                </NavLink>
              </div>
            </div>

            <div>
              {!sidebarCollapsed && <p className="px-3 text-[10px] font-black uppercase text-slate-400 mb-2">Guest Portal</p>}
              <div className="space-y-1">
                <NavLink collapsed={sidebarCollapsed} active={activeView === 'channel_guest_portal'} onClick={() => setActiveView('channel_guest_portal')}>
                  <MessageSquare className="h-4 w-4" />
                  <span className={sidebarCollapsed ? 'hidden' : 'ml-2'}>All Portal Msgs</span>
                  {!sidebarCollapsed && guestPortalUnreadCount > 0 && (
                    <span className="ml-auto bg-[#ea580c] text-white text-[10px] px-1.5 py-0.5 rounded-full">{guestPortalUnreadCount}</span>
                  )}
                </NavLink>
                <NavLink collapsed={sidebarCollapsed} active={activeView === 'portal_checked_in'} onClick={() => setActiveView('portal_checked_in')}>
                  <UserCheck className="h-4 w-4" />
                  <span className={sidebarCollapsed ? 'hidden' : 'ml-2'}>Checked-in</span>
                </NavLink>
                <NavLink collapsed={sidebarCollapsed} active={activeView === 'portal_confirmed'} onClick={() => setActiveView('portal_confirmed')}>
                  <CalendarClock className="h-4 w-4" />
                  <span className={sidebarCollapsed ? 'hidden' : 'ml-2'}>Confirmed</span>
                </NavLink>
                <NavLink collapsed={sidebarCollapsed} active={activeView === 'portal_checked_out'} onClick={() => setActiveView('portal_checked_out')}>
                  <LogOut className="h-4 w-4" />
                  <span className={sidebarCollapsed ? 'hidden' : 'ml-2'}>Checked-out</span>
                </NavLink>
              </div>
            </div>

            <div>
              {!sidebarCollapsed && <p className="px-3 text-[10px] font-black uppercase text-slate-400 mb-2">Social & AI</p>}
              <div className="space-y-1">
                <NavLink collapsed={sidebarCollapsed} active={activeView === 'whatsapp'} onClick={() => setActiveView('whatsapp')}>
                  <MessageSquare className="h-4 w-4 text-emerald-500" />
                  <span className={sidebarCollapsed ? 'hidden' : 'ml-2'}>WhatsApp</span>
                </NavLink>
                <NavLink collapsed={sidebarCollapsed} active={activeView === 'channel_chatbot'} onClick={() => setActiveView('channel_chatbot')}>
                  <Bot className="h-4 w-4" />
                  <span className={sidebarCollapsed ? 'hidden' : 'ml-2'}>{t('nav.channel_chatbot')}</span>
                </NavLink>
              </div>
            </div>

            <div>
              {!sidebarCollapsed && <p className="px-3 text-[10px] font-black uppercase text-slate-400 mb-2">Control</p>}
              <div className="space-y-1">
                <NavLink collapsed={sidebarCollapsed} active={activeView === 'settings_email'} onClick={() => setActiveView('settings_email')}>
                  <Mail className="h-4 w-4" />
                  <span className={sidebarCollapsed ? 'hidden' : 'ml-2'}>Email Integration</span>
                </NavLink>
                <NavLink collapsed={sidebarCollapsed} active={activeView === 'settings_autoresponse'} onClick={() => setActiveView('settings_autoresponse')}>
                  <CheckCircle2 className="h-4 w-4" />
                  <span className={sidebarCollapsed ? 'hidden' : 'ml-2'}>Auto Reply</span>
                </NavLink>
              </div>
            </div>
            </nav>
          </ScrollArea>
        </aside>

        {activeView === 'channel_guest_portal' || activeView === 'portal_checked_in' || activeView === 'portal_confirmed' || activeView === 'portal_checked_out' || activeView === 'whatsapp' ? (
          <div className="flex-1">
            {activeView === 'channel_guest_portal' && <GuestPortalChatView statusFilter="all" />}
            {activeView === 'portal_checked_in' && <GuestPortalChatView statusFilter="checked-in" />}
            {activeView === 'portal_confirmed' && <GuestPortalChatView statusFilter="confirmed" />}
            {activeView === 'portal_checked_out' && <GuestPortalChatView statusFilter="checked-out" />}
            {activeView === 'whatsapp' && <WhatsAppChatView />}
          </div>
        ) : (
          <>
            {/* MIDDLE: Conversation List */}
            <div className="w-96 border-r border-slate-200 flex flex-col bg-white h-full">
              <div className="p-4 border-b space-y-3 bg-white z-20 flex-shrink-0">
                {/* Search Bar */}
                <div className="relative">
                  <Icons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    placeholder="Search emails..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 pl-10 pr-3 rounded-lg text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant={filterUnread ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setFilterUnread(!filterUnread)}
                  >
                    <MailWarning className="h-3 w-3 mr-1" />
                    Unread
                  </Button>
                  <Button
                    variant={filterStarred ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setFilterStarred(!filterStarred)}
                  >
                    <Icons.Star className="h-3 w-3 mr-1" />
                    Starred
                  </Button>
                  <Button
                    variant={filterAttachments ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setFilterAttachments(!filterAttachments)}
                  >
                    <Paperclip className="h-3 w-3 mr-1" />
                    Has files
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    {activeView === 'channel_chatbot' ? 'Chatbot Logs' : t('views.inbox_all_title')}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">Last sync: {lastSyncLabel}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => refetchEmails()}
                      disabled={isLoadingEmails || isSyncingEmails || isEmailSyncOnCooldown}
                    >
                      {(isLoadingEmails || isSyncingEmails) ? <Icons.Spinner className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="divide-y divide-slate-50">
                {currentList.length > 0 ? currentList.map(email => {
                  const emailDate = new Date(email.date);
                  const formattedDate = isValid(emailDate) ? format(emailDate, 'pp') : '—';

                  return (
                  <div
                    key={email.uid}
                    onClick={() => { setSelectedEmail(email); handleSelectEmail(email); }}
                    className={`p-5 cursor-pointer hover:bg-slate-50 transition-colors ${selectedEmail?.uid === email.uid ? 'bg-slate-50' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-sm font-bold ${email.unread ? 'text-slate-900' : 'text-slate-600'}`}>{email.from.name}</span>
                      <span className="text-[10px] text-slate-400">{formattedDate}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 mb-1 truncate">{email.subject}</p>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{email.snippet}</p>
                  </div>
                );
                }) : (
                  <div className="text-center p-8 text-muted-foreground">No conversations</div>
                )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* RIGHT: Main Workspace / Chat or Email Detail */}
            <main className="flex-1 flex flex-col bg-slate-50/30 h-full overflow-hidden">
              {selectedEmail ? (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
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
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare className="w-10 h-10 text-slate-300" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Select a conversation</h2>
                  <p className="text-sm text-slate-400 max-w-xs">Choose a message from the middle column to view and respond.</p>
                </div>
              )}
            </main>
          </>
        )}
      </div>

      {/* Floating Compose Modal */}
      {isComposeModalOpen && (
        <ComposeEmailForm onClose={() => setIsComposeModalOpen(false)} />
      )}

      {/* Reply Modal */}
      <Dialog open={isReplyModalOpen} onOpenChange={setIsReplyModalOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('modals.reply_title', { name: replyingToEmail?.from.name })}</DialogTitle>
            <DialogDescription>{t('modals.reply_description')}</DialogDescription>
          </DialogHeader>
          {replyingToEmail && (
            <ReplyEmailForm
              originalEmail={replyingToEmail}
              onClose={() => { setIsReplyModalOpen(false); setReplyingToEmail(null); }}
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
