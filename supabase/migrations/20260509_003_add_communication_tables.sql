-- Add communication tables to Supabase for guest portal, WhatsApp, and email channels.
-- Includes guest portal conversations/messages, WhatsApp conversations/messages, 
-- email storage, labels, and comprehensive RLS policies.

BEGIN;

-- ============================================================================
-- GUEST PORTAL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.guest_portal_conversations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id TEXT NOT NULL,
  reservation_id TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  room_name TEXT,
  room_type TEXT,
  reservation_status TEXT CHECK (reservation_status IN ('Pending', 'Confirmed', 'Canceled', 'No-Show', 'Checked-in', 'Completed')),
  last_message_text TEXT,
  last_message_sender_type TEXT CHECK (last_message_sender_type IN ('guest', 'property')),
  last_message_sender_name TEXT,
  last_message_timestamp TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  guest_unread_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_property_id FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.guest_portal_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES public.guest_portal_conversations(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('guest', 'property')),
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  message_status TEXT DEFAULT 'sent' CHECK (message_status IN ('sent', 'delivered', 'read')),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_property_id FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.guest_portal_message_attachments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id TEXT NOT NULL REFERENCES public.guest_portal_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- WHATSAPP TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  guest_email TEXT,
  reservation_id TEXT,
  last_message_text TEXT,
  last_message_timestamp TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_property_id FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL,
  external_message_id TEXT,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('guest', 'property')),
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  message_status TEXT DEFAULT 'sent' CHECK (message_status IN ('sent', 'delivered', 'read')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_property_id FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE
);

-- ============================================================================
-- EMAIL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.property_emails (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id TEXT NOT NULL,
  uid INTEGER,
  from_name TEXT,
  from_email TEXT NOT NULL,
  subject TEXT,
  date TIMESTAMPTZ,
  date_ms BIGINT,
  snippet TEXT,
  body_text TEXT,
  body_html TEXT,
  is_unread BOOLEAN DEFAULT true,
  is_starred BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_spam BOOLEAN DEFAULT false,
  is_trash BOOLEAN DEFAULT false,
  has_attachments BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_property_id FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.email_attachments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email_id TEXT NOT NULL REFERENCES public.property_emails(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_labels (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_property_id FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE,
  UNIQUE (property_id, name)
);

CREATE TABLE IF NOT EXISTS public.email_message_labels (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email_id TEXT NOT NULL REFERENCES public.property_emails(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES public.email_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (email_id, label_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_guest_portal_conversations_property_id ON public.guest_portal_conversations(property_id);
CREATE INDEX IF NOT EXISTS idx_guest_portal_conversations_reservation_id ON public.guest_portal_conversations(reservation_id);
CREATE INDEX IF NOT EXISTS idx_guest_portal_conversations_created_at ON public.guest_portal_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_portal_conversations_is_active ON public.guest_portal_conversations(is_active);

CREATE INDEX IF NOT EXISTS idx_guest_portal_messages_conversation_id ON public.guest_portal_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_guest_portal_messages_property_id ON public.guest_portal_messages(property_id);
CREATE INDEX IF NOT EXISTS idx_guest_portal_messages_created_at ON public.guest_portal_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_property_id ON public.whatsapp_conversations(property_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_created_at ON public.whatsapp_conversations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_id ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_property_id ON public.whatsapp_messages(property_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_emails_property_id ON public.property_emails(property_id);
CREATE INDEX IF NOT EXISTS idx_property_emails_date_ms ON public.property_emails(date_ms DESC);
CREATE INDEX IF NOT EXISTS idx_property_emails_is_unread ON public.property_emails(is_unread);
CREATE INDEX IF NOT EXISTS idx_property_emails_is_starred ON public.property_emails(is_starred);

CREATE INDEX IF NOT EXISTS idx_email_labels_property_id ON public.email_labels(property_id);
CREATE INDEX IF NOT EXISTS idx_email_message_labels_email_id ON public.email_message_labels(email_id);
CREATE INDEX IF NOT EXISTS idx_email_message_labels_label_id ON public.email_message_labels(label_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Guest portal conversations
ALTER TABLE public.guest_portal_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guest_portal_conversations_select ON public.guest_portal_conversations;
DROP POLICY IF EXISTS guest_portal_conversations_insert ON public.guest_portal_conversations;
DROP POLICY IF EXISTS guest_portal_conversations_update ON public.guest_portal_conversations;
DROP POLICY IF EXISTS guest_portal_conversations_delete ON public.guest_portal_conversations;

CREATE POLICY guest_portal_conversations_select
ON public.guest_portal_conversations
FOR SELECT
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY guest_portal_conversations_insert
ON public.guest_portal_conversations
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY guest_portal_conversations_update
ON public.guest_portal_conversations
FOR UPDATE
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
)
WITH CHECK (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY guest_portal_conversations_delete
ON public.guest_portal_conversations
FOR DELETE
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
);

-- Guest portal messages
ALTER TABLE public.guest_portal_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guest_portal_messages_select ON public.guest_portal_messages;
DROP POLICY IF EXISTS guest_portal_messages_insert ON public.guest_portal_messages;
DROP POLICY IF EXISTS guest_portal_messages_update ON public.guest_portal_messages;
DROP POLICY IF EXISTS guest_portal_messages_delete ON public.guest_portal_messages;

CREATE POLICY guest_portal_messages_select
ON public.guest_portal_messages
FOR SELECT
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY guest_portal_messages_insert
ON public.guest_portal_messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY guest_portal_messages_update
ON public.guest_portal_messages
FOR UPDATE
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
)
WITH CHECK (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY guest_portal_messages_delete
ON public.guest_portal_messages
FOR DELETE
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
);

-- Guest portal message attachments
ALTER TABLE public.guest_portal_message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guest_portal_attachments_select ON public.guest_portal_message_attachments;
DROP POLICY IF EXISTS guest_portal_attachments_insert ON public.guest_portal_message_attachments;
DROP POLICY IF EXISTS guest_portal_attachments_delete ON public.guest_portal_message_attachments;

CREATE POLICY guest_portal_attachments_select
ON public.guest_portal_message_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.guest_portal_messages m
    WHERE m.id = guest_portal_message_attachments.message_id
      AND public.can_access_guest_property(m.property_id::text)
  )
);

CREATE POLICY guest_portal_attachments_insert
ON public.guest_portal_message_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.guest_portal_messages m
    WHERE m.id = guest_portal_message_attachments.message_id
      AND public.can_access_guest_property(m.property_id::text)
  )
);

CREATE POLICY guest_portal_attachments_delete
ON public.guest_portal_message_attachments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.guest_portal_messages m
    WHERE m.id = guest_portal_message_attachments.message_id
      AND public.can_access_guest_property(m.property_id::text)
  )
);

