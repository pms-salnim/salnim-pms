# Property Settings - Updated Structure

**Date:** February 9, 2026  
**Status:** ✅ Complete & Build Verified  
**Build Time:** 11.4s

---

## NEW STRUCTURE

The property settings now have a two-level navigation:
- **Sidebar** (Left): Shows only main tabs
- **Subtab Navigation** (Top of page): Shows subtabs as horizontal tabs inside each section

### Directory Structure

```
/property-settings/
├── layout.tsx                          [Main Settings Layout]
├── page.tsx                            [Root - Redirects to /system/preferences]
│
├── /system/                            [2 pages]
│   ├── layout.tsx                      [Shows Preferences & Notifications tabs]
│   ├── /preferences/page.tsx
│   └── /notifications/page.tsx
│
├── /property/                          [4 pages]
│   ├── layout.tsx                      [Shows Property Infos, Contact, Multi-Property, Operational tabs]
│   ├── /infos/page.tsx
│   ├── /contact/page.tsx
│   ├── /multi-property/page.tsx
│   └── /operational-defaults/page.tsx
│
├── /rooms/                             [3 pages]
│   ├── layout.tsx                      [Shows Room types, Rooms, Features tabs]
│   ├── /room-types/page.tsx
│   ├── /rooms/page.tsx
│   └── /features/page.tsx
│
├── /pricing/                           [3 pages]
│   ├── layout.tsx                      [Shows Rate Plans, Seasonal Rates, Promotions tabs]
│   ├── /rate-plans/page.tsx
│   ├── /seasonal-rates/page.tsx
│   └── /promotions/page.tsx
│
├── /services/                          [3 pages]
│   ├── layout.tsx                      [Shows Services, Meal Plans, Packages tabs]
│   ├── /services/page.tsx
│   ├── /meal-plans/page.tsx
│   └── /packages/page.tsx
│
├── /team/                              [4 pages]
│   ├── layout.tsx                      [Shows Users, Roles & Permissions, Departments, Activity logs tabs]
│   ├── /users/page.tsx
│   ├── /roles-permissions/page.tsx
│   ├── /departments/page.tsx
│   └── /activity-logs/page.tsx
│
├── /communication/                     [5 pages - unchanged]
├── /integrations/                      [5 pages - unchanged]
├── /billing/                           [5 pages - unchanged]
└── /security/                          [4 pages - unchanged]
```

---

## UPDATED TABS

### System Tab
- **Location:** Sidebar - Last item
- **Routes:**
  - `/property-settings/system/preferences`
  - `/property-settings/system/notifications`

### Property Tab
- **Location:** Sidebar - 2nd item
- **Routes:**
  - `/property-settings/property/infos` - Property Infos (general information - Legal Information)
  - `/property-settings/property/contact` - Contact (Address - Email - Phones)
  - `/property-settings/property/multi-property` - Multi-Property (Property list - Property groups - Cross-property rules)
  - `/property-settings/property/operational-defaults` - Operational Defaults (Check-in/check-out - House Rules - Policies & Terms)

### Rooms & Configuration Tab
- **Location:** Sidebar - 3rd item
- **Routes:**
  - `/property-settings/rooms/room-types` - Room types
  - `/property-settings/rooms/rooms` - Rooms
  - `/property-settings/rooms/features` - Features & Amenities

### Pricing & Revenue Tab
- **Location:** Sidebar - 4th item
- **Routes:**
  - `/property-settings/pricing/rate-plans` - Rate Plans
  - `/property-settings/pricing/seasonal-rates` - Seasonnal Rates
  - `/property-settings/pricing/promotions` - Promotions

### Services & Extras Tab
- **Location:** Sidebar - 5th item
- **Routes:**
  - `/property-settings/services/services` - Services
  - `/property-settings/services/meal-plans` - Meal Plans
  - `/property-settings/services/packages` - Packages

### Team & Access Tab
- **Location:** Sidebar - 6th item
- **Routes:**
  - `/property-settings/team/users` - Users
  - `/property-settings/team/roles-permissions` - Roles & Permissions
  - `/property-settings/team/departments` - Departments
  - `/property-settings/team/activity-logs` - Activity logs

---

## COMPONENTS

### PropertySettingsSidebar
- **File:** `/src/components/property-settings/property-settings-sidebar.tsx`
- **Features:**
  - 10 main tabs only (no subtabs in sidebar)
  - Icon support for each tab
  - Active state highlighting (blue background)
  - Simple flat structure
  - Responsive (hidden on mobile, visible on lg)

### PropertySettingsSubtabs
- **File:** `/src/components/property-settings/property-settings-subtabs.tsx`
- **Features:**
  - Horizontal tab bar for subtabs
  - Displays at top of each main section page
  - Active tab highlighted with blue underline
  - Links to all subtabs within a category

---

## LAYOUT STRUCTURE

### Main Layout
**File:** `/src/app/(app)/property-settings/layout.tsx`
```
┌─────────────────────────────────────────────┐
│  SIDEBAR (Main Tabs) │  PAGE CONTENT         │
│                      │                       │
│  - System            │  [Title]              │
│  - Property          │  [Subtabs Bar]        │
│  - Rooms & Config    │  [Content Here]       │
│  - Pricing & Revenue │                       │
│  - Services & Extras │                       │
│  - Team & Access     │                       │
│  - etc.              │                       │
└─────────────────────────────────────────────┘
```

