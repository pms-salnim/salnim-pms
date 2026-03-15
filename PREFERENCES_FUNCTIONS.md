# Preferences Backend Functions - Implementation Summary

## Overview
Created three complete Cloud Functions for managing system preferences in the Property Settings module. All functions follow the existing codebase patterns and structure.

## Functions Created

### 1. `loadPreferences`
**File:** `functions/source/property-settings/system/loadPreferences.ts`

**Purpose:** Loads property preferences from Firestore. Returns default preferences if none exist.

**Key Features:**
- Retrieves preferences from `properties/{propertyId}/settings/preferences`
- Returns hardcoded defaults if document doesn't exist
- Includes access control verification (checks user is part of property team)
- Returns metadata: `lastUpdated`, `updatedBy`, `isDefault` flag

**Input:**
```typescript
{
  propertyId: string
}
```

**Output:**
```typescript
{
  success: boolean,
  preferences: PreferencesData,
  isDefault: boolean,
  lastUpdated: Date | null,
  updatedBy: string | null
}
```

---

### 2. `savePreferences`
**File:** `functions/source/property-settings/system/savePreferences.ts`

**Purpose:** Saves property preferences to Firestore with comprehensive validation and audit logging.

**Key Features:**
- **Validation:** Validates all 23 settings against their expected types and enums
- **Access Control:** Only admins and managers can modify preferences
- **Metadata:** Auto-adds `updatedAt` (server timestamp), `updatedBy` (user email), `version`
- **Audit Trail:** Logs all changes (successful and failed) to `properties/{propertyId}/audit`
- **Error Handling:** Detailed validation errors returned to client

**Validation Rules:**
- Required fields: `applicationLanguage`, `propertyTimeZone`, `applicationCurrency`, `timeFormat`
- Enum validation for: language, time format, currency format, date format, name format, week start, breakfast distribution
- Range validation: `guestCancellationWindow` (0-365)
- Time format validation: `sameDayCutoffTime` (HH:MM)

**Input:**
```typescript
{
  propertyId: string,
  preferences: PreferencesData (23 fields)
}
```

**Output:**
```typescript
{
  success: boolean,
  propertyId: string,
  savedAt: string (ISO timestamp),
  message: string
}
```

**Audit Trail Document:**
```typescript
{
  action: 'update_preferences',
  timestamp: serverTimestamp(),
  userId: string,
  userEmail: string,
  changedFields: string[], // array of field names
  status: 'success' | 'failed',
  error?: string // only on failed attempts
}
```

---

### 3. `validatePreferencesConflict`
**File:** `functions/source/property-settings/system/validatePreferencesConflict.ts`

**Purpose:** Real-time validation to detect logical conflicts and warn users before saving.

