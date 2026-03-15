# Manual Integration Testing - Step-by-Step Guide

**Date:** February 7, 2026  
**Environment:** localhost:3001  
**Status:** Ready to Test

---

## Test Environment Setup

### Prerequisites
- ✅ Dev server running on http://localhost:3001
- ✅ Logged in as staff member
- ✅ Property selected
- ✅ Access to reservations

### Navigation
- Reservations: http://localhost:3001/app/reservations/all
- Payments: http://localhost:3001/app/payments/list

---

## Test Scenario 1: Payment → Ledger Integration (CRITICAL)

**Objective:** Verify payment creation automatically creates ledger entries

**Time Estimate:** 5-10 minutes

### Step-by-Step:

1. **Navigate to Reservations**
   - Go to: http://localhost:3001/app/reservations/all
   - Click "Create Reservation" button

2. **Create Test Reservation**
   - Guest Name: "Test Guest - Manual Test 1"
   - Room: Select any available room
   - Check-in: Tomorrow
   - Check-out: Day after tomorrow
   - Total Price: Leave as calculated
   - Click "Create"

3. **Open Reservation Details**
   - Click on the newly created reservation
   - Should see empty ledger section

4. **Add a Charge**
   - Click "Add Charge" button
   - Enter:
     - Description: "Room Charge"
     - Amount: $150
     - Category: Room
     - Tax: VAT 10% (default)
   - Click "Save"
   
   **✓ VERIFY:**
   - Ledger shows new entry with $150 DEBIT
   - Total with tax shows: $165 ($150 + $15 VAT)
   - Balance displays: $165

5. **Record Payment**
   - Click "Add Payment" button
   - Enter:
     - Amount: $100
     - Payment Method: Credit Card
     - Payment Date: Today
     - Folio: Guest Account
   - Click "Save"
   
   **✓ VERIFY:**
   - Toast shows "Payment recorded successfully"
   - Ledger shows payment entry with $100 CREDIT
   - Running balance updates to: $65 ($165 - $100)
   - Both entries visible in ledger table
   - No console errors (open DevTools: F12)

6. **Check Console**
   - Open Developer Tools (F12)
   - Go to Console tab
   - Should see NO errors
   - May see info logs for payment creation

### Success Criteria:
- ✅ Payment recorded in Firestore
- ✅ Ledger entry created with CREDIT direction
- ✅ Balance calculated correctly: $165 - $100 = $65
- ✅ No errors in console
- ✅ UI updates in real-time

**Result:** ___________  (PASS / FAIL)

---

## Test Scenario 2: Split Transaction Workflow

**Objective:** Verify split allocations create correct entries in multiple folios

**Time Estimate:** 10-15 minutes

### Step-by-Step:

1. **Use Existing Reservation**
   - If you completed Scenario 1, use that reservation
   - Otherwise, create a new one with a $100 charge

2. **Prepare Test Data**
   - Current ledger should show:
     - $100 charge (or amount you set)
     - $100 payment (leaves $0-100 balance)

3. **Access Split Function**
   - On the $100 charge entry, click the "..." (three-dots menu) button
   - Click "Split" option (blue arrow icon)

4. **Configure Split Allocation**
   - Modal opens: "Split Transaction"
   - Click "Add Folio" to add allocations
   
   **First allocation (Restaurant):**
   - Folio: Restaurant Account
   - Percentage: 60
   - Calculated amount: $60 (should auto-calculate)
   
   **Second allocation (Guest):**
   - Click "Add Allocation" 
   - Folio: Guest Account
   - Percentage: 40
   - Calculated amount: $40
   
   **✓ VERIFY:**
   - Total percentage shows: 100%
   - Total amount shows: $100
   - No validation errors

5. **Execute Split**
   - Click "Confirm Split" or "Save"
   
   **✓ VERIFY:**
   - Toast shows success message
   - Original entry marked as deleted or removed
   - Two new entries appear:
     - Restaurant: $60 DEBIT with "[Split 60%]" marker
     - Guest: $40 DEBIT with "[Split 40%]" marker
   - Both entries have same splitGroupId (visible in details)

