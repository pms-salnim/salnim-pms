"use client";
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

const SMTPConfigurationForm = ({ initialSettings, onSave, isSaving, isLoading, onTestConnection, isTesting }: any) => {
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

    const handleSave = (e: React.FormEvent) => { e.preventDefault(); onSave({ smtpHost, smtpPort: Number(smtpPort), smtpUser, smtpPass, fromName }); };
    const handleTest = () => onTestConnection({ smtpHost, smtpPort: Number(smtpPort), smtpUser, smtpPass });

    if (isLoading) return <div className="flex items-center justify-center h-64"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <Icons.Mail className="w-8 h-8 text-primary" />
                    <div>
                        <CardTitle>{t('integrations.smtp_title')}</CardTitle>
                        <CardDescription>{t('integrations.smtp_description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <form onSubmit={handleSave}>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1 md:col-span-2"><Label htmlFor="smtpHost">{t('integrations.smtp_host_label')}</Label><Input id="smtpHost" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} /></div>
                        <div className="space-y-1"><Label htmlFor="smtpPort">{t('integrations.smtp_port_label')}</Label><Input id="smtpPort" type="number" value={smtpPort} onChange={e => setSmtpPort(Number(e.target.value))} /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label htmlFor="smtpUser">{t('integrations.smtp_user_label')}</Label><Input id="smtpUser" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} /></div>
                        <div className="space-y-1"><Label htmlFor="smtpPass">{t('integrations.smtp_pass_label')}</Label><Input id="smtpPass" type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} /></div>
                    </div>
                    <div className="space-y-1"><Label htmlFor="fromName">{t('integrations.smtp_from_name_label')}</Label><Input id="fromName" value={fromName} onChange={e => setFromName(e.target.value)} /></div>
                </CardContent>
                <CardFooter className="justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleTest} disabled={isTesting || isSaving}>{isTesting && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}{t('integrations.test_connection_button')}</Button>
                    <Button type="submit" disabled={isSaving || isTesting}>{isSaving && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}{t('integrations.save_smtp_button')}</Button>
                </CardFooter>
            </form>
        </Card>
    );
};

export default SMTPConfigurationForm;
