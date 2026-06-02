# Email & WhatsApp Component Migration Guide

## Component Migration Path

### For Email Components
Replace all Firebase calls with `emailApi` client:

```typescript
// OLD - Firebase Cloud Function
const token = await auth.currentUser?.getIdToken();
await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/sendComposedEmail', {
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ ... })
});

// NEW - Supabase API via emailApi client
import { emailApi } from '@/lib/communication-api';
const result = await emailApi.sendComposed(propertyId, emailData);
```

### For WhatsApp Component
Replace Firebase onSnapshot with polling:

```typescript
// OLD - Firebase Firestore listener
const unsubscribe = onSnapshot(q, (snapshot) => {
  // handle messages
});

// NEW - Supabase API polling
useEffect(() => {
  const loadConversations = async () => {
    const result = await whatsappApi.listConversations(propertyId);
    setConversations(result?.conversations || []);
  };
  loadConversations();
  const interval = setInterval(loadConversations, 3000);
  return () => clearInterval(interval);
}, [propertyId]);
```

## Field Mappings

### Email Schema Mapping
| Firebase | Supabase |
|----------|----------|
| N/A | id (uuid text) |
| N/A | property_id |
| N/A | uid (IMAP UID) |
| from | from_email, from_name |
| subject | subject |
| date | date (TIMESTAMPTZ), date_ms |
| snippet/preview | snippet |
| body | body_text, body_html |
| flags (read) | is_unread |
| flags (starred) | is_starred |
| N/A | is_archived, is_spam, is_trash |
| attachments | attachments array |

### WhatsApp Schema Mapping  
| Firebase | Supabase |
|----------|----------|
| N/A | id (uuid text) |
| phoneNumber | guest_phone |
| guestName | guest_name |
| N/A | guest_email, reservation_id |
| N/A | unread_count |
| messages | separate whatsapp_messages table |

## Component Files to Update

### 1. Email Page/List Components
- **File**: `src/components/guests/communication/EmailListItem.tsx`
- **Changes**:
  - Replace Firestore document with Supabase email object
  - Map field names (is_unread → unread, is_starred → starred, etc.)
  - Update action handlers to use `emailApi`

- **File**: `src/components/guests/communication/EmailDetailView.tsx`
- **Changes**:
  - Fetch single email with `emailApi.getEmail()`
  - Update flag/action handlers

### 2. Compose & Reply Forms
- **File**: `src/components/guests/compose-email-form.tsx`
- **Changes**:
  - Replace Firebase callable with `emailApi.sendComposed()`
  - Update request/response structure
  - Handle error states from API

- **File**: `src/components/guests/reply-email-form.tsx`
- **Changes**:
  - Replace Firebase callable with `emailApi.sendReply()` (new API action)
  - Update threading/references

### 3. WhatsApp Component
- **File**: `src/components/guests/communication/WhatsAppChatView.tsx`
- **Changes**:
  - Remove Firebase imports
  - Replace onSnapshot with polling using `whatsappApi.listConversations()`
  - Update message sending with `whatsappApi.sendMessage()`
  - Update mark-as-read with `whatsappApi.markAsRead()`
  - Map Firebase schema to Supabase schema
  - Handle conversation grouping from conversations table (not messages)

### 4. Settings Components
- **File**: `src/components/guests/communication/SMTPConfigurationForm.tsx`
- **Changes**:
  - Replace Firebase callable with API route `/api/property-settings/communication-channels`
  - Use `emailApi.testSmtp()` for verification

- **File**: `src/components/guests/communication/IMAPConfigurationForm.tsx`
- **Changes**:
  - Replace Firebase callable with API route
  - Use `emailApi.testImap()` for verification

## New API Actions Needed

### Email API ✅
```typescript
// Implemented actions in email API route:
- sendComposed - Compose new email and send via SMTP
- sendReply - Send reply to existing email via SMTP
```

## Data Shape Examples

### Supabase Email
```typescript
{
  id: "uuid",
  property_id: "property-id",
  uid: 12345,
  from_name: "John",
  from_email: "john@example.com",
  subject: "Hello",
  date: "2026-05-11T10:00:00Z",
  date_ms: 1715401200000,
  snippet: "Hello, how are you?",
  body_text: "...",
  body_html: "...",
  is_unread: false,
  is_starred: true,
  is_archived: false,
  is_spam: false,
  is_trash: false,
  has_attachments: false,
  created_at: "2026-05-11T10:00:00Z",
  updated_at: "2026-05-11T10:00:00Z",
  attachments: [...],
  labels: [...]
}
```

### Supabase WhatsApp Conversation
```typescript
{
  id: "uuid",
  property_id: "property-id",
  guest_name: "Alice",
  guest_phone: "+11234567890",
  guest_email: "alice@example.com",
  reservation_id: "res-123",
  last_message_text: "Thanks!",
  last_message_timestamp: "2026-05-11T10:00:00Z",
  unread_count: 0,
  is_active: true,
  created_at: "2026-05-11T10:00:00Z",
  updated_at: "2026-05-11T10:00:00Z"
}
```

## Migration Checklist

- [ ] Create email and whatsapp API routes ✅
- [ ] Create communication-api.ts client ✅
- [ ] Update EmailListItem.tsx
- [ ] Update EmailDetailView.tsx
- [ ] Update compose-email-form.tsx
- [ ] Update reply-email-form.tsx
- [ ] Update WhatsAppChatView.tsx
- [ ] Update SMTP/IMAP form verification
- [ ] Test email actions (mark read, star, archive, etc.)
- [ ] Test WhatsApp message sending and receiving
- [ ] Test email compose and reply
