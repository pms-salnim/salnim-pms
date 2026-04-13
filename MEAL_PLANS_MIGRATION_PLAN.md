# Meal Plans → Supabase Migration Plan

## Overview
Migrate the complete meal-plans management system from Firebase to Supabase, including:
- Meal Plans CRUD (Create, Read, Update, Delete)
- Meal Plan Categories (with hierarchy support: parent/subcategories)
- Filters and search functionality
- API endpoints for CRUD and list operations

---

## 1. DATABASE SCHEMA

### Tables to Create/Update

#### A. `meal_plans` Table (UPDATE - Enhance existing)
**Current State**: Basic table with id, property_id, name, description, price_per_night, meals_included, is_active

**New Fields to Add**:
```
- short_description VARCHAR(500)
- full_description TEXT
- category_id TEXT (FK to meal_plan_categories)
- subcategory_id TEXT (FK to meal_plan_categories)
- meal_plan_type VARCHAR(50) - ENUM: breakfast, half-board, full-board, all-inclusive, custom
- included_meals JSONB - Array: ['breakfast', 'lunch', 'dinner', 'snacks', 'drinks']
- pricing_model VARCHAR(50) - ENUM: per-guest-night, per-room-night, flat-rate
- base_price DECIMAL(15,2)
- adult_price DECIMAL(15,2)
- child_price DECIMAL(15,2)
- infant_price DECIMAL(15,2)
- infant_free BOOLEAN DEFAULT true
- enable_age_pricing BOOLEAN DEFAULT false
- available_dates_start DATE
- available_dates_end DATE
- minimum_stay INT DEFAULT 0
- blackout_dates JSONB - Array of date strings
- cancellation_policy TEXT
- upgrade_allowed BOOLEAN DEFAULT true
- applicable_room_types JSONB - Array of room type IDs
- applicable_rate_plans JSONB - Object mapping room_type_id to array of rate plan IDs
- is_default BOOLEAN DEFAULT false
- visible_on_booking BOOLEAN DEFAULT true
- visible_in_guest_portal BOOLEAN DEFAULT true
- status VARCHAR(50) DEFAULT 'Active' - ENUM: Active, Draft, Archived
```

**Indexes**:
- idx_meal_plans_property_id
- idx_meal_plans_category_id
- idx_meal_plans_subcategory_id
- idx_meal_plans_status
- idx_meal_plans_visible_on_booking
- idx_meal_plans_visible_in_guest_portal

#### B. `meal_plan_categories` Table (NEW)
```
Similar to service_categories with hierarchy support:
- id TEXT PRIMARY KEY
- property_id TEXT NOT NULL (FK to properties)
- name VARCHAR(255) NOT NULL
- parent_id TEXT (FK to self for hierarchy)
- description TEXT
- icon VARCHAR(50) - Optional icon name
- display_order INT DEFAULT 0
- is_active BOOLEAN DEFAULT true
- created_at TIMESTAMP
- updated_at TIMESTAMP

UNIQUE(property_id, parent_id, name)
```

**Indexes**:
- idx_meal_plan_categories_property_id
- idx_meal_plan_categories_parent_id
- idx_meal_plan_categories_is_active

---

## 2. API ENDPOINTS TO CREATE

### /api/meal-plans/list
**Method**: GET
**Query Params**: propertyId
**Auth**: Bearer token
**Response**:
```json
{
  "mealPlans": [
    {
      id, name, shortDescription, fullDescription,
      categoryId, categoryName, subcategoryId, subcategoryName,
      mealPlanType, includedMeals, pricingModel,
      basePrice, adultPrice, childPrice, infantPrice, infantFree, enableAgePricing,
      availableDates, minimumStay, blackoutDates, cancellationPolicy,
      upgradeAllowed, applicableRoomTypes, applicableRatePlans,
      isDefault, visibleOnBooking, visibleInGuestPortal,
      status, createdAt, updatedAt
    }
  ]
}
```
**Features**:
- Transform snake_case to camelCase
- Join with category names
- Order by created_at DESC
- Property ownership verification

### /api/meal-plans/crud
**Method**: POST
**Actions**: 'create' | 'update' | 'delete'
**Auth**: Bearer token
**Error Handling**:
- Property ownership verification
- Validation of JSON fields
- Transaction support for complex operations

