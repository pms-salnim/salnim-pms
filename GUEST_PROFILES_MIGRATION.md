# Guest Profiles Settings - Supabase Migration Guide

## Overview

This guide provides step-by-step instructions for migrating the Guest Profiles Settings module from Firebase Firestore to Supabase. The settings contain complex configuration for guest management, loyalty programs, custom fields, and more.

## Files Created/Modified

### 1. Database Migration
- **File**: `supabase/migrations/guest_profile_settings.sql`
- **Description**: SQL migration that creates the `guest_profile_settings` table with JSONB storage for flexibility
- **Key Features**:
  - JSONB column for storing entire settings object
  - Row-level security (RLS) policies for property-based access control
  - Auto-timestamp management
  - Unique constraint on property_id (one settings record per property)

### 2. API Routes
- **File**: `src/app/api/property-settings/guest-profiles/route.ts`
- **Description**: Next.js API endpoints for managing guest profile settings
- **Endpoints**:
  - `GET /api/property-settings/guest-profiles` - Fetches settings for user's property
  - `POST /api/property-settings/guest-profiles` - Saves/updates settings for user's property
- **Security**: Uses server-side authentication with Supabase

### 3. Type Definitions
- **File**: `src/types/guest-profile.ts`
- **Description**: Comprehensive TypeScript types for guest profile configuration
- **Types Exported**:
  - `GuestProfileSettings` - Main settings interface
  - `CoreFieldConfig` - Core field configuration
  - `CustomField` - Custom field definition
  - `NoteCategory` - Note category
  - `Status` - Guest status/flag
  - `LoyaltyTier` - Loyalty program tier

### 4. Utility Functions
- **File**: `src/lib/guest-profile-utils.ts`
- **Description**: Helper functions for API interactions
- **Functions**:
  - `fetchGuestProfileSettings()` - GET request wrapper
  - `saveGuestProfileSettings()` - POST request wrapper

### 5. Frontend Component (Updated)
- **File**: `src/app/(app)/property-settings/communication/guests-profiles/page.tsx`
- **Changes**:
  - Removed Firebase imports
  - Updated `loadSettings()` to use API instead of Firestore
  - Updated `handleSave()` to use API POST instead of Firestore update
  - Updated `handleResetToDefaults()` to use API instead of Firestore
  - Integrated new types from `@/types/guest-profile`

## Migration Steps

### Step 1: Run Database Migration
Execute the SQL migration to create the `guest_profile_settings` table:

```bash
# Using Supabase CLI
supabase migration up

# Or manually execute the SQL in Supabase dashboard
# Copy contents of supabase/migrations/guest_profile_settings.sql
```

### Step 2: Migrate Existing Data (Optional)

If you have existing guest profile settings in Firebase, migrate them:

```typescript
// Example: One-time migration script
import { createClient } from '@supabase/supabase-js';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrateGuestProfileSettings(propertyId: string) {
  try {
    // 1. Fetch from Firebase
    const firebaseDocRef = doc(db, 'properties', propertyId);
    const firebaseDoc = await getDoc(firebaseDocRef);
    const firebaseSettings = firebaseDoc.data()?.guestProfileSettings;

    if (!firebaseSettings) return;

    // 2. Save to Supabase
    const { error } = await supabase
      .from('guest_profile_settings')
      .upsert([
        {
          property_id: propertyId,
          settings: firebaseSettings,
        },
      ]);

    if (error) throw error;
    console.log(`Migrated settings for property: ${propertyId}`);
  } catch (error) {
    console.error('Migration error:', error);
  }
}
```

### Step 3: Test the Setup

1. Navigate to Guest Profiles settings page
2. Verify settings load correctly (should show defaults or existing settings)
3. Modify a few settings
4. Click Save
5. Refresh page to verify changes persisted
6. Try resetting to defaults

### Step 4: Deploy

```bash
# Build and test locally
npm run dev

# Deploy to production
# (Follow your deployment process)
```

## API Endpoint Details

### GET /api/property-settings/guest-profiles

**Response (Success - 200)**:
```json
{
  "settings": {
    "autoCreateProfile": true,
    "autoCreateForWalkIns": true,
    "enableMultiPropertyAggregation": false,
    "coreFieldsConfig": [...],
    "customFields": [...],
    "loyaltyTiers": [...]
  }
}
```

**Response (No Settings - 200)**:
```json
{
  "settings": {}
}
```

**Response (Error - 401/500)**:
```json
{
  "error": "Unauthorized" | "Internal server error"
}
```

### POST /api/property-settings/guest-profiles

**Request**:
```json
{
  "settings": {
    "autoCreateProfile": true,
    "autoCreateForWalkIns": true,
    ... (full settings object)
  }
}
```

**Response (Success - 200)**:
```json
{
  "message": "Settings saved successfully",
  "data": {
    "id": "uuid",
    "property_id": "uuid",
    "settings": {...},
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**Response (Error)**:
```json
{
  "error": "Failed to save settings" | "Settings data is required"
}
```

## Database Schema

### guest_profile_settings Table

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `property_id` | UUID | Foreign key to properties table |
| `settings` | JSONB | Complete settings object |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

### Indexes
- `idx_guest_profile_settings_property_id` on `property_id`

### Constraints
- UNIQUE on `property_id` (one settings record per property)

## Security

### Row Level Security (RLS)

Four RLS policies control access:

1. **SELECT**: Users can view settings for their own property
2. **INSERT**: Users can create settings for their property
3. **UPDATE**: Users can modify settings for their property
4. **DELETE**: Users can delete settings for their property

All policies check if the `property_id` belongs to the authenticated user.

## Troubleshooting

### Settings not loading
- Check browser console for errors
- Verify user is authenticated
- Ensure user has a linked property_id
- Check RLS policies are correctly configured

### "Failed to save settings"
- Check network tab for API response details
- Verify property_id exists in properties table
- Check RLS policy permissions
- Ensure settings object is valid JSON

### Settings not persisting after save
- Verify response status is 200
- Check Supabase database for new/updated rows
- Verify UNIQUE constraint on property_id

## Using Helper Functions

Simplify API interactions using utility functions:

```typescript
import { 
  fetchGuestProfileSettings, 
  saveGuestProfileSettings 
} from '@/lib/guest-profile-utils';

// Fetch settings
const settings = await fetchGuestProfileSettings();

// Save settings
await saveGuestProfileSettings({
  autoCreateProfile: true,
  // ... other settings
});
```

## Environment Variables

Ensure these are configured in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key
```

## Next Steps

1. Monitor error logs after deployment
2. Gather user feedback on the new interface
3. Consider additional customization options based on feedback
4. Plan for future enhancements (import/export, templates, etc.)

## Related Documentation

- [Guest Profile Settings Schema](../GUEST_PROFILE_BACKEND.md)
- [Property Settings Structure](../PROPERTY_SETTINGS_STRUCTURE.md)
- [Supabase Documentation](https://supabase.com/docs)
- [API Routes Documentation](../../API_ROUTES.md)
