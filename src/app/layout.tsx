"use client";

import './globals.css';
import 'react-day-picker/style.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <head>
          <title>Salnim Pms</title>
          <meta name="description" content="Streamlined Property Management System." />
          <link rel="icon" href="/favicon.webp" type="image/webp" sizes="any" />
      </head>
      <body className="antialiased">
        <I18nextProvider i18n={i18n}>
            <AuthProvider>
            {children}
            <Toaster />
            </AuthProvider>
        </I18nextProvider>
      </body>
    </html>
  );
}
