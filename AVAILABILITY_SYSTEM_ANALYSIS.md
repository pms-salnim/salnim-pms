# Comprehensive Availability System Analysis
## Current Data Structures for Rates, Pricing, and Availability

**Analysis Date:** April 11, 2026  
**Purpose:** Document all existing rate, pricing, and availability fields to prevent duplication in new availability system

---

## 1. ROOM TYPES SETTINGS
**File:** [src/types/roomType.ts](src/types/roomType.ts)

### `RoomType` Interface Definition

```typescript
export interface RoomType {
  id: string;                          // Firestore document ID
  name: string;                        // e.g., "Standard Double", "Deluxe Suite"
  maxGuests: number;                   // Maximum occupancy
  baseRate?: number;                   // Base price per night (PRICING)
  description?: string;
  propertyId: string;                  // Multi-property support
  
  // Details Tab
  numberOfRoomsAvailable?: number | null;  // Count of rooms of this type
  assignedRoomNumbers?: string[];          // Individual room assignments
  
  // Amenities Tab
  selectedAmenities?: string[];            // Array of amenity IDs
  
  // Gallery Tab
  thumbnailImageUrl?: string;
  galleryImageUrls?: string[];
  
  // Beds Tab
  beds?: BedConfiguration[];               // Bed type and count
  
  // Optional Details
  sizeSqMeters?: number;
  
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### Field Analysis
- **NO availability restrictions at room type level** (no occupancy limits beyond maxGuests, no min/max stay)
- **Single baseRate per room type** (pricing overrides come from RatePlans and SeasonalRates)
- **NO closed dates, blocked dates, or availability blocks** stored here

### Flags
⚠️ **Gap:** `baseRate` exists but rate complexity is handled at RatePlan level (see below)

---

## 2. INDIVIDUAL ROOMS SETTINGS
**File:** [src/types/room.ts](src/types/room.ts)

### `Room` Interface Definition

```typescript
export interface Room {
  id: string;                          // Firestore document ID
  name: string;                        // e.g., "Room 101" - PRIMARY IDENTIFIER
  roomNumber?: string;                 // Optional more formal room number
  roomTypeId: string;                  // Foreign key to RoomType
  propertyId: string;
  
  // Occupancy & Cleaning Status
  occupancyStatus: OccupancyStatus;    // "empty" | "occupied" (CURRENT STATE ONLY)
  cleaningStatus: CleaningStatus;      // "clean" | "dirty" | "in_progress" | "out_of_order"
  
  // Legacy field (deprecating)
  status?: RoomStatus;                 // "Available" | "Occupied" | "Maintenance" | "Cleaning" | "Dirty" | "Out of Order"
  
  floor?: string;                      // Floor number/name
  amenities?: string[];                // Room-specific overrides for amenities
  notes?: string;                      // Internal notes
  
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### Field Analysis
- **NO pricing overrides** at room level (all pricing comes from RatePlans)
- **NO availability restrictions** (this table only stores current status, not blocked dates)
- **occupancyStatus:** Only tracks CURRENT state (empty/occupied) - historical/future availability is not stored here
- **NO closedToArrival, closedToDeparture, minStay, maxStay** fields

### Flags
⚠️ **Design Issue:** This is a pure state table - no booking rules or restrictions

---

## 3. RATES & PRICING SYSTEM

### 3.1 Rate Plans
**File:** [src/types/ratePlan.ts](src/types/ratePlan.ts)

```typescript
export type PricingMethod = 'per_guest' | 'per_night';

export interface RatePlan {
  id: string;                          // Firestore document ID
  planName: string;                    // e.g., "Standard Rate", "Flexible Rate"
  description?: string;
  propertyId: string;
  roomTypeId: string;                  // ⚠️ LINKS TO SINGLE ROOM TYPE ONLY
  
  pricingMethod: PricingMethod;        // Core pricing logic
  basePrice?: number;                  // Only for 'per_night' method
  pricingPerGuest?: Record<string, number>; // Only for 'per_guest' method - maps guest count to price
  
  cancellationPolicy?: string;         // Text description
  default: boolean;                    // Is this default for the room type?
  
  // Date Range Fields (CRITICAL FOR AVAILABILITY)
  startDate?: Timestamp;               // When this rate plan becomes active
  endDate?: Timestamp | null;          // null = open-ended
  
  createdBy: string;                   // UID
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### Key Observations
- **PricingMethod:** Supports two models:
  - `per_night`: All guests pay same rate per night
  - `per_guest`: Rate varies by number of guests (e.g., $100-1guest, $120-2guests, $150-3guests)
- **NO min/max stay restrictions** (stored here - these are in Packages and AvailabilitySettings)
- **startDate / endDate:** Controls temporal availability of THIS rate plan
- **NO room-level pricing overrides** (overrides are at SeasonalRate level)

### Flags
⚠️ **Design:** Date-based pricing control is at RatePlan level, but...
⚠️ **Gap:** No min/max stay, occupancy limits, closed to arrival/departure here

---

### 3.2 Seasonal Rates (Pricing Overrides)
**File:** [src/types/seasonalRate.ts](src/types/seasonalRate.ts)

```typescript
export interface SeasonalRate {
  id: string;                          // Firestore document ID
  propertyId: string;
  name: string;                        // e.g., "Christmas Special", "Summer High Season"
  ratePlanId: string;                  // ID of parent rate plan to override
  