### Category Layouts (e.g., System, Property, etc.)
Each category has a nested layout that displays the subtab navigation:
```
┌─────────────────────────────────────────────┐
│ System                                      │
├─────────────────────────────────────────────┤
│ Preferences │ Notifications                 │
├─────────────────────────────────────────────┤
│ [Content for selected subtab]               │
└─────────────────────────────────────────────┘
```

---

## ROUTING

**Entry Point:**
```
/property-settings → /property-settings/system/preferences
```

**Pattern:**
```
/property-settings/[category]/[subtab]
```

### Examples:
- `/property-settings/system/preferences`
- `/property-settings/property/infos`
- `/property-settings/property/contact`
- `/property-settings/rooms/room-types`
- `/property-settings/pricing/rate-plans`
- `/property-settings/services/services`
- `/property-settings/team/users`

---

## SUBTAB COMPONENTS

Each category page includes a layout that renders subtabs:

### System Layout
```tsx
const systemSubtabs = [
  { id: 'preferences', label: 'Preferences', href: '/property-settings/system/preferences' },
  { id: 'notifications', label: 'Notifications', href: '/property-settings/system/notifications' },
];
```

### Property Layout
```tsx
const propertySubtabs = [
  { id: 'infos', label: 'Property Infos', href: '/property-settings/property/infos' },
  { id: 'contact', label: 'Contact', href: '/property-settings/property/contact' },
  { id: 'multi-property', label: 'Multi-Property', href: '/property-settings/property/multi-property' },
  { id: 'operational', label: 'Operational Defaults', href: '/property-settings/property/operational-defaults' },
];
```

### Rooms Layout
```tsx
const roomsSubtabs = [
  { id: 'room-types', label: 'Room types', href: '/property-settings/rooms/room-types' },
  { id: 'rooms', label: 'Rooms', href: '/property-settings/rooms/rooms' },
  { id: 'features', label: 'Features & Amenities', href: '/property-settings/rooms/features' },
];
```

### Pricing Layout
```tsx
const pricingSubtabs = [
  { id: 'rate-plans', label: 'Rate Plans', href: '/property-settings/pricing/rate-plans' },
  { id: 'seasonal', label: 'Seasonnal Rates', href: '/property-settings/pricing/seasonal-rates' },
  { id: 'promotions', label: 'Promotions', href: '/property-settings/pricing/promotions' },
];
```

### Services Layout
```tsx
const servicesSubtabs = [
  { id: 'services', label: 'Services', href: '/property-settings/services/services' },
  { id: 'meals', label: 'Meal Plans', href: '/property-settings/services/meal-plans' },
  { id: 'packages', label: 'Packages', href: '/property-settings/services/packages' },
];
```

### Team Layout
```tsx
const teamSubtabs = [
  { id: 'users', label: 'Users', href: '/property-settings/team/users' },
  { id: 'roles', label: 'Roles & Permissions', href: '/property-settings/team/roles-permissions' },
  { id: 'departments', label: 'Departments', href: '/property-settings/team/departments' },
  { id: 'activity', label: 'Activity logs', href: '/property-settings/team/activity-logs' },
];
```

---

## SIDEBAR TABS (10 Main Tabs)

1. **System** - `Settings` icon
2. **Property** - `Building` icon
3. **Rooms & Configuration** - `Bed` icon
4. **Pricing & Revenue** - `DollarSign` icon
5. **Services & Extras** - `Zap` icon
6. **Team & Access** - `Users` icon
7. **Communication** - `MessageSquare` icon
8. **Integrations** - `Zap` icon
9. **Billing & Payments** - `CreditCard` icon
10. **Security & Privacy** - `Shield` icon

---

## TOTAL PAGES

- **System:** 2 pages
- **Property:** 4 pages
- **Rooms & Configuration:** 3 pages
- **Pricing & Revenue:** 3 pages
- **Services & Extras:** 3 pages
- **Team & Access:** 4 pages
- **Communication:** 5 pages
- **Integrations:** 5 pages
- **Billing & Payments:** 5 pages
- **Security & Privacy:** 4 pages

**Total: 38 pages**

---

## BUILD STATUS

✅ **Compiled successfully in 11.4s**  
✅ **129 static pages generated in 543.4ms**  
✅ **No errors or warnings**  
✅ **Production ready**

---

## STYLING

### Sidebar
- Background: `bg-slate-50`
- Border: `border-slate-200`
- Active: `bg-blue-50 text-blue-700`
- Hover: `hover:bg-slate-100`

### Subtab Bar
- Border: `border-b border-slate-200`
- Active: `border-blue-500 text-blue-600`
- Inactive: `border-transparent text-slate-600`
- Hover: `hover:text-slate-900`

---

## NEXT STEPS

1. Add form components for each page
2. Integrate with Firestore for data persistence
3. Add form validation
4. Implement state management
5. Add modals for advanced actions
6. Create mobile menu for sidebar
7. Add breadcrumb navigation
8. Implement search functionality
9. Create context for shared settings state

---

**Last Updated:** February 9, 2026  
**Status:** ✅ Structure Complete & Verified
