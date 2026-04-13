# Property Settings Availability Page - Testing Checklist

## 📋 Test Plan & Verification

### Test 1: Page Load & UI Initialization
**Steps**:
1. Navigate to: `/property-settings/rates-discounts/availability`
2. Verify page loads without errors
3. Check Sidebar is visible on left
4. Check main content area displays

**Expected**:
- ✅ Page renders successfully
- ✅ No console errors
- ✅ Layout matches "app-like" design (pinned header, scrollable content)
- ✅ Bulk availability panel visible on left
- ✅ Calendar grid visible on right

**Status**: [ ] PASS [ ] FAIL

---

### Test 2: API Data Loading
**Steps**:
1. Open browser DevTools → Network tab
2. Refresh page
3. Monitor API calls:
   - `/api/property-settings/rates-availability/room-types`
   - `/api/property-settings/rates-availability/rooms`

**Expected**:
- ✅ Both API calls complete successfully (200 status)
- ✅ Room types load with correct data
- ✅ Rooms load grouped by room type
- ✅ No duplicate rooms

**Status**: [ ] PASS [ ] FAIL

---

### Test 3: Date Range Selection
**Steps**:
1. Click "Start Date" input
2. Select a date (e.g., 2026-04-15)
3. Verify date appears in input
4. Click "End Date" input
5. Select end date (e.g., 2026-04-20)
6. Verify date appears in input
7. Calendar grid shows selected dates highlighted

**Expected**:
- ✅ Date picker opens and closes
- ✅ Selected dates display correctly
- ✅ Calendar highlights selected range
- ✅ No date validation errors

**Status**: [ ] PASS [ ] FAIL

---

### Test 4: Open-Ended Toggle
**Steps**:
1. Locate "Open-Ended" checkbox (near end date)
2. Uncheck it (if checked by default)
3. Verify "End Date" input becomes **enabled**
4. Select an end date
5. Check "Open-Ended" checkbox
6. Verify "End Date" input becomes **disabled** (grayed out)
7. Verify UI shows visual feedback (opacity/cursor change)

**Expected**:
- ✅ End date input toggles enabled/disabled based on Open-Ended state
- ✅ When checked: End date input is disabled (cannot type)
- ✅ When unchecked: End date input is enabled and required
- ✅ Visual feedback clear

**Status**: [ ] PASS [ ] FAIL

---

### Test 5: Room Type Selection
**Steps**:
1. In left panel, find "Room Type" dropdown
2. Click dropdown
3. Verify all room types appear in list
4. Select a room type
5. Verify selection is displayed
6. Select "All Room Types" if available
7. Verify all rooms appear

**Expected**:
- ✅ Dropdown shows all room types
- ✅ Selection updates immediately
- ✅ No API errors on selection change
- ✅ "All" option works correctly

**Status**: [ ] PASS [ ] FAIL

---

### Test 6: Room Selection (Grouping)
**Steps**:
1. In left panel, find "Select Rooms" section
2. Verify rooms are grouped by room type
3. Select single room
4. Select multiple rooms (using Ctrl+click or checkbox)
5. Verify selections are stored
6. Verify "Clear Selection" works
7. Verify "Select All" works

**Expected**:
- ✅ Rooms display grouped by type
- ✅ Single selection works
- ✅ Multiple selection works
- ✅ Clear/Select All buttons function
- ✅ No rooms show with "invalid status" or errors

**Status**: [ ] PASS [ ] FAIL

---

### Test 7: Availability Status Selection
**Steps**:
1. In left panel, find "Set Availability" dropdown
2. Click dropdown
3. Verify options appear: "Available", "Unavailable", "Blocked", etc.
4. Select "Available"
5. Verify status displays

**Expected**:
- ✅ Status dropdown shows all valid options
- ✅ Selection stores in component state
- ✅ No console errors

**Status**: [ ] PASS [ ] FAIL

---

### Test 8: Calendar Interaction
**Steps**:
1. Navigate to calendar grid (right side)
2. Verify calendar displays for selected date range
3. Click a date cell
4. Try clicking multiple dates
5. Try dragging across date range (if implemented)
6. Verify visual feedback on interaction

**Expected**:
- ✅ Calendar renders all dates in range
- ✅ Dates are clickable
- ✅ Visual feedback on hover/selection
- ✅ No errors on interaction

**Status**: [ ] PASS [ ] FAIL

---

### Test 9: Availability Update Submission
**Steps**:
1. Fill in all form fields:
   - Start Date: 2026-04-15
   - End Date: (leave blank or check Open-Ended)
   - Open-Ended: (test both checked/unchecked)
   - Room Type: Select one
   - Room: Select one or multiple
   - Status: "Available"
2. Click "Update Availability" button
3. Monitor Network tab for POST request
4. Verify API request payload