6. **Verify Balances**
   - Main ledger shows updated entries
   - Click "Generate Report"
   - Select "Settlement" report type
   - **✓ VERIFY:**
     - Restaurant Folio: $60 balance
     - Guest Folio: $40 balance
     - Total: $100 (sum of both)

### Success Criteria:
- ✅ Original entry soft-deleted
- ✅ Two new entries created with correct percentages
- ✅ Amounts calculated: $60 + $40 = $100
- ✅ Split percentage labels show correctly
- ✅ Report shows correct folio balances

**Result:** ___________  (PASS / FAIL)

---

## Test Scenario 3: Void Transaction with Compensating Entry

**Objective:** Verify void creates opposite-direction entry

**Time Estimate:** 8-12 minutes

### Step-by-Step:

1. **Create New Test Reservation**
   - Go to Reservations → All
   - Create new reservation:
     - Guest: "Test Guest - Manual Test 3"
     - Room: Any
     - Check-in: Tomorrow
     - Check-out: Day after tomorrow

2. **Add Charge**
   - Click "Add Charge"
   - Enter:
     - Description: "Bar Charge - Test Void"
     - Amount: $75
     - Category: Bar
     - Tax: VAT 10%
   - Click "Save"
   
   **✓ VERIFY:**
   - Ledger shows $75 DEBIT entry
   - Balance: $82.50 (including tax)

3. **Access Void Function**
   - Click "..." menu on the $75 charge
   - Click "Void" option (X icon)
   - Modal opens: "Void Transaction"

4. **Confirm Void**
   - Review original charge details
   - Enter Void Reason: "Duplicate charge"
   - Review compensating entry preview:
     - Should show opposite direction (CREDIT)
     - Same amount: $75
   - Click "Confirm Void"
   
   **✓ VERIFY:**
   - Toast shows "Charge voided successfully"
   - Original entry shows "Voided" status/label
   - New compensating entry appears with CREDIT direction
   - Running balance recalculates
   - If original was only entry: Balance should be $0

5. **Verify Audit Trail**
   - Click on voided entry (if clickable)
   - **✓ VERIFY:**
     - Entry still visible (soft-delete, not hard-delete)
     - Shows void reason
     - References original entry ID

6. **Generate Report**
   - Click "Generate Report"
   - Select "Full Export"
   - **✓ VERIFY:**
     - Both original and void entries visible (audit trail)
   - Select "Settlement"
   - **✓ VERIFY:**
     - Voided charges excluded from settlement
     - Balance shows only net active charges

### Success Criteria:
- ✅ Original entry soft-deleted (not removed)
- ✅ Compensating entry created with opposite direction
- ✅ Entry marked as "Voided"
- ✅ Balance recalculates to zero (if no other charges)
- ✅ Audit trail preserved in full export

**Result:** ___________  (PASS / FAIL)

---

## Test Scenario 4: Move Transaction Between Folios

**Objective:** Verify move transfers entry to different folio

**Time Estimate:** 8-10 minutes

### Step-by-Step:

1. **Create New Test Reservation**
   - Go to Reservations → All
   - Create new reservation:
     - Guest: "Test Guest - Manual Test 4"
     - Room: Any
     - Check-in: Tomorrow
     - Check-out: Day after tomorrow

2. **Add Charge to Guest Folio**
   - Click "Add Charge"
   - Enter:
     - Description: "Posted to Wrong Folio"
     - Amount: $50
     - Category: Room
     - Folio: Guest Account
   - Click "Save"
   
   **✓ VERIFY:**
   - Ledger shows $50 in guest folio
   - Balance: $50

