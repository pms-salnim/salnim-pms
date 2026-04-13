# ✅ Availability Page & Review Modal - Wiring Status

## Summary
**Both the availability page and review update modal are fully wired to the Supabase Edge Function.**

---

## 1️⃣ Availability Page (RatesAvailabilityEditor)

### Component Chain
```
RatesAvailabilityEditor
  ├─ Component: src/components/rates-availability/rates-availability-editor.tsx
  ├─ Calls: createOrUpdateAvailability() [from api-client.ts]
  ├─ Endpoint: POST /api/property-settings/rates-availability/availability
  ├─ Bridge: src/app/api/property-settings/rates-availability/availability/route.ts
  └─ Edge Function: supabase/functions/save-availability/index.ts
```

### Code Flow
```typescript
// Step 1: User updates dates in the calendar
const handleApplyStatus = async (status: string) => {
  const updates = selectedDates.map(date => ({
    date: formatDate(date),
    status,
  }));
  
  // Step 2: Calls API client function
  await createOrUpdateAvailability(propertyId, updates);
};

// Step 3: API Client
export async function createOrUpdateAvailability(propertyId: string, availabilities: any[]) {
  const response = await fetch(`${BASE_PATH}/availability`, {  // ← POST /api/property-settings/rates-availability/availability
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, availabilities }),
  });
}

// Step 4: API Route Bridge
export async function POST(request: NextRequest) {
  const { propertyId, availabilities } = await request.json();
  
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/save-availability`;
  const response = await fetch(edgeFunctionUrl, {  // ← Forwards to edge function
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ propertyId, availabilities }),
  });
}

// Step 5: Edge Function processes and saves atomically
```

### 🟢 Status: ✅ WIRED

**File:** `src/components/rates-availability/rates-availability-editor.tsx`  
**Function:** `handleApplyStatus()`, `handleSaveAvailability()`  
**API Client:** `src/lib/rates-availability/api-client.ts` - Line 119  
**Endpoint:** `/api/property-settings/rates-availability/availability`  

---

## 2️⃣ Review Update Modal (UpdatePreviewModal + confirmUpdate)

### Component Chain
```
UpdatePreviewModal (UI)
  ├─ Component: src/components/bulk-availability/update-preview-modal.tsx
  ├─ Parent: src/app/(app)/property-settings/rates-discounts/availability/page.tsx
  ├─ Calls: confirmUpdate() handler
  ├─ Endpoint: POST /api/property-settings/rates-availability/availability
  ├─ Bridge: src/app/api/property-settings/rates-availability/availability/route.ts
  └─ Edge Function: supabase/functions/save-availability/index.ts
```

### Code Flow
```typescript
// Step 1: User opens preview modal, clicks "Confirm Update"
<UpdatePreviewModal
  isOpen={showPreviewModal}
  updateData={pendingUpdate}
  onConfirm={confirmUpdate}  // ← Calls confirmUpdate()
  onCancel={() => setShowPreviewModal(false)}
/>

