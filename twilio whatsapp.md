Great. Here is the production blueprint I’d implement now for Twilio WhatsApp on Vercel + Supabase + queue workers.

Target Stack

Vercel: webhook entrypoint + PMS APIs
Supabase Postgres: source of truth for threads/messages/state
Supabase Realtime: inbox live updates
Inngest or Upstash QStash: async jobs (AI, retries, fallback templates)
Twilio: WhatsApp/SMS transport
Core Principle
Webhook route only validates, stores, and enqueues.
No AI call and no heavy logic inline.


Tables to Create

property_channels
property_id
channel_type (whatsapp, sms)
provider (twilio)
account_sid, auth_token_encrypted
from_number / whatsapp_sender
environment (sandbox, production)
is_active
conversation_threads
id
property_id
channel_type
guest_phone_e164
guest_name
guest_id nullable
last_inbound_at
last_outbound_at
session_expires_at (last inbound + 24h)
ai_mode (off, suggest, auto)
status (open, archived, closed)
unread_count
unique(property_id, channel_type, guest_phone_e164)
conversation_messages
id
thread_id
property_id
provider_message_sid unique
direction (inbound, outbound)
message_type (text, media, template)
body
media_json
is_template
template_name
template_language
delivery_status (queued, sent, delivered, read, failed)
error_code, error_message
ai_generated bool
created_at
webhook_events
id
provider (twilio)
event_type
provider_event_id
payload_json
received_at
processed_at
status
unique(provider, provider_event_id)
Webhook Handling

Verify Twilio signature first.
Resolve property using destination number (To).
Idempotency check using MessageSid in webhook_events and conversation_messages.
Upsert thread + insert inbound message.
Update thread.session_expires_at = inbound_time + 24h.
Return 200 immediately.
Enqueue async job for AI/automation.
This makes retries safe and prevents duplicate messages when Twilio retries.

AI Reply State Machine

inbound_received
policy_check
property AI mode
guest opt-out
quiet hours
handoff tag (human-owned thread)
session_check
if now <= session_expires_at → free-form allowed
else template required
compose_reply
AI generation (or skip)
send_message
free-form or template send via Twilio
persist_outbound
store outbound message + status
fail/retry
exponential backoff with max attempts
dead-letter state + alert if exhausted
24-Hour Rule Enforcement
Outbound decision logic:

If in session window: send normal body text
If outside window:
if approved template exists: send template
if no template: mark thread as needs_template and notify staff
Never attempt free-form outside session window.

Unified Inbox Behavior

One thread per property + guest phone + channel
Merge inbound/outbound in same timeline
Unread increments on inbound only
Mark read updates thread unread_count and message flags
All updates come from DB; UI never owns source-of-truth state
Security + Reliability

Encrypt Twilio tokens at rest
Restrict DB writes via service role only in backend
Store raw webhook payload in webhook_events for audit/debug
Add rate limits per property for outbound AI
Use status callback webhook to reconcile final delivery state
Rollout Plan

Phase 1: Sandbox inbound/outbound + thread UI
Phase 2: Production numbers + status callbacks
Phase 3: AI auto-reply in suggest mode
Phase 4: Full auto mode + template fallback automation
If you want, next step I can give you the exact API contract for:

inbound webhook
send message endpoint
status callback webhook
worker job payloads and retry rules