### /api/meal-plan-categories/list
**Method**: GET
**Query Params**: propertyId
**Response**: Array of categories with hierarchy
**Features**:
- Sort by parent_id, display_order, name
- Include full hierarchy information

### /api/meal-plan-categories/crud
**Method**: POST
**Actions**: 'create' | 'update' | 'delete'
**Validation on Delete**:
- Check if any meal plans reference this category
- Prevent deletion if referenced (clear messaging)

---

## 3. FRONTEND UPDATES

### Files to Modify
1. **src/app/(app)/property-settings/services-extras/meal-plans/page.tsx**
   - Replace Firebase imports with Supabase
   - Update fetchMealPlans() to use /api/meal-plans/list
   - Update fetchCategories() to use /api/meal-plan-categories/list
   - Update CRUD handlers to use new API endpoints
   - Add refetch on successful create/edit/delete

2. **src/components/extras/add-meal-plan-form.tsx**
   - Replace Firebase imports with Supabase
   - Update form submission to use /api/meal-plans/crud
   - Remove Firebase Storage image handling (keep TODO for future)
   - Handle all new form fields properly

3. **src/components/extras/meal-plan-details-modal.tsx** (If exists)
   - Update data display

---

## 4. MIGRATION PATH (Step-by-Step)

### Phase 1: Database Schema
1. Create migration SQL file: `migration-meal-plans-enhance.sql`
2. Create migration SQL file: `migration-meal-plan-categories-create.sql`
3. Apply migrations to Supabase

### Phase 2: API Endpoints
1. Create `/api/meal-plans/list/route.ts`
2. Create `/api/meal-plans/crud/route.ts`
3. Create `/api/meal-plan-categories/list/route.ts`
4. Create `/api/meal-plan-categories/crud/route.ts`

### Phase 3: Frontend Meal Plans
1. Update meal-plans/page.tsx with API integration
2. Update add-meal-plan-form.tsx with Supabase
3. Test create/edit/delete/duplicate operations
4. Add refetch functionality for real-time updates

### Phase 4: Frontend Categories
1. Ensure category CRUD works via API
2. Test category deletion with validation
3. Test hierarchy (parent/subcategories)

### Phase 5: Testing & Cleanup
1. Unit test all CRUD operations
2. Test property ownership verification
3. Remove all Firebase imports
4. Verify filters work correctly
5. Test error handling

---

## 5. KEY CONSIDERATIONS

### Data Structure
- JSONB fields for arrays and complex objects:
  - included_meals: ['breakfast', 'lunch', 'dinner']
  - applicable_room_types: ['room-type-1', 'room-type-2']
  - applicable_rate_plans: { 'room-type-1': ['plan-1', 'plan-2'], 'room-type-2': ['plan-3'] }
  - blackout_dates: ['2024-12-25', '2024-12-26']

### API Response Transformation
- Database returns: `included_meals` → API returns: `includedMeals`
- Database returns: `meal_plan_type` → API returns: `mealPlanType`
- Database returns: category_id + category join → API returns: `categoryName`

### Property Verification Pattern
- Consistent with services/promotions: `WHERE users.property_id = propertyId`

### Nested Categories Support
- Root level (parentId = NULL)
- Child level (parentId = parent category id)
- Cannot delete parent if has children (validation)
- Cannot delete category if meal plans reference it (validation)

### Immediate Display After Save
- fetchMealPlans() called on successful create/edit/delete
- Services page uses this pattern already

---

## 6. MIGRATION FILE STRUCTURE

```
sql/migrations/
├── migration-meal-plans-enhance.sql
└── migration-meal-plan-categories-create.sql

src/app/api/
├── meal-plans/
│   ├── list/route.ts
│   └── crud/route.ts
└── meal-plan-categories/
    ├── list/route.ts
    └── crud/route.ts
```

---

## 7. SUCCESS CRITERIA
✅ All meal plan CRUD operations work via Supabase API
✅ Categories with hierarchy working properly
✅ Filters accurately reflect displayed results
✅ Real-time updates after save (no page refresh needed)
✅ Property ownership verified on all operations
✅ Error handling and validation in place
✅ No Firebase references in migrated code
✅ Build compiles with 0 errors
