
"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    debug: false, // Set to true to see i18next logs in the console
    preload: ['en', 'fr'], // Preload languages for server-side/PDF rendering
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: {
      escapeValue: false, 
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    ns: ['translation', 'signup', 'forgot-password', 'sidebar', 'country', 'country-code', 'pages/payments/list/payment-form', 'pages/payments/pending/content', 'pages/staff/all/content', 'pages/revenue/overview/content', 'booking', 'amenities', 'booking_extras', 'booking_confirmation', 'booking_packages', 'pdf_content', 'pages/team-workspace/bulk-actions', 'pages/staff/management', 'status/status_content', 'performance-report-pdf', 'pages/revenue/performance-reports', 'pages/revenue/expenses', 'pages/reservations/activity/content', 'pages/guests/loyalty/content', 'pages/reservations/all/content', 'pages/rooms/list/content', 'pages/rooms/types/content', 'pages/rate-plans/all/content', 'pages/rate-plans/promotions/content', 'pages/rate-plans/seasonal/content', 'pages/extra/service/content', 'pages/extra/meal-plans/content', 'pages/extra/packages/content', 'pages/dashboard/check-availability-card-content', 'pages/dashboard/content', 'pages/dashboard/reservation-details-modal-content', 'pages/dashboard/reservation-form', 'pages/guests/communication/content', 'pages/payments/invoices/content', 'pages/payments/process_refund', 'send-email-guest', 'pages/settings/booking/content', 'pages/settings/email-templates/content', 'pages/settings/notifications/content', 'pages/settings/property/content', 'pages/settings/user/content', 'pages/staff/management', 'pages/staff/all/content', 'pages/guests/all/content', 'pages/revenue/revenue-log/content', 'pages/team-workspace/bulk-actions', 'pages/team-workspace/messages/page', 'pages/team-workspace/tasks'],
    defaultNS: 'translation'
  });

export default i18n;