// Step 2: confirmUpdate() builds availabilities array
const confirmUpdate = async () => {
  const availabilities = [];
  
  for (const roomId of roomsToUpdate) {
    for (const dateIdx of datesToUpdate) {
      const date = dates[dateIdx];
      const dateStr = date.toISOString().split('T')[0];
      
      availabilities.push({
        date: dateStr,
        endDate: effectiveEndDate,
        status,
        roomId,
        roomTypeId: null,
        minNights,
        maxNights,
        appliedAtLevel: 'room',
      });
    }
  }
  
  // Step 3: Calls the exact same API endpoint
  const response = await fetch('/api/property-settings/rates-availability/availability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      propertyId,
      availabilities,  // ← Array of availability updates
    }),
  });
  
  // Step 4: Receives response and shows success/error
  const result = await response.json();
  addToast(`✅ Successfully updated ${selectedCount} cells!`, 'success');
};
```

### 🟢 Status: ✅ WIRED

**File:** `src/app/(app)/property-settings/rates-discounts/availability/page.tsx`  
**Function:** `confirmUpdate()` (Line 528)  
**Modal Component:** `src/components/bulk-availability/update-preview-modal.tsx`  
**Endpoint:** `/api/property-settings/rates-availability/availability`  

---

## 📊 End-to-End Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js Client)                                  │
├─────────────────────────────────────────────────────────────┤

  [Availability Page]          [Review Modal]
  - Calendar View             - Preview Summary
  - Status Updates            - Confirmation
  - Date Selection            - Update Details
        │                            │
        └────────────┬───────────────┘
                     │
                     ▼
        API Client Function
        createOrUpdateAvailability()
        updateAvailability()
        
        └─────────────┬────────────────────────────────────┘
                      │ HTTP POST
                      │ { propertyId, availabilities }
                      ▼
        ┌─────────────────────────────────────────────────┐
        │  NEXT.JS API ROUTE BRIDGE                       │
        │  /api/property-settings/rates-availability/     │
        │  availability                                   │
        ├─────────────────────────────────────────────────┤
        │  1. Validates request                          │
        │  2. Gets SUPABASE_URL                          │
        │  3. Gets SUPABASE_SERVICE_ROLE_KEY             │
        │  4. Forwards to edge function                  │
        └──────────────┬────────────────────────────────┘
                       │ HTTP POST
                       │ Bearer Token: Service Key
                       ▼
        ┌─────────────────────────────────────────────────┐
        │  SUPABASE EDGE FUNCTION                         │
        │  save-availability (Deno Runtime)               │
        ├─────────────────────────────────────────────────┤
        │  Phase 1: Expand date ranges                   │
        │  Phase 2: Validate all constraints             │
        │  Phase 3: Atomic DB transaction                │
        │  Phase 4: Real-time broadcasts                 │
        └──────────────┬────────────────────────────────┘
                       │
                       ▼
        ┌─────────────────────────────────────────────────┐
        │  SUPABASE DATABASE (PostgreSQL)                 │
        │  availability_calendar Table                    │
        └─────────────────────────────────────────────────┘
```

---

## 🧪 Test Results (Verified Working)

### Availability Page Tests
- ✅ Single date update validation
- ✅ Date range expansion
- ✅ Open-ended dates (9999-12-31)
- ✅ Bulk updates (multiple rooms × dates)

### Review Modal Tests  
- ✅ Modal shows correct preview
- ✅ Confirm button calls API
- ✅ Success/error messages displayed
- ✅ Toast notifications work

---

## 📝 Key Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `src/components/rates-availability/rates-availability-editor.tsx` | Main availability editor UI | ✅ Wired |
| `src/components/rates-availability/availability-editor.tsx` | Single record modal | ✅ Wired |
| `src/app/(app)/property-settings/rates-discounts/availability/page.tsx` | Bulk availability page | ✅ Wired |
| `src/components/bulk-availability/update-preview-modal.tsx` | Review/confirmation modal | ✅ Wired |
| `src/lib/rates-availability/api-client.ts` | API calling functions | ✅ Correct endpoint |
| `src/app/api/property-settings/rates-availability/availability/route.ts` | Bridge to edge function | ✅ Forwarding |
| `supabase/functions/save-availability/index.ts` | Edge function (deployed) | ✅ Live |

---

## ✅ Conclusion

**Both systems are fully wired and operational:**

1. **Availability Page** - Users can update dates/statuses directly
   - Click date → AvailabilityEditor modal → handleSaveAvailability() → API → Edge Function
   
2. **Review Modal** - Users can bulk update with preview
   - Select cells → Show preview → Click confirm → confirmUpdate() → API → Edge Function

**Both ultimately call the same API endpoint and edge function, just through different UI flows.**

The entire system is production-ready and tested! 🎉

