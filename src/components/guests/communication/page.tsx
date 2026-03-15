
"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { useAuth } from '@/contexts/auth-context';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Archive, Mail, MessageSquare, Bot, Settings, Bell, MessageCircle, RefreshCw, MailPlus, Inbox, Paperclip } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
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
import { useSearchParams } from 'next/navigation';

type ActiveView = 
    | 'inbox_all' 
    | 'inbox_unread' 
    | 'inbox_archived' 
    | 'channel_email' 
    | 'channel_chatbot'
    | 'settings_autoresponse'
    | 'settings_integrations';

const NavLink = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <Button
        variant="ghost"
        className={cn(
            "w-full justify-start",
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

const SMTPConfigurationForm = ({ initialSettings, onSave, isSaving, isLoading, onTestConnection, isTesting }: {
    initialSettings: any;
    onSave: (settings: any) => void;
    isSaving: boolean;
    isLoading: boolean;
    onTestConnection: (settings: any) => void;
    isTesting: boolean;
}) => {
    const { t } = useTranslation('pages/guests/communication/content');
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState<number | string>(587);
    const [smtpUser, setSmtpUser] = useState('');
    const [smtpPass, setSmtpPass] = useState('');
    const [fromName, setFromName] = useState('');

    useEffect(() => {
        if (initialSettings) {
            setSmtpHost(initialSettings.smtpHost || '');
            setSmtpPort(initialSettings.smtpPort || 587);
            setSmtpUser(initialSettings.smtpUser || '');
            setSmtpPass(initialSettings.smtpPass || '');
            setFromName(initialSettings.fromName || '');
        }
    }, [initialSettings]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ smtpHost, smtpPort: Number(smtpPort), smtpUser, smtpPass, fromName });
    };

    const handleTest = () => {
        onTestConnection({ smtpHost, smtpPort: Number(smtpPort), smtpUser, smtpPass });
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-64"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <Icons.Mail className="w-8 h-8 text-primary" />
                    <div>
                        <CardTitle>{t('integrations.smtp_title')}</CardTitle>
                        <CardDescription>
                            {t('integrations.smtp_description')}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <form onSubmit={handleSave}>
                <CardContent className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1 md:col-span-2">
                          <Label htmlFor="smtpHost">{t('integrations.smtp_host_label')}</Label>
                          <Input id="smtpHost" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder={t('integrations.smtp_host_placeholder')} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="smtpPort">{t('integrations.smtp_port_label')}</Label>
                          <Input id="smtpPort" type="number" value={smtpPort} onChange={e => setSmtpPort(Number(e.target.value))} placeholder={t('integrations.smtp_port_placeholder')} />
                        </div>
                      </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="smtpUser">{t('integrations.smtp_user_label')}</Label>
                          <Input id="smtpUser" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder={t('integrations.smtp_user_placeholder')} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="smtpPass">{t('integrations.smtp_pass_label')}</Label>
                          <Input id="smtpPass" type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder={t('integrations.smtp_pass_placeholder')} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="fromName">{t('integrations.smtp_from_name_label')}</Label>
                        <Input id="fromName" value={fromName} onChange={e => setFromName(e.target.value)} placeholder={t('integrations.smtp_from_name_placeholder')} />
                      </div>
                </CardContent>
                <CardFooter className="justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleTest} disabled={isTesting || isSaving}>
                        {isTesting && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                        {t('integrations.test_connection_button')}
                    </Button>
                    <Button type="submit" disabled={isSaving || isTesting}>
                        {isSaving && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                        {t('integrations.save_smtp_button')}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
};

const IMAPConfigurationForm = ({ initialSettings, onSave, isSaving, isLoading, onTestConnection, isTesting }: {
    initialSettings: any;
    onSave: (settings: any) => void;
    isSaving: boolean;
    isLoading: boolean;
    onTestConnection: (settings: any) => void;
    isTesting: boolean;
}) => {
    const { t } = useTranslation('pages/guests/communication/content');
    const [imapHost, setImapHost] = useState('');
    const [imapPort, setImapPort] = useState<number | string>(993);
    const [imapUser, setImapUser] = useState('');
    const [imapPass, setImapPass] = useState('');
    const [useTls, setUseTls] = useState(true);

    useEffect(() => {
        if (initialSettings) {
            setImapHost(initialSettings.host || '');
            setImapPort(initialSettings.port || 993);
            setImapUser(initialSettings.user || '');
            setImapPass(initialSettings.pass || '');
            setUseTls(initialSettings.useTls === undefined ? true : initialSettings.useTls);
        }
    }, [initialSettings]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ imapHost, imapPort: Number(imapPort), imapUser, imapPass, useTls });
    };

    const handleTest = () => {
        onTestConnection({ imapHost, imapPort: Number(imapPort), imapUser, imapPass, useTls });
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-64"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <Icons.Inbox className="w-8 h-8 text-primary" />
                    <div>
                        <CardTitle>{t('integrations.imap_title')}</CardTitle>
                        <CardDescription>
                            {t('integrations.imap_description')}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <form onSubmit={handleSave}>
                <CardContent className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1 md:col-span-2">
                          <Label htmlFor="imapHost">{t('integrations.imap_host_label')}</Label>
                          <Input id="imapHost" value={imapHost} onChange={e => setImapHost(e.target.value)} placeholder={t('integrations.imap_host_placeholder')} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="imapPort">{t('integrations.imap_port_label')}</Label>
                          <Input id="imapPort" type="number" value={imapPort} onChange={e => setImapPort(Number(e.target.value))} placeholder={t('integrations.imap_port_placeholder')} />
                        </div>
                      </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="imapUser">{t('integrations.imap_user_label')}</Label>
                          <Input id="imapUser" value={imapUser} onChange={e => setImapUser(e.target.value)} placeholder={t('integrations.imap_user_placeholder')} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="imapPass">{t('integrations.imap_pass_label')}</Label>
                          <Input id="imapPass" type="password" value={imapPass} onChange={e => setImapPass(e.target.value)} placeholder={t('integrations.imap_pass_placeholder')} />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 pt-2">
                          <Switch id="useTls" checked={useTls} onCheckedChange={setUseTls} />
                          <Label htmlFor="useTls">{t('integrations.imap_tls_label')}</Label>
                      </div>
                </CardContent>
                <CardFooter className="justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleTest} disabled={isTesting || isSaving}>
                        {isTesting && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                        {t('integrations.test_imap_button')}
                    </Button>
                    <Button type="submit" disabled={isSaving || isTesting}>
                        {isSaving && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                        {t('integrations.save_imap_button')}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
};

const EmailListItem = ({ email, onSelect, isSelected }: { email: Email; onSelect: () => void; isSelected: boolean }) => (
    <div
        className={cn(
            "flex items-start gap-3 p-3 cursor-pointer border-b last:border-b-0",
            isSelected ? "bg-muted" : "hover:bg-muted/50",
            email.unread && "bg-blue-50 dark:bg-blue-900/20"
        )}
        onClick={onSelect}
    >
        <Avatar className="h-9 w-9 mt-1">
            <AvatarFallback>{email.from.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden">
            <div className="flex justify-between items-baseline">
                <p className="font-semibold text-sm truncate">{email.from.name}</p>
                <p className="text-xs text-muted-foreground flex-shrink-0">{format(parseISO(email.date), 'PP')}</p>
            </div>
            <p className="text-sm truncate">{email.subject}</p>
            <p className="text-xs text-muted-foreground truncate">{email.snippet}</p>
        </div>
    </div>
);

const EmailDetailView = ({ email, onBack, onReply }: { email: Email; onBack: () => void; onReply: (email: Email) => void; }) => {
    const { t } = useTranslation('pages/guests/communication/content');
    return (
        <div className="flex flex-col h-full">
            <header className="p-4 border-b">
                <Button variant="outline" size="sm" onClick={onBack}>
                    <Icons.ChevronLeft className="h-4 w-4 mr-2" /> {t('views.back_to_inbox_button')}
                </Button>
            </header>
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    <h2 className="text-xl font-bold">{email.subject}</h2>
                    <div className="flex items-center gap-3 text-sm">
                        <Avatar><AvatarFallback>{email.from.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                        <div>
                            <p className="font-semibold">{email.from.name}</p>
                            <p className="text-muted-foreground">{email.from.email}</p>
                        </div>
                        <p className="text-muted-foreground ml-auto">{format(parseISO(email.date), 'PPp')}</p>
                    </div>
                </div>
                <Separator />
                <div
                    className="p-4 prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: email.body }}
                />
            </ScrollArea>
            <footer className="p-4 border-t">
                <Button onClick={() => onReply(email)}>{t('reply_form.send_reply_button')}</Button>
            </footer>
        </div>
    );
};

export default function CommunicationHubPage() {
    const { user, property, isLoadingAuth, emails, isLoadingEmails, refetchEmails, lastEmailSyncAt, isSyncingEmails } = useAuth();
  const { t } = useTranslation('pages/guests/communication/content');
  const searchParams = useSearchParams();

  const [activeView, setActiveView] = useState<ActiveView>('inbox_all');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  
  const [isTestingImap, setIsTestingImap] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const [replyingToEmail, setReplyingToEmail] = useState<Email | null>(null);
  
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);
  
  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'settings_integrations') {
      setActiveView('settings_integrations');
    }
  }, [searchParams]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeView]);

  const { currentList, totalPages } = useMemo(() => {
    let sourceList: Email[] = [];
    if (activeView === 'inbox_all' || activeView === 'channel_email') {
        sourceList = emails;
    } else if (activeView === 'inbox_unread') {
        sourceList = emails.filter(e => e.unread);
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    return {
        currentList: sourceList.slice(startIndex, endIndex),
        totalPages: Math.ceil(sourceList.length / itemsPerPage) || 1
    };
  }, [activeView, emails, currentPage, itemsPerPage]);

  useEffect(() => {
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

  const handleReply = (email: Email) => {
    setReplyingToEmail(email);
    setIsReplyModalOpen(true);
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
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user?.permissions?.guests) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('access_denied.title')}</AlertTitle>
        <AlertDescription>
          {t('access_denied.description')}
        </AlertDescription>
      </Alert>
    );
  }

  const renderContent = () => {
    const isInboxView = activeView === 'inbox_all' || activeView === 'inbox_unread' || activeView === 'channel_email';
    let sourceList: Email[] = [];
    if (activeView === 'inbox_all' || activeView === 'channel_email') sourceList = emails;
    if (activeView === 'inbox_unread') sourceList = emails.filter(e => e.unread);

    if (isInboxView) {
        if (selectedEmail) {
            return <EmailDetailView email={selectedEmail} onBack={() => setSelectedEmail(null)} onReply={handleReply} />;
        }
        
        let title = t('views.inbox_all_title');
        if (activeView === 'inbox_unread') title = t('views.inbox_unread_title');
        if (activeView === 'channel_email') title = t('views.inbox_channel_email_title');

        return (
            <div className="flex flex-col h-full">
                <div className="p-4 border-b flex justify-between items-center">
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
                    <ScrollArea className="flex-1">
                        {currentList.map(email => (
                            <EmailListItem key={email.uid} email={email} onSelect={() => handleSelectEmail(email)} isSelected={selectedEmail?.uid === email.uid} />
                        ))}
                    </ScrollArea>
                    {totalPages > 1 && (
                        <CardFooter className="flex items-center justify-end space-x-6 p-2 border-t">
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
        case 'inbox_archived':
            return <ViewPlaceholder title={t('views.archived_title')} description={t('views.archived_description')} icon={<Archive className="w-16 h-16" data-ai-hint="archive box" />} />;
        case 'channel_chatbot':
            return <ViewPlaceholder title={t('views.chatbot_title')} description={t('views.chatbot_description')} icon={<Bot className="w-16 h-16" data-ai-hint="robot chatbot" />} />;
        case 'settings_autoresponse':
            return <ViewPlaceholder title={t('views.autoresponse_title')} description={t('views.autoresponse_description')} icon={<MessageCircle className="w-16 h-16" data-ai-hint="auto reply message" />} />;
        case 'settings_integrations':
            return (
                <ScrollArea className="h-full">
                    <div className="p-4 space-y-6">
                        <SMTPConfigurationForm 
                            initialSettings={property?.emailConfiguration}
                            onSave={(smtpSettings) => handleSaveSettings({ smtpSettings })}
                            isSaving={isSaving}
                            isLoading={isLoadingAuth}
                            onTestConnection={handleTestSmtpConnection}
                            isTesting={isTestingSmtp}
                        />
                         <IMAPConfigurationForm 
                            initialSettings={property?.imapConfiguration}
                            onSave={(imapSettings) => handleSaveSettings({ imapSettings })}
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

    return (<>
        <div className="fixed inset-0 bg-slate-100 p-6 flex items-center justify-center overflow-hidden">
            <div className="w-full max-w-[1200px] h-full rounded-2xl overflow-hidden bg-white shadow-lg border border-slate-200 relative">
                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-8 h-full">
          <aside className="space-y-4">
              <div className="flex justify-between items-center pr-2">
                <h2 className="text-xl font-bold">{t('nav.inbox_header')}</h2>
                <Dialog open={isComposeModalOpen} onOpenChange={setIsComposeModalOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MailPlus className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{t('modals.compose_title')}</DialogTitle>
                            <DialogDescription>
                                {t('modals.compose_description')}
                            </DialogDescription>
                        </DialogHeader>
                        <ComposeEmailForm onClose={() => setIsComposeModalOpen(false)} />
                    </DialogContent>
                </Dialog>
              </div>
              <Separator />
              <div>
                  <h3 className="text-lg font-semibold mb-2 px-2">{t('nav.inbox_header')}</h3>
                  <div className="space-y-1">
                      <NavLink active={activeView === 'inbox_all'} onClick={() => setActiveView('inbox_all')}>
                          <Inbox className="mr-2 h-4 w-4"/> {t('nav.inbox_all')}
                      </NavLink>
                      <NavLink active={activeView === 'inbox_unread'} onClick={() => setActiveView('inbox_unread')}>
                          <Mail className="mr-2 h-4 w-4"/> {t('nav.inbox_unread')}
                      </NavLink>
                      <NavLink active={activeView === 'inbox_archived'} onClick={() => setActiveView('inbox_archived')}>
                          <Archive className="mr-2 h-4 w-4"/> {t('nav.inbox_archived')}
                      </NavLink>
                  </div>
              </div>
              <Separator />
               <div>
                  <h3 className="text-lg font-semibold mb-2 px-2">{t('nav.channels_header')}</h3>
                  <div className="space-y-1">
                      <NavLink active={activeView === 'channel_email'} onClick={() => setActiveView('channel_email')}>
                          <Mail className="mr-2 h-4 w-4"/> {t('nav.channel_email')}
                      </NavLink>
                      <NavLink active={activeView === 'channel_chatbot'} onClick={() => setActiveView('channel_chatbot')}>
                          <Bot className="mr-2 h-4 w-4"/> {t('nav.channel_chatbot')}
                      </NavLink>
                  </div>
              </div>
              <Separator />
              <div>
                  <h3 className="text-lg font-semibold mb-2 px-2">{t('nav.settings_header')}</h3>
                  <div className="space-y-1">
                      <NavLink active={activeView === 'settings_autoresponse'} onClick={() => setActiveView('settings_autoresponse')}>
                          <MessageCircle className="mr-2 h-4 w-4"/> {t('nav.settings_autoresponse')}
                      </NavLink>
                      <NavLink active={activeView === 'settings_integrations'} onClick={() => setActiveView('settings_integrations')}>
                          <Settings className="mr-2 h-4 w-4"/> {t('nav.settings_integrations')}
                      </NavLink>
                  </div>
              </div>
          </aside>
                    <main>
                        <div className="h-full flex items-stretch">
                            <div className="mx-auto w-full rounded-2xl overflow-hidden bg-white shadow-sm h-full">
                                <Card className="h-full min-h-[600px] overflow-hidden">
                                    <div className="h-full flex flex-col">
                                        {renderContent()}
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>

        <Dialog open={isReplyModalOpen} onOpenChange={setIsReplyModalOpen}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{t('modals.reply_title', { name: replyingToEmail?.from.name })}</DialogTitle>
                    <DialogDescription>
                        {t('modals.reply_description')}
                    </DialogDescription>
                </DialogHeader>
                {replyingToEmail && (
                    <ReplyEmailForm
                        originalEmail={replyingToEmail}
                        onClose={() => {
                            setIsReplyModalOpen(false);
                            setReplyingToEmail(null);
                        }}
                    />
                )}
            </DialogContent>
        </Dialog>
    </>
  );
}