-- WhatsApp conversations
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_conversations_select ON public.whatsapp_conversations;
DROP POLICY IF EXISTS whatsapp_conversations_insert ON public.whatsapp_conversations;
DROP POLICY IF EXISTS whatsapp_conversations_update ON public.whatsapp_conversations;
DROP POLICY IF EXISTS whatsapp_conversations_delete ON public.whatsapp_conversations;

CREATE POLICY whatsapp_conversations_select
ON public.whatsapp_conversations
FOR SELECT
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY whatsapp_conversations_insert
ON public.whatsapp_conversations
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY whatsapp_conversations_update
ON public.whatsapp_conversations
FOR UPDATE
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
)
WITH CHECK (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY whatsapp_conversations_delete
ON public.whatsapp_conversations
FOR DELETE
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
);

-- WhatsApp messages
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_messages_select ON public.whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_messages_insert ON public.whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_messages_update ON public.whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_messages_delete ON public.whatsapp_messages;

CREATE POLICY whatsapp_messages_select
ON public.whatsapp_messages
FOR SELECT
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY whatsapp_messages_insert
ON public.whatsapp_messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY whatsapp_messages_update
ON public.whatsapp_messages
FOR UPDATE
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
)
WITH CHECK (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY whatsapp_messages_delete
ON public.whatsapp_messages
FOR DELETE
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
);

-- Property emails
ALTER TABLE public.property_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS property_emails_select ON public.property_emails;
DROP POLICY IF EXISTS property_emails_insert ON public.property_emails;
DROP POLICY IF EXISTS property_emails_update ON public.property_emails;
DROP POLICY IF EXISTS property_emails_delete ON public.property_emails;

CREATE POLICY property_emails_select
ON public.property_emails
FOR SELECT
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY property_emails_insert
ON public.property_emails
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY property_emails_update
ON public.property_emails
FOR UPDATE
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
)
WITH CHECK (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY property_emails_delete
ON public.property_emails
FOR DELETE
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
);

-- Email attachments
ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_attachments_select ON public.email_attachments;
DROP POLICY IF EXISTS email_attachments_insert ON public.email_attachments;
DROP POLICY IF EXISTS email_attachments_delete ON public.email_attachments;

CREATE POLICY email_attachments_select
ON public.email_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.property_emails e
    WHERE e.id = email_attachments.email_id
      AND public.can_access_guest_property(e.property_id::text)
  )
);

CREATE POLICY email_attachments_insert
ON public.email_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.property_emails e
    WHERE e.id = email_attachments.email_id
      AND public.can_access_guest_property(e.property_id::text)
  )
);

CREATE POLICY email_attachments_delete
ON public.email_attachments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.property_emails e
    WHERE e.id = email_attachments.email_id
      AND public.can_access_guest_property(e.property_id::text)
  )
);

-- Email labels
ALTER TABLE public.email_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_labels_select ON public.email_labels;
DROP POLICY IF EXISTS email_labels_insert ON public.email_labels;
DROP POLICY IF EXISTS email_labels_update ON public.email_labels;
DROP POLICY IF EXISTS email_labels_delete ON public.email_labels;

CREATE POLICY email_labels_select
ON public.email_labels
FOR SELECT
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY email_labels_insert
ON public.email_labels
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY email_labels_update
ON public.email_labels
FOR UPDATE
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
)
WITH CHECK (
  public.can_access_guest_property(property_id::text)
);

CREATE POLICY email_labels_delete
ON public.email_labels
FOR DELETE
TO authenticated
USING (
  public.can_access_guest_property(property_id::text)
);

-- Email message labels
ALTER TABLE public.email_message_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_message_labels_select ON public.email_message_labels;
DROP POLICY IF EXISTS email_message_labels_insert ON public.email_message_labels;
DROP POLICY IF EXISTS email_message_labels_delete ON public.email_message_labels;

CREATE POLICY email_message_labels_select
ON public.email_message_labels
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.property_emails e
    WHERE e.id = email_message_labels.email_id
      AND public.can_access_guest_property(e.property_id::text)
  )
);

CREATE POLICY email_message_labels_insert
ON public.email_message_labels
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.property_emails e
    WHERE e.id = email_message_labels.email_id
      AND public.can_access_guest_property(e.property_id::text)
  )
);

CREATE POLICY email_message_labels_delete
ON public.email_message_labels
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.property_emails e
    WHERE e.id = email_message_labels.email_id
      AND public.can_access_guest_property(e.property_id::text)
  )
);

COMMIT;
