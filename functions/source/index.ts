
"use strict";

// --- EXPORT CLOUD FUNCTIONS ---
// This file acts as the main entry point for all your Cloud Functions.
// It re-exports all the functions from their respective module folders.

// Property Management
export * from './Property';

// Property Settings
export * from './property-settings';

// Billing & Payments
export * from './billing';

// Booking & Reservations
export * from './booking';

// Email Communications
export * from './email';

// Guest Management
export * from './guests';

// Guest Portal
export * from './guest-portal';

// Housekeeping Management
export * from './housekeeping';

// Staff & Team Management
export * from './staff';

// WhatsApp Integration
export { verifyWhatsAppConnection } from './whatsapp/verifyConnection';
export { createWhatsAppTemplate } from './whatsapp/createTemplate';
export { sendWhatsAppMessage } from './whatsapp/sendMessage';
export { whatsappWebhook } from './whatsapp/webhook';

// Utility export (if needed elsewhere)
export { generateSlug } from "./lib/utils";
