
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
    ns: ['translation', 'signup', 'forgot-password', 'sidebar', 'country', 'country-code', 'pages/payments/list/payment-form', 'pages/payments/pending/content', 'pages/staff/all/content', 'pages/revenue/overview/content', 'pages/settings/email-templates/content'],
    defaultNS: 'translation'
  });

export default i18n;
