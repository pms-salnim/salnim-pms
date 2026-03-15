"use client";
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from 'react-i18next';

const IMAPConfigurationForm = ({ initialSettings, onSave, isSaving, isLoading, onTestConnection, isTesting }: any) => {
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

    const handleSave = (e: React.FormEvent) => { e.preventDefault(); onSave({ imapHost, imapPort: Number(imapPort), imapUser, imapPass, useTls }); };
    const handleTest = () => onTestConnection({ imapHost, imapPort: Number(imapPort), imapUser, imapPass, useTls });

    if (isLoading) return <div className="flex items-center justify-center h-64"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <Icons.Inbox className="w-8 h-8 text-primary" />
                    <div>
                        <CardTitle>{t('integrations.imap_title')}</CardTitle>
                        <CardDescription>{t('integrations.imap_description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <form onSubmit={handleSave}>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1 md:col-span-2"><Label htmlFor="imapHost">{t('integrations.imap_host_label')}</Label><Input id="imapHost" value={imapHost} onChange={e => setImapHost(e.target.value)} /></div>
                        <div className="space-y-1"><Label htmlFor="imapPort">{t('integrations.imap_port_label')}</Label><Input id="imapPort" type="number" value={imapPort} onChange={e => setImapPort(Number(e.target.value))} /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label htmlFor="imapUser">{t('integrations.imap_user_label')}</Label><Input id="imapUser" value={imapUser} onChange={e => setImapUser(e.target.value)} /></div>
                        <div className="space-y-1"><Label htmlFor="imapPass">{t('integrations.imap_pass_label')}</Label><Input id="imapPass" type="password" value={imapPass} onChange={e => setImapPass(e.target.value)} /></div>
                    </div>
                    <div className="flex items-center space-x-2 pt-2"><Switch id="useTls" checked={useTls} onCheckedChange={setUseTls} /><Label htmlFor="useTls">{t('integrations.imap_tls_label')}</Label></div>
                </CardContent>
                <CardFooter className="justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleTest} disabled={isTesting || isSaving}>{isTesting && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}{t('integrations.test_imap_button')}</Button>
                    <Button type="submit" disabled={isSaving || isTesting}>{isSaving && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}{t('integrations.save_imap_button')}</Button>
                </CardFooter>
            </form>
        </Card>
    );
};

export default IMAPConfigurationForm;
