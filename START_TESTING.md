# 🚀 Manual Integration Testing - START HERE

**Server Running:** http://localhost:3001  
**Environment:** Development / Local Testing  
**Date:** February 7, 2026

---

## Quick Start

### 1. Access the Application
Open your browser and navigate to:
```
http://localhost:3001/app/reservations/all
```

### 2. Login
If prompted, use your staff credentials or test account

### 3. Follow the Testing Scenarios
Each scenario is documented in detail in [MANUAL_TESTING_GUIDE.md](MANUAL_TESTING_GUIDE.md)

---

## 6 Test Scenarios (Total: 1-2 hours)

### ✅ Scenario 1: Payment → Ledger Integration (CRITICAL)
**Time:** 5-10 min  
**What to test:**
- Create reservation
- Add $150 charge
- Record $100 payment
- Verify balance: $50 ($150 - $100)
- Check ledger entry created

**Expected Result:** Payment automatically creates ledger entry  
[Full Instructions](MANUAL_TESTING_GUIDE.md#test-scenario-1-payment--ledger-integration-critical)

---

### ✅ Scenario 2: Split Transaction Workflow
**Time:** 10-15 min  
**What to test:**
- Use $100 charge from Scenario 1
- Click "..." menu → "Split"
- Allocate: 60% to Restaurant, 40% to Guest
- Verify both folios show correct amounts

**Expected Result:** Charge split into 2 folios with correct percentages  
[Full Instructions](MANUAL_TESTING_GUIDE.md#test-scenario-2-split-transaction-workflow)

---

### ✅ Scenario 3: Void Transaction
**Time:** 8-12 min  
**What to test:**
- Create $75 charge
- Click "..." menu → "Void"
- Enter reason: "Duplicate charge"
- Verify compensating entry created
- Check balance recalculates

**Expected Result:** Void creates opposite-direction entry, balance = $0  
[Full Instructions](MANUAL_TESTING_GUIDE.md#test-scenario-3-void-transaction-with-compensating-entry)

---

### ✅ Scenario 4: Move Transaction
**Time:** 8-10 min  
**What to test:**
- Create $50 charge in Guest folio
- Click "..." menu → "Move"
- Select target: Bar folio
- Verify entry moves to new folio

**Expected Result:** Entry transferred to different folio  
[Full Instructions](MANUAL_TESTING_GUIDE.md#test-scenario-4-move-transaction-between-folios)

---

### ✅ Scenario 5: Running Balance Accuracy
**Time:** 15-20 min  
**What to test:**
- Create series of charges and payments
- Verify balance after each operation
- Check calculations are accurate
- Math: 100 + 50 - 40 + 20 - 30 = 100

**Expected Result:** Balance always accurate  
[Full Instructions](MANUAL_TESTING_GUIDE.md#test-scenario-5-running-balance-accuracy)

---

### ✅ Scenario 6: Settlement Report
**Time:** 10-15 min  
**What to test:**
- Generate Settlement Report
- Verify voided charges excluded
- Generate Full Export
- Verify voided charges included (audit trail)
- Export to file

**Expected Result:** Reports accurate, audit trail preserved  
[Full Instructions](MANUAL_TESTING_GUIDE.md#test-scenario-6-soft-delete--settlement-report)

---

## How to Test Each Scenario

### Step 1: Read the Scenario
Go to [MANUAL_TESTING_GUIDE.md](MANUAL_TESTING_GUIDE.md) and find your scenario

### Step 2: Follow Step-by-Step Instructions
Each scenario has numbered steps with what to do and what to verify

### Step 3: Check Success Criteria
At end of each scenario, verify all ✅ items pass

### Step 4: Record Results
Mark PASS or FAIL with any issues noted

---

## What to Watch For

### ✅ GOOD SIGNS
- Toast notifications appear (success messages)
- Ledger table updates immediately
- Balance recalculates correctly
- No console errors (F12 → Console)
- Entries appear in correct order

### ❌ RED FLAGS
- Error toast appears
- Balance incorrect after operation
- Deleted entries still visible in settlement report
- Console shows red errors
- Button doesn't respond

---

## Testing Tips

### Before Each Test
1. Open DevTools: Press `F12`
2. Go to Console tab
3. Keep it open to watch for errors

### During Each Test
1. Fill in form fields carefully
2. Click buttons and wait for response
3. Look for toast notifications
4. Verify ledger updates

### After Each Test
1. Check console for errors
2. Screenshot any issues
3. Note down what worked/what didn't
4. Move to next scenario

---

## Quick Troubleshooting

### Payment not creating ledger entry
- Check console (F12) for errors
- Verify you clicked "Save" (not close)
- Wait a moment for backend to process
- Refresh page if needed

### Balance incorrect
- Clear browser cache (Ctrl+Shift+Delete)
- Restart dev server (`npm run dev`)
- Check all previous entries

### Ledger not showing
- Scroll down in reservation details
- Make sure you added a charge first
- Payment alone doesn't create ledger

### Reports empty
- Generate report after adding charges
- Check you selected correct report type
- Try "Full Export" to see all entries

---

## Recording Your Results

For each scenario, note:
- ✅ or ❌ (pass/fail)
- Time taken
- Any issues
- Screenshots of problems

Example:
```
Scenario 1: Payment → Ledger Integration
Status: ✅ PASS
Time: 7 minutes
Issues: None
Screenshot: N/A
```

---

## Success Criteria Summary

For **ALL TESTS PASS**, you need:

| Test | Criteria |
|------|----------|
| Payment → Ledger | Ledger entry created, balance = $50 |
| Split | Two entries: 60% + 40%, both visible |
| Void | Compensating entry appears, balance = $0 |
| Move | Entry transferred to new folio |
| Balance | Math correct after each operation |
| Reports | Settlement excludes voids, Full Export includes all |

---

## Time Estimate

- Scenario 1: 5-10 min
- Scenario 2: 10-15 min
- Scenario 3: 8-12 min
- Scenario 4: 8-10 min
- Scenario 5: 15-20 min
- Scenario 6: 10-15 min
- **TOTAL: 1-1.5 hours** ⏱️

---

## What Happens After Testing

✅ **If all tests PASS:**
1. Document results
2. System ready for staging
3. Move to unit tests for Cloud Functions
4. Prepare staff training materials
5. Plan production deployment

❌ **If tests FAIL:**
1. Document issues
2. Create bug reports
3. Fix identified problems
4. Re-test affected scenarios
5. Verify fixes work

---

## Need Help?

If you get stuck:
1. Check the detailed instructions in [MANUAL_TESTING_GUIDE.md](MANUAL_TESTING_GUIDE.md)
2. Look at console for error messages (F12)
3. Try refreshing the page
4. Restart dev server: `npm run dev`

---

## Next Steps After Testing

1. **All PASS?** → Unit tests for Cloud Functions
2. **Some issues?** → Fix and re-test
3. **Critical issues?** → Debug and fix before staging

---

**Ready? Start with [Scenario 1: Payment → Ledger Integration](MANUAL_TESTING_GUIDE.md#test-scenario-1-payment--ledger-integration-critical)**

Open: http://localhost:3001/app/reservations/all and let's begin! 🚀