  startDate: Date;                     // Start of this seasonal override
  endDate: Date;                       // End (inclusive)
  
  // Override Options (based on parent RatePlan's pricingMethod)
  basePrice?: number;                  // Override for 'per_night' rate plans
  pricingPerGuest?: Record<string, number>; // Override for 'per_guest' rate plans
  
  active: boolean;                     // Is this override currently applied?
  
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

### Key Observations
- **Nested pricing override system:** 
  - RatePlan defines base pricing
  - SeasonalRate temporarily overrides it for a period
- **No reference to specific rooms** (applies to all rooms of the rate plan's room type)
- **NO availability restrictions** (blocked dates, occupancy rules, etc.)

### Flags
⚠️ **Gap:** This is PRICE-ONLY override - no booking restrictions here

---

### 3.3 Promotions System
**File:** [src/types/promotion.ts](src/types/promotion.ts)

```typescript
export type DiscountType = 'percentage' | 'flat_rate';
export type PromotionType = 'automatic' | 'coupon';

export interface Promotion {
  id: string;
  propertyId: string;
  name: string;
  description?: string;
  
  ratePlanIds: string[];               // ⚠️ APPLIES TO MULTIPLE RATE PLANS
  
  promotionType: PromotionType;        // 'automatic' = always apply, 'coupon' = requires code
  discountType: DiscountType;          // 'percentage' or 'flat_rate'
  discountValue: number;               // The discount amount
  
  startDate: Date | string;            // When promotion is active
  endDate: Date | string;              // When promotion ends
  
  couponCode?: string | null;          // For coupon-type promotions
  usageLimit?: number | null;          // Max uses per coupon (null = unlimited)
  timesUsed?: number;                  // Counter
  
  active: boolean;                     // Manual on/off toggle
  
  createdAt?: Date | string;
  updatedAt?: Date | string;
}
```

### Key Observations
- **Discount system:** Applied on top of pricing
- **Temporal control:** startDate/endDate
- **Multi-plan support:** Can apply to multiple rate plans
- **NO availability restrictions** (no blocked dates, occupancy limits, min/max stay)

### Flags
✓ Good: Separate discount system
⚠️ Gap: No booking rules here

---

## 4. AVAILABILITY & BLOCKING SYSTEM

### 4.1 Availability Settings (Blocking System)
**File:** [src/types/availabilityOverride.ts](src/types/availabilityOverride.ts)

```typescript
export interface AvailabilitySetting {
  id: string;                          // Firestore document ID
  propertyId: string;
  roomTypeId: string;
  roomId?: string | null;              // If defined = room-specific, else = room-type-wide
  
  startDate: string;                   // YYYY-MM-DD format
  endDate: string;                     // Inclusive YYYY-MM-DD format
  
  status: 'blocked' | 'available';     // BINARY: Either blocked or available
  
  createdBy?: string;                  // User UID who created this
  notes?: string | null;               // Reason for block (e.g., "Maintenance", "Owner occupied")
  
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

### Key Observations
- **Binary status:** Only tracks blocked vs available (no nuanced occupancy info)
- **Granular control:** Can be room-type-wide OR room-specific
- **NO pricing information** (only availability)
- **NO min/max stay rules** (just blocks dates)
- **NO closed to arrival/departure distinction** (just blocks entire period)

### Critical Flags
⚠️ **Design Limitation:** `status` is boolean (blocked/available) - no intermediate states
⚠️ **Gap:** NO min/max stay enforcement here
⚠️ **Gap:** NO separate "closed to arrival" vs "closed to departure" distinction
⚠️ **Gap:** NO occupancy rate tracking
⚠️ **Gap:** NO "reservation can extend past date" logic

---

### 4.2 Packages (Bundled Offers with Availability Rules)
**File:** [src/types/package.ts](src/types/package.ts)

```typescript
export interface Package {
  id: string;
  propertyId: string;
  
  // Basics
  name: string;
  shortDescription?: string;
  fullDescription?: string;
  images?: string[];
  packageCategory: 'stay_package' | 'experience_package' | 'seasonal_offer' | 'custom';
  
  // Room Rules
  applicableRoomTypes: string[];       // Which room types can use this package
  minimumNights: number;               // ⚠️ MIN STAY REQUIREMENT
  maximumNights?: number | null;       // ⚠️ MAX STAY RESTRICTION
  
  // Meal Plans
  includedMealPlanId?: string | null;
  allowMealPlanUpgrade: boolean;
  
  // Services & Experiences
  includedServices: IncludedService[];
  
  // Pricing
  pricingType: 'fixed_price' | 'discounted_bundle' | 'per_night_surcharge';
  packagePrice: number;
  discountDisplay?: string;
  pricingLogic: 'per_guest' | 'per_room';
  
  // Availability & Booking Rules (⚠️ IMPORTANT)
  validFrom?: Timestamp | null;        // Date range when package available
  validTo?: Timestamp | null;
  blackoutDates?: string[];            // Dates when package NOT available
  advanceBookingDays?: number;         // Min days booking in advance required
  cancellationPolicy?: string;
  stackableWithOffers: boolean;        // Can combine with other offers
  
  // Visibility
  visibleOnBooking: boolean;
  visibleInGuestPortal: boolean;
  autoApply: boolean;
  featured: boolean;
  status: 'Draft' | 'Active' | 'Archived';
  
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### Key Observations
- **Bundled pricing + availability rules together** (unique structure)
- **minimumNights / maximumNights:** Length-of-stay control
- **blackoutDates:** Specific dates when package is unavailable
- **advanceBookingDays:** Booking window restriction
- **Multiple room types:** Same package can apply to many room types
- **NO room-level control** (applies at room type level)

### Critical Flags
⚠️ **Duplication Risk:** minStay/maxStay stored here - could conflict with AvailabilitySettings
⚠️ **Complexity:** Packages bundle pricing + availability + meals + services - highly coupled
⚠️ **Gap:** NO "closed to arrival" vs "closed to departure" distinction
⚠️ **Gap:** NO room-level override (only room-type-wide)

---

### 4.3 Meal Plans (Time-based Availability)
**File:** [src/types/mealPlan.ts](src/types/mealPlan.ts) - Partial excerpt showing availability fields

```typescript
export interface MealPlan {
  // ... other fields omitted ...
  
  // Availability & Date Control
  available_dates_start?: Date;        // When this meal plan available
  available_dates_end?: Date;
  minimum_stay?: number;               // ⚠️ MIN STAY for meal plan
  blackout_dates?: string[];           // Dates when meal plan unavailable
  cancellation_policy?: string;
  upgrade_allowed?: boolean;
  
  // Visibility
  visible_on_booking?: boolean;
  visible_in_guest_portal?: boolean;
  status?: string;                     // 'Active' | 'Draft' | 'Archived'
  
  // ... other fields ...
}
```

### Key Observations
- **Meal plan has own availability rules** (separate from packages/rates)
- **minimum_stay:** Can have different min stay than the booking itself
- **blackout_dates:** Meal plan specific blocked dates

### Critical Flags
⚠️ **HIGH DUPLICATION RISK:** 
- Minimum stay stored in: Packages, MealPlans, AvailabilitySettings (potentially 3 sources!)
- Blocked dates stored in: Packages, MealPlans, AvailabilitySettings
⚠️ **Complexity:** Multiple nested rules - unclear which takes precedence

---

## 5. PROPERTY-LEVEL SETTINGS

**File:** [src/types/property.ts](src/types/property.ts) - Partial excerpt

```typescript
export interface Property {
  id: string;
  name: string;
  
  // Booking Preferences
  defaultCheckInTime?: string;         // e.g., "15:00"
  defaultCheckOutTime?: string;        // e.g., "11:00"
  currency?: string;
  timeZone?: string;
  
  // Guest Rules
  allowSameDayBookings?: boolean;      // Property-level override
  cancellationPolicy?: string;         // Default policy
  
  // Booking Page Settings
  bookingPageSettings?: {
    allowSameDayTurnover?: boolean;    // Affects availability calculation
    allowSameDayBookings?: boolean;    // Another same-day setting
    defaultBookingStatus?: 'Confirmed' | 'Pending';
    autoAssignRoom?: boolean;
    // ... other UI settings ...
  };
  
  // ... other fields ...
}
```

### Key Observations
- **allowSameDayBookings appears TWICE** in bookingPageSettings (duplicate?)
- **allowSameDayTurnover:** Controls if checkout-day can be check-in day
- **Property-level defaults** for check-in/out times
- **cancellationPolicy:** Default, can be overridden at rate plan level

### Critical Flags
⚠️ **Design Issue:** Same-day booking logic stored in two places
⚠️ **Complexity:** Property-level defaults + plan-level overrides = multiple points of control

---

## 6. SQL SCHEMA REFERENCE (Supabase)

From [sql/schema-updated.sql](sql/schema-updated.sql):

```sql
-- RATE PLANS TABLE
CREATE TABLE IF NOT EXISTS rate_plans (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  room_type_id TEXT,
  nightly_rate DECIMAL(15, 2) NOT NULL,
  minimum_nights INT DEFAULT 1,           -- ⚠️ STORED IN SUPABASE
  maximum_nights INT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- PACKAGES TABLE
CREATE TABLE IF NOT EXISTS packages (
  -- ... fields from section 4.2 ...
  minimum_nights INT DEFAULT 1,
  maximum_nights INT,
  -- ... other fields ...
);

-- MEAL PLANS TABLE
CREATE TABLE IF NOT EXISTS meal_plans (
  -- ... includes minimum_stay, available_dates_start/end, blackout_dates ...
);
```

### Key Observations
- **Supabase schema has minimum/maximum_nights in rate_plans table** (different from Firestore)
- **Duplication across packages, meal_plans, rate_plans tables**
- **No dedicated availability_blocks table** yet

---

## 7. DUPLICATION MATRIX

### Current Duplication Issues

| Field/Concept | Room Type | Room | RatePlan | SeasonalRate | Package | MealPlan | AvailabilitySetting | Property |
|---|---|---|---|---|---|---|---|---|
| **Base Pricing** | baseRate | ❌ | ✓ | ✓ (override) | ✓ | ❌ | ❌ | ❌ |
| **Min Stay** | ❌ | ❌ | ✓ (SQL) | ❌ | ✓ | ✓ | ❌ | ❌ |
| **Max Stay** | ❌ | ❌ | ✓ (SQL) | ❌ | ✓ | ❌ | ❌ | ❌ |
| **Blocked Dates** | ❌ | ❌ | ❌ | ❌ | ✓ | ✓ | ✓ | ❌ |
| **Date Range** | ❌ | ❌ | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ |
| **Same-day Rules** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✓ (×2) |
| **Cancellation Policy** | ❌ | ❌ | ✓ | ❌ | ✓ | ✓ | ❌ | ✓ |

### High-Risk Duplication Areas

1. **minimum_nights / maximum_nights**
   - RatePlan (SQL schema)
   - Package
   - MealPlan
   - **NO clear hierarchy or conflict resolution**

2. **Blocked Dates / Date Ranges**
   - Package.blackoutDates
   - MealPlan.blackout_dates
   - AvailabilitySetting (date-based blocking)
   - **NO unified availability calendar**

3. **Same-Day Booking**
   - Property.allowSameDayBookings
   - Property.bookingPageSettings.allowSameDayBookings
   - Property.bookingPageSettings.allowSameDayTurnover
   - **THREE separate settings - unclear precedence**

4. **Cancellation Policy**
   - Property (default)
   - RatePlan
   - Package
   - MealPlan
   - **NO clear precedence order**

---

## 8. MISSING/GAP ANALYSIS

### What EXISTS:
- ✓ Base pricing (per night, per guest)
- ✓ Seasonal price overrides
- ✓ Binary availability blocking
- ✓ Min/max stay (but scattered across multiple tables)
- ✓ Blocked dates (but scattered)
- ✓ Date ranges for dynamic pricing

### What's MISSING (No Existing Storage):
- ❌ **Closed to Arrival** (can't book starting on this date)
- ❌ **Closed to Departure** (can't book ending on this date)
- ❌ **Occupancy Rate Limits** (e.g., max 80% occupancy)
- ❌ **Advance Booking Window** (e.g., must book 7+ days ahead)
- ❌ **Last-Minute Pricing** (e.g., 50% off if booked <3 days before)
- ❌ **Room-Level Pricing Overrides** (prices differ per room, not just type)
- ❌ **Group Size Restrictions** (e.g., max 2 guests on specific dates)
- ❌ **LOS (Length of Stay) Pricing** (e.g., 7+ nights = 10% discount)
- ❌ **Early Bird Discounts** (e.g., book 30+ days ahead = discount)
- ❌ **Conflict Resolution Rules** (what if Package.minStay ≠ RatePlan.minimum_nights?)

---

## 9. RECOMMENDATIONS FOR NEW AVAILABILITY SYSTEM

### DO:
1. **Create single source of truth for availability blocks**
   - Use AvailabilitySetting but enhance it:
     - Add `closedToArrival` / `closedToDeparture` boolean flags
     - Add occupancy rate limit field
     - Add group size restrictions

2. **Consolidate min/max stay rules**
   - Define hierarchy: Room Level > Rate Plan > Package Default
   - Store primary rule in RatePlan, allow Package override
   - Remove from MealPlan

3. **Use enums for blocked date types**
   ```typescript
   type BlockType = 'fully_blocked' | 'closed_to_arrival' | 'closed_to_departure' | 'owner_occupied' | 'maintenance';
   ```

4. **Add priority/conflict resolution system**
   - Example: If Package says min 3 nights but User has 2-night availability block, which wins?

### DON'T:
- ❌ Add min/max stay to MealPlan (already in RatePlan)
- ❌ Duplicate blocked dates across multiple tables
- ❌ Create separate fields for allowSameDayBookings
- ❌ Store cancellation policy in every type (use inheritance/reference)

### MIGRATION PREP:
- Document current values for: minimumNights (RatePlan vs Package), blackoutDates (all three sources)
- Create audit log to track which "version" of rule is being used
- Plan data consolidation sprints

---

## 10. CURRENT API ENDPOINTS

Based on workspace analysis:

```
/api/rooms/room-types/list         - Fetch room types
/api/packages/list                 - Fetch packages with availability rules
/api/packages/crud                 - Create/update packages
/api/rate-plans/*                  - Rate plan management (inferred)
```

No dedicated `/api/availability` endpoint found yet.

---

## SUMMARY TABLE

| System Component | Fields Count | Has Pricing | Has Availability | Has Restrictions | Location |
|---|---|---|---|---|---|
| RoomType | 13 | 1 | ❌ | ❌ | Firestore |
| Room | 10 | ❌ | Current state only | ❌ | Firestore |
| RatePlan | 11 | ✓ | ✓ (dates) | ✓ (in SQL) | Firestore + SQL |
| SeasonalRate | 7 | ✓ | ✓ (dates) | ❌ | Firestore |
| Promotion | 10 | ✓ | ✓ (dates) | ❌ | Firestore |
| Package | 24 | ✓ | ✓ | ✓ | Firestore + SQL |
| MealPlan | 25+ | ✓ | ✓ | ✓ | SQL Schema |
| AvailabilitySetting | 8 | ❌ | ✓ (binary) | ❌ | Firestore |
| Property | 20+ | ✓ (settings) | ✓ (defaults) | ✓ (policy) | Firestore |

---

## CRITICAL DECISIONS NEEDED

1. **Consolidate or Keep Separate?**
   - Should AvailabilitySetting absorb all blocking logic?
   - Or keep separate systems for Pricing, Packages, and Availability?

2. **Hierarchy Definition**
   - When Package.minStay conflicts with RatePlan.minimum_nights, which wins?
   - When AvailabilitySetting blocks dates but Package.validTo is later, which wins?

3. **Room-Level Support**
   - Should availability rules apply to individual rooms, or only room types?
   - Current: Partial (AvailabilitySetting supports room-level, Package doesn't)

4. **Migration Path**
   - How to handle existing Packages/RatePlans with min/max stay?
   - Preserve current behavior while building new system in parallel?

