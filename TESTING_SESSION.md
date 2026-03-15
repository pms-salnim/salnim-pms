# 🧪 MANUAL INTEGRATION TESTING - LIVE SESSION

**Status:** ✅ SERVER RUNNING  
**URL:** http://localhost:3000  
**Time:** Ready to Start  
**Duration:** ~1-1.5 hours for all 6 scenarios

---

## 📋 Testing Session Briefing

### What We're Testing
The complete folio accounting system integration:
- ✅ Payment → Ledger (payments create ledger entries)
- ✅ Split (allocate single charge to multiple folios)
- ✅ Void (cancel charge with compensating entry)
- ✅ Move (transfer charge between folios)
- ✅ Balance (calculations accurate at each step)
- ✅ Reports (settlement and audit exports)

### Why Manual Testing
- Unit tests validate logic ✅ (23/23 passing)
- Manual tests validate UI/UX and real-world workflows
- Ensures data flows correctly end-to-end
- Catches integration issues that unit tests miss

### What You'll Do
1. **Open browser:** http://localhost:3000
2. **Navigate to:** Reservations → All
3. **Create test reservations** for each scenario
4. **Perform operations** (add charges, payments, etc.)
5. **Verify results** match expected outcomes
6. **Record pass/fail** for each scenario

### What to Watch For

**✅ SUCCESS INDICATORS:**
- Green toast notifications appear
- Ledger updates immediately
- Balance recalculates correctly
- No red errors in console (F12)
- Entries persist after page reload

**❌ FAILURE INDICATORS:**
- Red error toast
- Ledger doesn't update
- Balance incorrect
- Console shows red errors (F12)
- Entries disappear on reload

---

## 🎯 6 Test Scenarios

| # | Scenario | Time | Key Test |
|---|----------|------|----------|
| 1️⃣ | Payment → Ledger | 5-10 min | Payment creates ledger entry |
| 2️⃣ | Split Transaction | 10-15 min | Charge split 60/40 across folios |
| 3️⃣ | Void Transaction | 8-12 min | Creates compensating entry |
| 4️⃣ | Move Transaction | 8-10 min | Moves entry to different folio |
| 5️⃣ | Balance Accuracy | 15-20 min | Math correct after 7 operations |
| 6️⃣ | Settlement Report | 10-15 min | Voids excluded, audit trail preserved |

---

## 🚀 Getting Started

### Step 1: Open Browser
```
http://localhost:3000
```

### Step 2: Login (if needed)
Use your staff account or test credentials

### Step 3: Go to Reservations
Click: Reservations → All

### Step 4: Start Scenario 1
Create reservation:
- Guest Name: "Test Guest - Manual Test 1"
- Room: Any available
- Check-in: Tomorrow
- Check-out: Day after tomorrow
- Click "Create"

### Step 5: Follow Guide
Reference: [MANUAL_TESTING_GUIDE.md](MANUAL_TESTING_GUIDE.md)

---

## 📝 Testing Checklist

