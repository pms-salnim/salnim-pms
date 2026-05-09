# Base Rate Derivation System - Implementation Guide

## 📋 Overview

This system replaces storing final prices with storing **base rates + adjustment rules**. Prices are calculated dynamically on demand.

### Why This Works
- ✅ Change base rate → **all plans update automatically**
- ✅ No manual updates needed
- ✅ Audit trail of rules
- ✅ Handle exceptions with overrides

---

## 🗄️ Database Schema (NEW TABLES)

### 1. `base_rates` - Source of Truth
```sql
id                TEXT PRIMARY KEY
property_id       TEXT NOT NULL
room_type_id      TEXT NOT NULL
base_price        DECIMAL(15, 2)    -- The base amount (e.g., 200 MAD)
currency          VARCHAR(3)         -- 'MAD'
start_date        DATE NOT NULL
end_date          DATE               -- NULL = no end date
is_active         BOOLEAN
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

**Example:**
```
Room Type: Deluxe
Date: 2026-05-01 to 2026-05-31
Base Price: 200 MAD
```

### 2. `rate_plans` - Modified (NEW COLUMNS)
Added to existing table:
```sql
adjustment_type        VARCHAR(50)   -- 'none' | 'fixed' | 'percentage'
adjustment_value       DECIMAL(10,2) -- e.g., 50 (for +50) or 20 (for +20%)
is_derived_from_base   BOOLEAN       -- TRUE = calculate from base, FALSE = use nightly_rate
```

**Example Rate Plans:**
```
Plan A: "Stay Only"
  adjustment_type = 'none'
  adjustment_value = 0
  Result: 200 MAD

Plan B: "Bed & Breakfast"
  adjustment_type = 'fixed'
  adjustment_value = 50
  Result: 200 + 50 = 250 MAD

Plan C: "Full Board"
  adjustment_type = 'fixed'
  adjustment_value = 150
  Result: 200 + 150 = 350 MAD
```

### 3. `rate_plan_overrides` - Exception Pricing
```sql
id                TEXT PRIMARY KEY
property_id       TEXT NOT NULL
rate_plan_id      TEXT NOT NULL
date_date         DATE NOT NULL
override_price    DECIMAL(15, 2)  -- Use this instead of calculated price
reason            TEXT            -- Why? (e.g., "Special event")
created_at        TIMESTAMP
updated_at        TIMESTAMP

UNIQUE(rate_plan_id, date_date)
```

**Example:**
```
Rate Plan: "Bed & Breakfast"
Date: 2026-06-15 (Peak season)
Override Price: 280 MAD
Reason: "Summer peak + event booking"
```

---

## 🔄 Calculation Flow

### How Prices Are Calculated

```typescript
function getPrice(date, ratePlan, baseRates, overrides):
  1️⃣ Check for override → return override_price
  2️⃣ If not derived from base → return nightly_rate
  3️⃣ Get base rate for date
  4️⃣ Apply adjustment:
     - none: return baseRate
     - fixed: return baseRate + value
     - percentage: return baseRate + (baseRate * value / 100)
```

### Real Example

**Setup:**
- Base Rate: 200 MAD (May 1-31)
- Plans: Stay Only (none), B&B (+50), FB (+150)

**Calculation for May 5:**
```
Base = 200

Stay Only:    200 + 0 = 200
B&B:          200 + 50 = 250
Full Board:   200 + 150 = 350
```

**Base Changes to 220 MAD (June 1-30):**
```
Base = 220

Stay Only:    220 + 0 = 220      ← Auto updated!
B&B:          220 + 50 = 270     ← Auto updated!
Full Board:   220 + 150 = 370    ← Auto updated!
```

---

## 🛠️ API Endpoints

### 1. Base Rates CRUD
**POST `/api/pricing/base-rates`**

#### Create Base Rate
```json
{
  "action": "create",
  "propertyId": "prop_123",
  "baseRate": {
    "room_type_id": "deluxe_001",
    "base_price": 200,
    "currency": "MAD",
    "start_date": "2026-05-01",
    "end_date": "2026-05-31"
  }
}
```

#### Update Base Rate
```json
{
  "action": "update",
  "baseRateId": "base_rate_123",
  "baseRate": {
    "base_price": 220
  }
}
```

#### List All Base Rates
```json
{
  "action": "list",
  "propertyId": "prop_123"
}
```

### 2. Rate Plan Adjustments
**POST `/api/pricing/rate-plan-adjustments`**

#### Set Rate Plan Rules
```json
{
  "action": "update",
  "ratePlanId": "plan_bb_001",
  "adjustment": {
    "adjustment_type": "fixed",
    "adjustment_value": 50,
    "is_derived_from_base": true
  }
}
```

#### Percentage Adjustment
```json
{
  "action": "update",
  "ratePlanId": "plan_premium",
  "adjustment": {
    "adjustment_type": "percentage",
    "adjustment_value": 20,
    "is_derived_from_base": true
  }
}
```

#### Get Rate Plan Rules
```json
{
  "action": "get",
  "ratePlanId": "plan_bb_001"
}
```

### 3. Price Overrides
**POST `/api/pricing/rate-plan-overrides`**

#### Create Override
```json
{
  "action": "create",
  "propertyId": "prop_123",
  "override": {
    "rate_plan_id": "plan_bb_001",
    "date": "2026-06-15",
    "override_price": 280,
    "reason": "Peak season event"
  }
}
```

#### Delete Override
```json
{
  "action": "delete",
  "overrideId": "override_123"
}
```

### 4. Calculate Price (Display)
**GET `/api/pricing/calculate-price?propertyId=prop_123&ratePlanId=plan_bb_001&date=2026-05-15`**

Response:
```json
{
  "success": true,
  "data": {
    "price": 250,
    "breakdown": "Base: €200 + Fixed €50 = €250",
    "hasOverride": false,
    "baseRate": 200,
    "adjustment": {
      "type": "fixed",
      "value": 50
    }
  }
}
```

**POST `/api/pricing/calculate-price`** (Date Range)

```json
{
  "propertyId": "prop_123",
  "ratePlanId": "plan_bb_001",
  "startDate": "2026-05-01",
  "endDate": "2026-05-31"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "prices": [
      {
        "date": "2026-05-01",
        "price": 250,
        "baseRate": 200,
        "adjustment": 50,
        "adjustmentType": "fixed",
        "isOverride": false
      },
      // ... more dates
    ],
    "summary": {
      "totalDays": 31,
      "avgPrice": 250,
      "minPrice": 250,
      "maxPrice": 280,
      "totalRevenue": 7750,
      "overrideCount": 1
    }
  }
}
```

---

## 📱 Frontend Usage Examples

### Display Price with Breakdown
```typescript
import { calculatePrice, getPriceBreakdown } from '@/lib/pricing/priceCalculator';

