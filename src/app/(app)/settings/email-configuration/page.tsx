
"use client";

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function EmailConfigurationPage() {
  const { t } = useTranslation('pages/settings/email-templates/content');
  return (
    <Alert>
      <Mail className="h-4 w-4" />
      <AlertTitle>{t('moved.title')}</AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <span>{t('moved.description')}</span>
        <Button asChild variant="outline" size="sm" className="mt-2 sm:mt-0">
          <Link href="/guests/communication?view=settings_integrations">
            {t('moved.button')}
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