### Before Starting
- [ ] Server running (http://localhost:3000)
- [ ] Browser opens without errors
- [ ] Can log in
- [ ] Can navigate to Reservations
- [ ] DevTools open (F12) to watch console

### During Testing
- [ ] Follow step-by-step instructions
- [ ] Verify each ✅ success criteria
- [ ] Screenshot any issues
- [ ] Note problems encountered
- [ ] Record time for each scenario

### After Each Scenario
- [ ] Record PASS or FAIL
- [ ] Note any issues
- [ ] Document error messages
- [ ] Take screenshots if needed

---

## 📊 Results Template

For each scenario, record:

```
SCENARIO 1: Payment → Ledger Integration
────────────────────────────────────────────
Status:          ✅ PASS / ❌ FAIL / ⚠️ PARTIAL
Time Taken:      _____ minutes
Issues Found:    [ ] None [ ] Minor [ ] Major

If issues, describe:
_________________________________________________________
_________________________________________________________

Screenshots: [ ] None [ ] Yes - see attached
```

---

## 🔧 Troubleshooting Quick Tips

| Problem | Solution |
|---------|----------|
| Ledger entry not created | Check console (F12) for errors; wait 2 sec; refresh |
| Balance incorrect | Clear cache (Ctrl+Shift+Del); restart dev server |
| Modal doesn't open | Click the ... button → scroll if needed |
| Form validation fails | Check required fields are filled |
| Payment not showing | Verify you saved (not just closed modal) |
| Report is empty | Make sure charges were added before report |

---

## ✅ Success Criteria

### For ALL TESTS to PASS:

1. **Scenario 1:** Payment creates ledger entry automatically
2. **Scenario 2:** Split allocates to multiple folios correctly
3. **Scenario 3:** Void creates compensating entry, net = $0
4. **Scenario 4:** Move transfers entry to new folio
5. **Scenario 5:** Running balance accurate after 7 operations
6. **Scenario 6:** Settlement excludes voids, Full Export includes all

### Overall Score
```
PASS ALL 6:     Ready for Staging ✅
PASS 5 of 6:    Fix 1 issue, re-test
PASS 4 or less: Multiple issues need fixes
```

---

## 📚 Documentation References

| Document | Purpose |
|----------|---------|
| [START_TESTING.md](START_TESTING.md) | Quick start guide |
| [MANUAL_TESTING_GUIDE.md](MANUAL_TESTING_GUIDE.md) | Detailed 6 scenarios |
| [TEST_RESULTS.md](TEST_RESULTS.md) | Unit test results |
| [LEDGER_INTEGRATION_TESTS.md](LEDGER_INTEGRATION_TESTS.md) | Original test plan |
| [QUICK_STATUS.txt](QUICK_STATUS.txt) | Project status |

---

## 🎬 Running Order

### Session Timeline (1-1.5 hours)

| Time | Activity |
|------|----------|
| 0:00 | Start - Open browser, navigate to Reservations |
| 0:10 | Scenario 1 Complete - Verify ledger entry |
| 0:25 | Scenario 2 Complete - Verify split allocation |
| 0:40 | Scenario 3 Complete - Verify void entry |
| 0:55 | Scenario 4 Complete - Verify move transfer |
| 1:15 | Scenario 5 Complete - Verify balance accuracy |
| 1:30 | Scenario 6 Complete - Verify reports |
| 1:40 | Final verification - Review all results |
| 1:50 | Summary - Document findings |

---

## 💡 Pro Tips

1. **Keep browser DevTools open** (F12) throughout
2. **Take screenshots of errors** for debugging
3. **Write down exact times** for each scenario
4. **Note any UI glitches** even if functionality works
5. **Test on real data** - don't just skim through
6. **Be thorough** - this is final validation before production

---

## 🎯 Final Goal

After testing, you'll know:
- ✅ System works end-to-end
- ✅ All 6 workflows function correctly
- ✅ Data integrity is maintained
- ✅ Ready for staging environment
- ✅ Ready for production deployment

---

## 🆘 Need Help?

If stuck on any scenario:
1. Read the detailed steps in [MANUAL_TESTING_GUIDE.md](MANUAL_TESTING_GUIDE.md)
2. Check console for error messages
3. Try refreshing the page
4. Restart dev server if needed

---

## 📞 Final Checklist

Before declaring testing complete:

- [ ] All 6 scenarios attempted
- [ ] Results recorded for each
- [ ] Issues documented
- [ ] Screenshots taken (if needed)
- [ ] Time logged
- [ ] Summary prepared
- [ ] Pass/Fail status determined

---

## 🚀 Ready to Start?

1. Keep this window open for reference
2. Open browser to: **http://localhost:3000**
3. Go to: **Reservations → All**
4. Follow [MANUAL_TESTING_GUIDE.md](MANUAL_TESTING_GUIDE.md) Scenario 1
5. Work through all 6 scenarios
6. Record results

---

**Let's begin testing! 🧪**

Start with: [Scenario 1: Payment → Ledger Integration](MANUAL_TESTING_GUIDE.md#test-scenario-1-payment--ledger-integration-critical)

Good luck! 💪