**Key Features:**
- Detects conflicting preference combinations
- Returns severity levels: `warning` (must acknowledge) or `info` (advisory)
- Non-blocking validation (doesn't prevent save, just warns)

**Detected Conflicts:**
1. **Full payment required + Same-day bookings** → WARNING
   - Message: "Same-day bookings may fail if payment is not received in time"

2. **Auto no-show + No auto-assign** → INFO
   - Message: "Manual room assignment is needed for accurate no-show marking"

3. **Require guest ID + No room selection** → INFO
   - Message: "Guest won't see ID upload option until check-in confirmation"

4. **Payment allocation without full payment** → INFO
   - Message: "Guests may have unpaid balances"

5. **GDPR enabled** → INFO (logging only)

**Input:**
```typescript
{
  preferences: PreferencesData
}
```

**Output:**
```typescript
{
  hasConflict: boolean,
  conflicts: Array<{
    setting1: string,
    setting2: string,
    message: string,
    severity: 'warning' | 'info'
  }>,
  summary: string
}
```

---

## Directory Structure
```
functions/source/
├── property-settings/
│   ├── index.ts (exports system)
│   └── system/
│       ├── index.ts (exports all three functions)
│       ├── loadPreferences.ts
│       ├── savePreferences.ts
│       └── validatePreferencesConflict.ts
```

---

## Firestore Collections

### `properties/{propertyId}/settings/preferences`
**Document Structure:**
```typescript
{
  // Localization & Format (6 fields)
  applicationLanguage: string,
  propertyTimeZone: string,
  applicationCurrency: string,
  currencyFormat: 'symbol' | 'code' | 'name',
  dateFormat: 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd',
  timeFormat: '12h' | '24h',

  // Reservation & Availability (7 fields)
  allowOverbooking: boolean,
  autoNoShowAfterArrival: boolean,
  autoAssignRooms: boolean,
  allowSameDayBookings: boolean,
  sameDayCutoffTime: string, // HH:MM format
  autoCheckoutExtension: boolean,
  useDefaultCountry: boolean,
  defaultCountry: string,

  // Calendar & Display (7 fields)
  showEstimatedArrivalTime: boolean,
  enableGDPRFeatures: boolean,
  enablePaymentAllocation: boolean,
  requireFullPaymentBeforeCheckin: boolean,
  showCheckoutsInDeparture: boolean,
  calendarNameFormat: 'firstLast' | 'lastFirst' | 'firstOnly',
  calendarWeekStart: 'sunday' | 'monday' | 'saturday',

  // Channel & Rate Distribution (1 field)
  breakfastChannelDistribution: 'included' | 'extra' | 'variable',

  // Guest & Reservation Experience (3 fields)
  requireGuestIdUpload: boolean,
  allowGuestRoomSelection: boolean,
  guestCancellationWindow: number,

  // Metadata
  createdAt?: timestamp,
  updatedAt: timestamp,
  updatedBy: string, // user email
  version: number // for migration tracking
}
```

### `properties/{propertyId}/audit` (sub-collection)
Stores audit trail of all preference changes for compliance and debugging.

---

## Integration with Frontend

The frontend Preferences page has two TODO comments for backend integration:

1. **In `useEffect()` - Load preferences on page load:**
```typescript
const loadPrefs = async () => {
  const result = await callFunction('loadPreferences', { propertyId });
  setPreferences(result.preferences);
};
```

2. **In `handleSavePreferences()` - Save preferences on form submit:**
```typescript
const handleSavePreferences = async (data) => {
  return callFunction('savePreferences', { propertyId, preferences: data });
};
```

**Optional validation before save:**
```typescript
const conflicts = await callFunction('validatePreferencesConflict', { preferences: data });
if (conflicts.hasConflict) {
  // Show warnings to user before final save
}
```

---

## Security Rules (To Be Added to firestore.rules)

```javascript
match /properties/{propertyId}/settings/preferences {
  allow read: if request.auth.uid != null 
    && isPropertyUser(propertyId, request.auth.uid);
  
  allow write: if request.auth.uid != null 
    && isPropertyAdmin(propertyId, request.auth.uid)
    && validatePreferencesStructure(request.resource.data);
}

match /properties/{propertyId}/audit/{auditId} {
  allow read: if request.auth.uid != null 
    && isPropertyAdmin(propertyId, request.auth.uid);
  
  allow write: if false; // Only backend functions can write
}

function validatePreferencesStructure(data) {
  return data.keys().hasAll([
    'applicationLanguage', 'propertyTimeZone', 'applicationCurrency',
    'timeFormat', 'guestCancellationWindow'
  ])
  && data.applicationLanguage in ['en', 'fr', 'es', 'de', 'it', 'pt']
  && data.timeFormat in ['12h', '24h'];
}
```

---

## Default Preferences
All 23 settings have sensible defaults defined in `loadPreferences.ts`:

```typescript
{
  applicationLanguage: 'en',
  propertyTimeZone: 'UTC',
  applicationCurrency: 'USD',
  currencyFormat: 'symbol',
  dateFormat: 'mm/dd/yyyy',
  timeFormat: '24h',
  allowOverbooking: false,
  autoNoShowAfterArrival: false,
  autoAssignRooms: false,
  allowSameDayBookings: false,
  sameDayCutoffTime: '18:00',
  autoCheckoutExtension: false,
  useDefaultCountry: false,
  defaultCountry: 'US',
  showEstimatedArrivalTime: true,
  enableGDPRFeatures: true,
  enablePaymentAllocation: false,
  requireFullPaymentBeforeCheckin: false,
  showCheckoutsInDeparture: true,
  calendarNameFormat: 'firstLast',
  calendarWeekStart: 'monday',
  breakfastChannelDistribution: 'included',
  requireGuestIdUpload: false,
  allowGuestRoomSelection: true,
  guestCancellationWindow: 7
}
```

---

## Build Status
✅ Functions build successfully with TypeScript compiler
✅ Main app builds successfully in 7.1s
✅ All three functions exported in main index.ts

---

## Next Steps
1. Add Firestore Security Rules (see above)
2. Update frontend to call `loadPreferences` in useEffect
3. Update frontend to call `savePreferences` in handleSavePreferences
4. (Optional) Add real-time conflict validation with `validatePreferencesConflict`
5. Deploy functions: `firebase deploy --only functions`
