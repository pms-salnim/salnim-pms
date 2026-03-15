## Cloud Functions - Ledger Operations Setup

### Location
```
/functions/source/booking/reservation-details/
```

### Files Created

#### 1. `ledgerOperations.ts`
**Purpose:** Core ledger entry creation functions
**Functions:**
- `createLedgerCharge` - Create DEBIT entry for charges
- `createLedgerPayment` - Create CREDIT entry for payments
- `createLedgerRefund` - Create REFUND entry with reference link
- `getFolioLedger` - Fetch all entries for a folio with balance calculation

**Called from:** Frontend via Callable HTTP
**Region:** europe-west1
**Security:** App Check enforced

#### 2. `allocationOperations.ts`
**Purpose:** Payment allocation and balance calculations
**Functions:**
- `allocatePayment` - Link payment to specific charges
- `getAllocations` - Fetch all allocations for a folio
- `getFolioBalance` - Get folio balance with running totals
- `getReservationBalance` - Aggregate balance across all folios

**Called from:** Frontend for balance display and reporting
**Region:** europe-west1
**Security:** App Check enforced

#### 3. `index.ts`
**Purpose:** Export all ledger operations
**Exports:** All 8 functions from ledger and allocation modules

### Types Location
```
/functions/source/types/folio.ts
```

**Interfaces:**
- `LedgerEntry` - Immutable ledger entry
- `AllocationRecord` - Payment-to-charge allocation
- `Folio` - Multi-folio accounting structure
- `FolioBalance` - Computed balance (never stored)
- `TaxLine` - Tax breakdown per entry
- `TaxRule` & `TaxConfig` - Tax intelligence

### Database Structure (Firestore)
```
properties/{propertyId}/
  reservations/{reservationId}/
    folios/{folioId}/
      ledger/{ledgerId}          → LedgerEntry (immutable)
      allocations/{allocationId} → AllocationRecord
```

### Key Features

✅ **Immutable Ledger**
- All entries are immutable (immutable=true)
- Only append new entries, never update existing ones
- Soft-delete only (deleted flag, never physical deletion)

✅ **Real-Time Balance**
- Computed from ledger entries, never stored
- Running balance calculated per transaction
- DEBIT adds to balance, CREDIT subtracts

✅ **Reference Tracking**
- Refunds link to original charges via referenceId
- Allocation records track payment application
- Full audit trail with timestamps and user IDs

✅ **Tax Support**
- Tax breakdown array per entry
- Tax summary calculations
- Foundation for tax intelligence system

✅ **Multi-Folio Support**
- Each folio has independent ledger
- Reservation-level aggregation function
- Separate balance tracking per folio

### Build Status
✅ Functions compile: `npm run build` (no errors)
✅ Frontend compiles: `npm run build` (6.4s, no errors)
✅ Type safety: Full TypeScript strict mode

### Next Steps

1. **Firestore Security Rules** - Restrict ledger write access
2. **LedgerService** - Integrate into reservation modal
3. **Cloud Function Deployment** - `firebase deploy --only functions`
4. **UI Integration** - Call from reservation detail folio tab
5. **Payment Form Integration** - Use createLedgerPayment
6. **Advanced Operations** - Split, move, void functions