**Expected**:
- ✅ POST to `/api/property-settings/rates-availability/availability` sent
- ✅ Payload includes:
  - `startDate`: ISO date string
  - `endDate`: ISO date string (or '9999-12-31' if open-ended)
  - `roomIds`: array
  - `status`: "available"
  - `appliedAtLevel`: "room" or "room_type"
- ✅ API returns 200 status
- ✅ Success message displays

**Status**: [ ] PASS [ ] FAIL

---

### Test 10: Open-Ended End Date Logic
**Steps**:
1. Check "Open-Ended" checkbox
2. Select start date: 2026-04-15
3. Submit availability update
4. Monitor Network tab
5. Check request payload for `endDate` value

**Expected**:
- ✅ When Open-Ended: endDate should be '9999-12-31'
- ✅ End date input is disabled
- ✅ User cannot edit end date while open-ended
- ✅ Submission succeeds

**Status**: [ ] PASS [ ] FAIL

---

### Test 11: Form Validation
**Steps**:
1. Try submitting without selecting:
   - Start date → should show error
   - Room type or room → should show error
   - Availability status → should show error
2. Try submitting with only start date, no end date (when Open-Ended unchecked)
   - Should show error requiring end date

**Expected**:
- ✅ Required fields show validation errors
- ✅ Error messages are clear
- ✅ Form doesn't submit with invalid data
- ✅ Submit button is disabled until form is valid

**Status**: [ ] PASS [ ] FAIL

---

### Test 12: Error Handling
**Steps**:
1. Monitor Network tab for any failed requests
2. Try updating with invalid data (if possible)
3. Check browser console for errors
4. Monitor for timeout errors

**Expected**:
- ✅ Failed requests show user-friendly error message
- ✅ No console JS errors
- ✅ Application doesn't crash on error
- ✅ User can retry after error

**Status**: [ ] PASS [ ] FAIL

---

### Test 13: Preview Modal (if implemented)
**Steps**:
1. After filling form, check if "Preview" button appears
2. Click Preview
3. Verify modal/preview shows what will be updated
4. Verify "Confirm" or "Back" options available
5. Confirm the update

**Expected**:
- ✅ Preview shows correct data
- ✅ Modal displays clearly
- ✅ Confirm updates data
- ✅ Back cancels without updating

**Status**: [ ] PASS [ ] FAIL

---

### Test 14: Success Feedback
**Steps**:
1. After successful submission, check for:
   - Success toast/alert message
   - Confirmation text
   - Page refresh or state update

**Expected**:
- ✅ User receives clear confirmation
- ✅ Toast appears and disappears automatically
- ✅ Data persists (visible on refresh)
- ✅ Form can be reused for next update

**Status**: [ ] PASS [ ] FAIL

---

### Test 15: Responsive Layout
**Steps**:
1. Check page on different screen sizes:
   - 1920px (desktop)
   - 1280px (tablet)
   - 768px (mobile - may not be fully supported)
2. Verify sidebar and content remain visible
3. Verify no horizontal scrolling (except calendar internal scrolling)
4. Verify "Sidebar Collapse" toggle works

**Expected**:
- ✅ Layout adapts to screen size
- ✅ No awkward horizontal scrolling at main level
- ✅ Sidebar can collapse on smaller screens
- ✅ All elements remain accessible

**Status**: [ ] PASS [ ] FAIL

---

## 📊 Summary

### Total Tests
- [ ] 0 / 15 Passed
- [ ] 0 / 15 Failed

### Critical Issues Found
(List any FAIL results here)

1. 
2. 
3. 

### Minor Issues Found
(Non-blocking issues)

1.
2.

### Ready for Production?
- [ ] All tests pass
- [ ] No critical issues
- [ ] Minor issues documented

---

## 🔧 Quick Reference

### Page Components
- **Left Panel**: BulkAvailabilityPanel
  - Date range selection
  - Room type & room selection
  - Availability status dropdown
  - Buttons: Update, Preview, Clear

- **Top**: Tabs for Rates, Seasonal Pricing, Discounts, Availability
- **Right Panel**: BulkAvailabilityCalendar
  - Calendar grid showing date range
- **Modal**: UpdatePreviewModal (if flow has preview step)

### Key States
- `dateRange`: { from: Date, to: Date }
- `openEnded`: boolean (default: true)
- `selectedRoomType`: string
- `selectedRooms`: string[]
- `selectedAvailability`: "available" | "unavailable" | "blocked"

### Key Functions
- `handleUpdateAvailability()`: Main submission handler
- `handleClearSelection()`: Reset form state
- API: POST `/api/property-settings/rates-availability/availability`

---

## ✅ Test Execution Notes

- **Date**: 2026-04-12
- **Tester**: 
- **Environment**: 
- **Browser**: 
- **Notes**:

