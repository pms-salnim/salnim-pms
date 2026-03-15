# Guest Profile Modal - Backend Wiring & Actions Guide

## Overview
This document describes all the backend functionality and API integrations for the guest profile modal's action buttons and features.

## Cloud Functions

### 1. `sendGuestMessage` (Cloud Function)
**Location:** `functions/source/guests/sendGuestMessage.ts`

**Purpose:** Send email messages to guests from the staff portal.

**Parameters:**
```typescript
{
  guestId: string;           // Guest document ID
  guestEmail: string;        // Guest email address
  guestName: string;         // Guest full name
  message: string;           // Message body (plain text or markdown)
  propertyId: string;        // Property ID for email configuration
  messageType?: 'email' | 'whatsapp' | 'sms'; // Default: 'email'
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Features:**
- Uses property's SMTP configuration to send emails
- Creates HTML-formatted email with styling
- Stores message record in Firestore at `guests/{guestId}/messages/{messageId}`
- Logs all sent messages for audit trail
- Supports future expansion to WhatsApp and SMS

**Error Handling:**
- Returns 401 if user is not authenticated
- Returns 400 if required fields are missing
- Returns 404 if property configuration not found
- Returns 412 if SMTP not configured for property
- Returns 500 for general send failures

---

## Frontend Helper Functions

### Location: `src/lib/guestHelpers.ts`

#### 1. `sendGuestMessage(params)`
Wrapper function for calling the Cloud Function with proper error handling.

**Usage:**
```typescript
await sendGuestMessage({
  guestId: 'guest123',
  guestEmail: 'guest@example.com',
  guestName: 'John Doe',
  message: 'Welcome message text...',
  propertyId: 'prop123',
  messageType: 'email'
});
```

#### 2. `updateGuestPreferences(params)`
Updates guest preferences in Firestore.

**Parameters:**
```typescript
{
  guestId: string;
  roomPreferences?: string;      // e.g., "High floor, quiet room"
  dietaryRestrictions?: string;  // e.g., "Vegetarian, Gluten-free"
  specialOccasion?: string;      // e.g., "Anniversary"
  communicationPreference?: string; // e.g., "Email only"
}
```

**Firestore Update:**
- Adds/updates fields in `guests/{guestId}`
- Sets `updatedAt` timestamp automatically

#### 3. `addGuestNote(guestId, note)`
Adds a timestamped note to guest's internal notes.

**Features:**
- Retrieves existing notes
- Appends new note with timestamp: `[MM/DD/YYYY, HH:MM:SS AM/PM] Note text`
- Stores in `guests/{guestId}/internalNotes`

#### 4. `updateGuestNotes(guestId, notes)`
Replaces entire internal notes field.

**Usage:** Used for saving full notes from the Notes tab editor.

#### 5. `deleteGuest(guestId)`
Permanently deletes a guest and related data.

**Features:**
- Deletes main guest document
- Batch operation for efficiency
- Note: Subcollections cleanup should be handled by Cloud Function cleanup rule

#### 6. `createGuestReservationLink(guestEmail, guestName, propertySlug?)`
Generates a pre-filled booking link for a guest.

**Returns:**
```
/booking?guestEmail=john@example.com&guestName=John+Doe
OR
/booking/{propertySlug}?guestEmail=john@example.com&guestName=John+Doe
```

---

## Guest Profile Component Actions

### Component Location: `src/components/guests/guest-profile.tsx`

#### Props
```typescript
interface GuestProfileProps {
  guest: Guest;
  allReservations: Reservation[];
  onGuestDeleted?: () => void;    // Callback when guest is deleted
  onReservationCreated?: () => void; // Callback when reservation created
}
```

#### Action Buttons & Handlers

##### 1. **Send Message Button**
- **Icon:** MessageSquare (blue)
- **Dialog:** Yes (message composition modal)
- **Handler:** `handleSendMessage()`
- **Flow:**
  1. Opens dialog with message textarea
  2. User composes message
  3. Calls `sendGuestMessage()` cloud function
  4. Displays success/error toast
  5. Clears textarea and closes dialog
  6. Message stored in `guests/{id}/messages`

##### 2. **New Reservation Button**
- **Icon:** CalendarIcon (emerald)
- **Dialog:** No (direct navigation)
- **Handler:** Direct URL navigation
- **Flow:**
  ```javascript
  window.location.href = `/booking?guestEmail=${guest.email}&guestName=${encodeURIComponent(guest.fullName)}`;
  ```
- **Expected:** Booking form should pre-populate guest email/name

##### 3. **Add Note Button**
- **Icon:** FileText (outline)
- **Dialog:** Yes (quick note modal)
- **Handler:** `handleSaveQuickNote()`
- **Flow:**
  1. Opens dialog with note textarea
  2. User enters quick note
  3. Timestamps and appends to existing notes
  4. Calls `updateGuestNotes()`
  5. Updates local state for immediate UI feedback
  6. Closes dialog

##### 4. **Delete Guest Button**
- **Icon:** Trash (red, right-aligned)
- **Dialog:** Yes (confirmation alert)
- **Handler:** `handleDeleteGuest()`
- **Flow:**
  1. Opens alert dialog asking for confirmation
  2. User confirms deletion
  3. Calls `deleteGuest()` helper
  4. Displays success toast
  5. Triggers `onGuestDeleted()` callback
  6. Parent component closes profile dialog

---

## Preferences Tab - Editable Fields

### Editable Fields
All fields support real-time editing with save button:

1. **Room Preferences** (Input field)
   - Placeholder: "e.g., High floor, quiet room, near elevator"
   - Stored in: `guests/{id}/roomPreferences`

2. **Dietary Restrictions** (Input field)
   - Placeholder: "e.g., Vegetarian, Gluten-free, Shellfish allergy"
   - Stored in: `guests/{id}/dietaryRestrictions`

3. **Special Occasions** (Input field)
   - Placeholder: "e.g., Anniversary, Birthday, Honeymoon"
   - Stored in: `guests/{id}/specialOccasion`

4. **Communication Preferences** (Input field)
   - Placeholder: "e.g., Email only, Prefer WhatsApp"
   - Stored in: `guests/{id}/communicationPreference`

### Save Mechanism
- "Save Preferences" button at bottom of Preferences tab
- Handler: `handleSavePreferences()`
- Updates all changed fields in single Firestore batch
- Sets `updatedAt` timestamp
- Shows loading spinner during save
- Toast notification on success/error

---

## State Management

### Dialog States
```typescript
const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
const [messageText, setMessageText] = useState('');
const [isSendingMessage, setIsSendingMessage] = useState(false);