// Get calculated price
const response = await fetch(
  `/api/pricing/calculate-price?propertyId=${propertyId}&ratePlanId=${ratePlanId}&date=${date}`
);
const { data } = await response.json();

// In component:
<div>
  <p className="text-2xl font-bold">€{data.price}</p>
  <p className="text-xs text-gray-500">{data.breakdown}</p>
  {data.hasOverride && <span className="badge">Override</span>}
</div>
```

### Set Up Rate Plan Adjustment
```typescript
// Make B&B plan +50 on base
await fetch('/api/pricing/rate-plan-adjustments', {
  method: 'POST',
  body: JSON.stringify({
    action: 'update',
    ratePlanId: 'plan_bb',
    adjustment: {
      adjustment_type: 'fixed',
      adjustment_value: 50,
      is_derived_from_base: true
    }
  })
});
```

### Create Base Rate
```typescript
await fetch('/api/pricing/base-rates', {
  method: 'POST',
  body: JSON.stringify({
    action: 'create',
    propertyId,
    baseRate: {
      room_type_id: 'deluxe',
      base_price: 200,
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      currency: 'MAD'
    }
  })
});
```

### Create Price Override (Special Event)
```typescript
await fetch('/api/pricing/rate-plan-overrides', {
  method: 'POST',
  body: JSON.stringify({
    action: 'create',
    propertyId,
    override: {
      rate_plan_id: 'plan_bb',
      date: '2026-06-15',
      override_price: 300,
      reason: 'Marathon event in city'
    }
  })
});
```

---

## 📊 Migration Checklist

### Step 1: Execute Database Migration
Execute the SQL in: `supabase/migrations/20260425_002_base_rate_system.sql`

```bash
# In Supabase SQL Editor, run the migration
```

### Step 2: Update Existing Rate Plans
Convert all existing `nightly_rate` values to:
```typescript
// For each existing rate plan:
{
  adjustment_type: 'none',           // Treat as base/fixed price
  adjustment_value: 0,
  is_derived_from_base: false,       // Use nightly_rate as fallback
  nightly_rate: existingNightlyRate  // Keep existing price
}
```

### Step 3: Set Up Base Rates
1. Identify base rate per room type per date range
2. Create base_rates records
3. Update rate_plans to set `is_derived_from_base = true`
4. Test calculations match expected prices

### Step 4: Update Components
1. Use `/api/pricing/calculate-price` to get prices
2. Display `breakdown` text in tooltips
3. Show override badge if applicable

---

## 🧪 Test Scenarios

### Test 1: Basic Calculation
1. Create base rate: 200 MAD
2. Create plan with +50 fixed
3. Calculate price → Should be 250 ✅

### Test 2: Base Rate Change
1. Create rate with 200 MAD
2. Calculate B&B (+50) → 250
3. Change base to 220
4. Calculate B&B again → 270 ✅

### Test 3: Override
1. Create plan with calculated price 250
2. Create override: 300
3. Calculate same date → 300 ✅
4. Calculate different date → 250 ✅

### Test 4: Percentage Adjustment
1. Base: 200
2. Plan with +20%: 200 + (200 × 0.20) = 240 ✅

---

## ⚠️ Critical Rules

❌ **DON'T:**
- Store final prices in rate_plans table (use adjustment rules instead)
- Calculate once and cache (recalculate each time from base + rules)
- Update multiple plans when base changes (they auto-calculate)

✅ **DO:**
- Store base rates in dedicated table
- Store adjustment rules in rate_plans
- Use overrides for exceptions only
- Calculate prices on-demand for display

---

## 🎯 Summary

| Aspect | Before | After |
|--------|--------|-------|
| Base Rate Update | Manual (update all plans) | Automatic (plans recalculate) |
| Storage | Final prices | Base + rules |
| Number of DB writes | Many | One (base rate) |
| Flexibility | Low | High (rules + overrides) |
| Audit Trail | Poor | Excellent |

**Result:** Change one base rate → all derived plans update instantly ⚡
