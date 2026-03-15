# Backend Functions - Quick Reference

## Created Files
- `functions/source/property-settings/system/loadPreferences.ts` ✅
- `functions/source/property-settings/system/savePreferences.ts` ✅
- `functions/source/property-settings/system/validatePreferencesConflict.ts` ✅
- `functions/source/property-settings/system/index.ts` ✅
- `functions/source/property-settings/index.ts` ✅

## Function Signatures

### loadPreferences()
```typescript
await callFunction('loadPreferences', {
  propertyId: string
})
// Returns: { success, preferences, isDefault, lastUpdated, updatedBy }
```

### savePreferences()
```typescript
await callFunction('savePreferences', {
  propertyId: string,
  preferences: {
    applicationLanguage: string,
    propertyTimeZone: string,
    applicationCurrency: string,
    // ... 20 more fields
  }
})
// Returns: { success, propertyId, savedAt, message }
```

### validatePreferencesConflict()
```typescript
await callFunction('validatePreferencesConflict', {
  preferences: PreferencesData
})
// Returns: { hasConflict, conflicts, summary }
```

## Access Control
- **Load:** Any property team member (read-only)
- **Save:** Property admin or manager only
- **Validate:** Any authenticated user

## Validation Performed
- ✅ Required fields check
- ✅ Enum validation (language, timezone, currency, etc.)
- ✅ Range validation (e.g., cancellation window 0-365)
- ✅ Time format validation (HH:MM)
- ✅ Conflict detection (optional warnings)
- ✅ User permission verification

## Error Handling
All functions throw `HttpsError` with descriptive messages:
- `invalid-argument`: Missing or malformed data
- `unauthenticated`: User not logged in
- `permission-denied`: User lacks required role
- `not-found`: Property not found
- `internal`: Server errors

## Audit Trail
All saves are logged to `properties/{propertyId}/audit` including:
- What changed (field names)
- Who made the change (email, UID)
- When (server timestamp)
- Success/failure status
- Error message (if failed)