const [isAddNoteDialogOpen, setIsAddNoteDialogOpen] = useState(false);
const [quickNote, setQuickNote] = useState('');
const [isSavingQuickNote, setIsSavingQuickNote] = useState(false);

const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
const [isDeletingGuest, setIsDeletingGuest] = useState(false);
```

### Preferences States
```typescript
const [roomPreferences, setRoomPreferences] = useState(guest.roomPreferences || '');
const [dietaryRestrictions, setDietaryRestrictions] = useState(guest.dietaryRestrictions || '');
const [specialOccasion, setSpecialOccasion] = useState(guest.specialOccasion || '');
const [communicationPreference, setCommunicationPreference] = useState(guest.communicationPreference || '');
const [isSavingPreferences, setIsSavingPreferences] = useState(false);
```

---

## Error Handling & Validation

### Message Sending
- ✅ Checks message text is not empty
- ✅ Checks guest email exists
- ✅ Checks property ID is available
- ✅ Catches cloud function errors
- ✅ Shows user-friendly error messages

### Note Saving
- ✅ Validates guest ID exists
- ✅ Retrieves current notes before appending
- ✅ Includes timestamp for audit trail
- ✅ Shows save status with spinner

### Guest Deletion
- ✅ Shows confirmation alert before deletion
- ✅ Prevents accidental deletions
- ✅ Validates guest ID exists
- ✅ Triggers parent callback for UI cleanup

### Preferences Saving
- ✅ Only updates fields that were modified
- ✅ Validates guest ID
- ✅ Shows loading state during save
- ✅ Displays success/error feedback

---

## Toast Notifications

All actions provide user feedback via toast notifications:

```typescript
// Success
toast({ title: 'Success', description: 'Action completed successfully' });

// Error
toast({ 
  title: 'Error', 
  description: 'Action failed with error message', 
  variant: "destructive" 
});
```

---

## Integration with Parent Component

### Guest Page Integration
**File:** `src/app/(app)/guests/all/page.tsx`

The guest profile modal is integrated into the guests page with callbacks:

```typescript
<GuestProfile 
  guest={selectedGuest} 
  allReservations={reservations}
  onGuestDeleted={() => {
    setIsViewProfileOpen(false);
    setSelectedGuest(null);
    window.location.reload(); // Refresh guest list
  }}
  onReservationCreated={() => {
    setIsViewProfileOpen(false); // Close profile dialog
  }}
/>
```

---

## Future Enhancements

### Planned Features
1. **WhatsApp Integration** - Send messages via WhatsApp API
2. **SMS Integration** - Send messages via SMS gateway
3. **Email Templates** - Use predefined templates for common messages
4. **Bulk Actions** - Send message/note to multiple guests
5. **Message History** - View all messages sent to guest
6. **Preferences Sync** - Auto-sync preferences with booking form
7. **Room Assignment** - Assign room based on preferences
8. **Communication Log** - Track all guest communications

---

## Database Schema

### Guests Collection
```
guests/{guestId}
  ├── email: string
  ├── fullName: string
  ├── roomPreferences: string
  ├── dietaryRestrictions: string
  ├── specialOccasion: string
  ├── communicationPreference: string
  ├── internalNotes: string (multi-line with timestamps)
  ├── updatedAt: Timestamp
  └── messages/ (subcollection)
       └── {messageId}
            ├── guestEmail: string
            ├── guestName: string
            ├── message: string
            ├── messageType: 'email' | 'whatsapp' | 'sms'
            ├── status: 'sent' | 'failed'
            ├── sentAt: Timestamp
            ├── sentBy: string (user ID)
            └── propertyId: string
```

---

## Testing Checklist

- [ ] Send message to guest - verify email received
- [ ] Add quick note - verify appended with timestamp
- [ ] Save preferences - verify all fields updated
- [ ] Delete guest - verify confirmation dialog, deletion successful
- [ ] New reservation - verify booking form pre-filled with guest data
- [ ] Toast notifications - verify success/error messages display
- [ ] Spinner indicators - verify loading states show during operations
- [ ] Dialog close behavior - verify dialogs close after action completion
- [ ] Parent callbacks - verify page updates after guest deletion
- [ ] Error handling - verify graceful error messages for failures