3. **Create Second Folio (if doesn't exist)**
   - Look for "Add Folio" option in ledger area
   - Or system creates automatically with move
   - Target folio: Bar Account (or similar)

4. **Access Move Function**
   - Click "..." menu on the $50 charge
   - Click "Move" option (rotated arrow icon)
   - Modal opens: "Move Transaction"

5. **Configure Move**
   - Current Location: Guest Account
   - Select Target Folio: Bar Account
   - Enter Move Reason: "Posted to wrong folio"
   - Review:
     - Original folio: Guest Account ($50)
     - Target folio: Bar Account ($50)
   - Click "Confirm Move"
   
   **✓ VERIFY:**
   - Toast shows "Transaction moved successfully"
   - Guest folio balance updates: $0 (entry removed)
   - Bar folio shows new entry: $50
   - Original entry soft-deleted from guest folio

6. **Verify Both Folios**
   - Check Guest Account balance: $0 (or original balance)
   - Check Bar Account balance: $50 (includes moved entry)
   - Generate Report → Settlement
   - **✓ VERIFY:**
     - Guest folio: No moved entry
     - Bar folio: Shows $50
     - Totals correct

### Success Criteria:
- ✅ Entry transferred to target folio
- ✅ Source folio balance updated (entry removed)
- ✅ Target folio balance updated (entry added)
- ✅ Original soft-deleted in source
- ✅ Both folios show correct amounts

**Result:** ___________  (PASS / FAIL)

---

## Test Scenario 5: Running Balance Accuracy

**Objective:** Verify balance calculation is accurate after multiple operations

**Time Estimate:** 15-20 minutes

### Step-by-Step:

1. **Create Test Reservation**
   - Go to Reservations → All
   - Create new reservation:
     - Guest: "Test Guest - Manual Test 5 - Balance Test"
     - Room: Any
     - Check-in: Tomorrow
     - Check-out: Day after tomorrow

2. **Execute Sequence**

   **Step 2.1 - Charge 1: $100**
   - Add Charge: $100, Room
   - **VERIFY:** Balance = $100 (plus 10% VAT = $110)

   **Step 2.2 - Charge 2: $50**
   - Add Charge: $50, Restaurant
   - **VERIFY:** Balance = $150 (plus tax = ~$165)

   **Step 2.3 - Payment 1: $40**
   - Add Payment: $40, Credit Card
   - **VERIFY:** Balance = $125 ($165 - $40)

   **Step 2.4 - Charge 3: $20**
   - Add Charge: $20, Bar
   - **VERIFY:** Balance = $147 ($125 + $20 + tax)

   **Step 2.5 - Payment 2: $30**
   - Add Payment: $30, Cash
   - **VERIFY:** Balance = $117 ($147 - $30)

   **Step 2.6 - Void Charge 1 ($100)**
   - Void the first $100 charge
   - **VERIFY:** Balance recalculates correctly
   - Should reduce by $100 + tax

   **Step 2.7 - Final Payment: $20**
   - Add Payment: $20
   - **VERIFY:** Balance = Original minus all credits

3. **Verify Running Balance**
   - Look at ledger table
   - Each entry should show updated balance next to it
   - Or review ledger entries in order
   - **VERIFY:** Each row reflects cumulative balance

4. **Mathematical Verification**
   - Create a note with calculations:
     - Start: $0
     - After Charge 1: +$110 = $110
     - After Charge 2: +$55 = $165
     - After Payment 1: -$40 = $125
     - After Charge 3: +$22 = $147
     - After Payment 2: -$30 = $117
     - After Void: -$110 = $7
     - After Payment 3: -$20 = -$13 (guest credit)

5. **Check Folio Balance via API**
   - Open DevTools → Network tab
   - Trigger balance refresh
   - Look for `getFolioBalance` call
   - **VERIFY:** Response shows correct balance

### Success Criteria:
- ✅ Each operation updates balance correctly
- ✅ Math checks out at every step
- ✅ Voids don't double-count
- ✅ Negative balance handled (guest has credit)
- ✅ No rounding errors

**Result:** ___________  (PASS / FAIL)

---

## Test Scenario 6: Soft-Delete & Settlement Report

**Objective:** Verify deleted entries excluded from settlement

**Time Estimate:** 10-15 minutes

### Step-by-Step:

1. **Create Comprehensive Test Data**
   - Create new reservation:
     - Guest: "Test Guest - Manual Test 6 - Reports"
     - Add charges totaling $200
     - Record payments totaling $100
     - Void one $50 charge
     - Total should show $200 - $50 (voided) - $100 (paid) = $50 balance

2. **Generate Settlement Report**
   - Click "Generate Report" button
   - Report Type: "Settlement"
   - Click "Generate"
   
   **✓ VERIFY:**
   - Shows folio summary
   - Columns: Folio ID, Name, Type, Debits, Credits, Balance, Tax
   - **Important:** Voided charges NOT in Debits
   - Expected Debits: $150 (excluding $50 void)
   - Expected Credits: $100
   - Expected Balance: $50
   - Tax correctly aggregated

3. **Generate Analytics Report**
   - Report Type: "Analytics"
   - Click "Generate"
   
   **✓ VERIFY:**
   - Shows daily breakdown
   - Debits, Credits, Tax per day
   - Transaction count per day
   - Trends visible

4. **Generate Full Export**
   - Report Type: "Full Export"
   - Click "Generate"
   
   **✓ VERIFY:**
   - Includes ALL entries (active and voided)
   - Shows deleted=true for voided entries
   - Complete audit trail preserved
   - Can see entire transaction history

5. **Export to File**
   - Click "Export" button on report
   - **✓ VERIFY:**
     - File downloads as text
     - Contains report data
     - Properly formatted

6. **Verify Soft-Delete Behavior**
   - Settlement report: Voided excluded ✅
   - Full export: Voided included ✅
   - Soft-delete flag preserved ✅
   - Original entry IDs visible ✅

### Success Criteria:
- ✅ Voided charges excluded from settlement
- ✅ All entries included in full export
- ✅ Tax aggregated correctly
- ✅ Report math is correct
- ✅ Export functionality works
- ✅ Audit trail complete

**Result:** ___________  (PASS / FAIL)

---

## Final Verification Checklist

### 🔍 Console (Open DevTools: F12)
- [ ] No red error messages
- [ ] No TypeScript errors
- [ ] Network requests successful (200 status)
- [ ] Cloud Function calls complete
- [ ] No memory leaks or warnings

### 🔍 Data Integrity
- [ ] All balances calculated correctly
- [ ] No entries duplicated
- [ ] Soft-deletes preserved
- [ ] Tax included in calculations
- [ ] Multi-folio support working

### 🔍 UI/UX
- [ ] Modals open/close smoothly
- [ ] Forms validate properly
- [ ] Success toasts appear
- [ ] Error messages clear
- [ ] Tables update in real-time

### 🔍 Ledger Accuracy
- [ ] Running balance correct
- [ ] Entry direction (DEBIT/CREDIT) correct
- [ ] Split percentages sum to 100%
- [ ] Void creates compensating entry
- [ ] Move transfers correctly

---

## Test Results Summary

| Scenario | Pass/Fail | Issues | Time |
|----------|-----------|--------|------|
| 1. Payment → Ledger | _____ | _____ | _____ |
| 2. Split Transaction | _____ | _____ | _____ |
| 3. Void Transaction | _____ | _____ | _____ |
| 4. Move Transaction | _____ | _____ | _____ |
| 5. Balance Accuracy | _____ | _____ | _____ |
| 6. Settlement Report | _____ | _____ | _____ |

**Overall Status:** ___________________

**Total Time Spent:** ___________________

**Issues Found:**
1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________

**Recommendations:**
1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________

---

## Troubleshooting Guide

### Issue: Payment not creating ledger entry

**Solution:**
1. Check browser console (F12) for errors
2. Verify Cloud Function `createLedgerPayment` is deployed
3. Check Firestore has write permissions
4. Verify folioId is being passed correctly
5. Restart dev server: `npm run dev`

### Issue: Balance calculation incorrect

**Solution:**
1. Check DEBIT/CREDIT directions are correct
2. Verify soft-deleted entries not counted
3. Check tax is included
4. Review database directly (Firebase Console)
5. Clear browser cache and reload

### Issue: Split doesn't allocate correctly

**Solution:**
1. Verify percentages sum to 100%
2. Check error message on submit
3. Verify target folios exist
4. Check splitGroupId is created
5. Review Cloud Function logs

### Issue: Report shows deleted entries

**Solution:**
1. Select "Settlement" (excludes deleted)
2. If "Full Export" shows deleted, that's correct (audit trail)
3. Check `deleted` flag on entries
4. Review Firestore query logic

---

## Sign-Off

**Tester Name:** ___________________________

**Date:** ___________________________

**Status:** ✅ ALL TESTS PASSED / 🟡 SOME ISSUES / ❌ CRITICAL FAILURES

**Signature:** ___________________________

---

**Next Steps:**
1. Document any issues found
2. Create bug reports for failures
3. Schedule fixes
4. Re-test after fixes
5. Prepare for staging deployment
