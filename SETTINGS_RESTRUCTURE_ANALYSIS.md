# Salnim PMS - Current Structure Analysis & Settings Hierarchy Restructure

## 1. EXISTING APP NAVIGATION STRUCTURE

### Main Sidebar Sections (in order)

#### 🔹 DAILY OPERATIONS (Current)
- **Dashboard** → `/dashboard`
- **Calendar & Availability**
  - Calendar View → `/calendar-availability/calendar`
  - Set Availability → `/calendar-availability/set-availability`
  - Blocked Dates → `/calendar-availability/blocked-dates`
- **Reservations**
  - All Reservations → `/reservations/all`
  - Today's Activity → `/reservations/activity`
  - Cancelled/No-show → `/reservations/cancelled`
  - Groups & Corporate → `/reservations/groups`
- **Guest Relationships**
  - All Guests → `/guests/all`
  - Communication Hub → `/guests/communication`
  - Reputation Management → `/guests/reputation-management`

#### 🔹 ON-PROPERTY OPERATIONS (Current)
- **Rooms**
  - Overview → `/rooms/overview`
  - All Rooms → `/rooms/list`
  - **Room Types** → `/rooms/types` ⚠️ (Config-related)
- **Housekeeping**
  - Operations Dashboard → `/housekeeping/operations-dashboard`
  - Attendant Worksheets → `/housekeeping/attendant-worksheets`
  - Maintenance Requests → `/housekeeping/maintenance-requests`
  - Inventory Management → `/housekeeping/inventory-management`
  - Lost & Found → `/housekeeping/lost-and-found`
- **Extras** (Services, Meal Plans, Packages)
  - Services → `/extra/service`
  - Meal Plans → `/extra/meal-plan`
  - Packages → `/extra/packages`

#### 🔹 TEAM & MANAGEMENT (Current)
- **Team Workspace**
  - Messages → `/team-workspace/messages`
  - Tasks → `/team-workspace/tasks`
- **Staff Management**
  - User Management → `/staff-users/users`
  - Staff Management → `/staff-users/staff`

#### 🔹 COMMERCIAL & FINANCIAL (Current)
- **Rate Plans**
  - All Rate Plans → `/rate-plans/all`
  - Seasonal Pricing → `/rate-plans/seasonal`
  - Promotions → `/rate-plans/promotions`
- **Payments & Invoices**
  - Dashboard → `/payments/dashboard`
  - Payments → `/payments/list`
  - Invoices → `/payments/invoices`
  - Refunds → `/payments/refunds`
- **Revenue & Reports**
  - Overview → `/revenue/overview`
  - Performance Reports → `/revenue/performance-reports`
  - Revenue Log → `/revenue/revenue-log`
  - Expenses → `/revenue/expenses`

---

## 2. CURRENT SETTINGS PAGE (Simplified)

### Current Settings Structure (in settings-sidebar.tsx)
Located at `/settings` with **6 items**:

1. **My Profile** → `/settings/user`
   - User account settings
   - Personal information

2. **Property** → `/settings/property`
   - Property basic info
   - Property details configuration

3. **Branding & Booking** → `/settings/booking`
   - Booking page customization
   - Branding settings

4. **Email Templates** → `/settings/email-templates`
   - Email communication templates

5. **WhatsApp Integration** → `/settings/whatsapp`
   - WhatsApp configuration

6. **Notifications** → `/settings/notifications`
   - Notification preferences

### Additional Settings Folders (unused in current nav)
- `/settings/availability` ⚠️ (Not in current sidebar - conflict with calendar)
- `/settings/crm` ⚠️ (Not in current sidebar - unused)
- `/settings/email-configuration` ⚠️ (Not in current sidebar - separate from templates)

---

## 3. IDENTIFIED ISSUES & DUPLICATIONS

### ⚠️ CONFLICTS & INCONSISTENCIES

| Feature | Current Location | Issue |
|---------|------------------|-------|
| **Room Types Management** | `/rooms/types` | Configuration/Setup task, not operations |
| **Pricing & Rate Plans** | `/rate-plans/*` | Commercial tab, but pricing config belongs in settings |
| **Services/Extras Setup** | `/extra/*` | Operations tab, but these are config/inventory items |
| **Staff User Management** | `/staff-users/*` | Team tab, but user/permission setup is admin |
| **Availability Rules** | `/calendar-availability/set-availability` | Calendar tab, but rule setup is configuration |
| **Housekeeping Rules** | `/housekeeping/*` | Operations tab, but rules/processes are config |
| **Email Config** | `/settings/email-configuration` | Settings, but not in navbar - conflicts with templates |
| **Availability Config** | `/settings/availability` | Settings, but not in navbar - conflicts with calendar |
| **CRM Config** | `/settings/crm` | Settings, but never used |

### 🔴 MISSING/NEEDED SETTINGS

- Security & Access Control (roles, permissions)
- API & Integrations (OTA, calendars, payment gateways)
- Payment Gateway Setup (Stripe, etc.)
- SMS/Email Provider Configuration
- Backup & Data Management
- System Preferences
- Billing & Subscription

---

## 4. RECOMMENDED RESTRUCTURED SETTINGS HIERARCHY

### NEW SETTINGS ORGANIZATION (23 Categories)

```
SETTINGS (/settings)
│
├─ 🏢 PROPERTY & SETUP
│  ├─ General Info (/settings/property)
│  │  └─ Property name, address, phone, email, currency
│  ├─ Property Images (/settings/property-images) [NEW]
│  │  └─ Logo, photos, branding assets
│  ├─ Booking Page (/settings/booking)
│  │  └─ Custom booking page branding
│  └─ Check-in Rules (/settings/checkin-rules) [NEW]
│     └─ Check-in/out times, deposit rules
│
├─ 🏠 ROOMS & SPACE CONFIGURATION
│  ├─ Room Types & Management (/settings/room-types) [MOVED from /rooms/types]
│  │  └─ Create, edit, manage room types with amenities
│  ├─ Rooms Inventory (/settings/rooms-inventory) [NEW]
│  │  └─ Assign rooms to types, manage room numbers
│  └─ Housekeeping Rules (/settings/housekeeping-rules) [MOVED from /housekeeping]
│     └─ Cleaning procedures, inspection checklists
│
├─ 💰 PRICING & REVENUE
│  ├─ Pricing Strategy (/settings/pricing) [MOVED from /rate-plans]
│  │  └─ Base rates, pricing methods
│  ├─ Seasonal Rates (/settings/seasonal-rates) [MOVED from /rate-plans/seasonal]
│  │  └─ Seasonal pricing overrides
│  └─ Promotions & Discounts (/settings/promotions) [MOVED from /rate-plans/promotions]
│     └─ Promotional codes, offers
│
├─ 🛎️ SERVICES & EXTRAS
│  ├─ Services (Add-ons) (/settings/services) [MOVED from /extra/service]
│  │  └─ Breakfast, transportation, activities
│  ├─ Meal Plans (/settings/meal-plans) [MOVED from /extra/meal-plan]
│  │  └─ Dining options configuration
│  └─ Packages & Bundles (/settings/packages) [MOVED from /extra/packages]
│     └─ Package bundling and pricing
│
├─ 👥 TEAM & ACCESS CONTROL
│  ├─ Staff Members (/settings/staff) [MOVED from /staff-users/staff]
│  │  └─ Add/manage staff, roles, permissions
│  ├─ User Management (/settings/users) [MOVED from /staff-users/users]
│  │  └─ Admin user accounts
│  ├─ Roles & Permissions (/settings/roles-permissions) [NEW]
│  │  └─ Custom role definitions, access levels
│  └─ Activity Audit Log (/settings/audit-log) [NEW]
│     └─ User activity tracking, security log
│
├─ 📧 COMMUNICATION & NOTIFICATIONS
│  ├─ Email Templates (/settings/email-templates)
│  │  └─ Booking confirmation, receipt, etc.
│  ├─ Email Provider (/settings/email-provider) [MOVED from /settings/email-configuration]
│  │  └─ SMTP, SendGrid configuration
│  ├─ SMS Configuration (/settings/sms-config) [MOVED from unused]
│  │  └─ Twilio or SMS provider setup
│  ├─ WhatsApp Integration (/settings/whatsapp)
│  │  └─ WhatsApp business account setup
│  └─ Notification Preferences (/settings/notifications)
│     └─ Alert settings, email/SMS/push preferences
│
├─ 🔗 INTEGRATIONS & CONNECTIONS
│  ├─ OTA Channels (/settings/ota-integrations) [NEW]
│  │  └─ Airbnb, Booking.com, Expedia connections
│  ├─ Calendar Sync (/settings/calendar-sync) [NEW]
│  │  └─ Google Calendar, iCal sync settings
│  ├─ Payment Gateways (/settings/payment-methods) [NEW]
│  │  └─ Stripe, PayPal, Square configuration
│  ├─ Accounting Software (/settings/accounting-sync) [NEW]
│  │  └─ QuickBooks, Xero integration
│  └─ API Keys (/settings/api-keys) [NEW]
│     └─ Developer API access, webhooks
│
├─ 💳 BILLING & PAYMENTS
│  ├─ Subscription Plan (/settings/subscription) [NEW]
│  │  └─ Current plan, upgrade/downgrade
│  ├─ Payment Methods (/settings/billing-methods) [NEW]
│  │  └─ Saved cards, billing address
│  ├─ Invoices & Billing (/settings/billing) [NEW]
│  │  └─ Invoice history, billing statements
│  ├─ Commission Settings (/settings/commissions) [NEW]
│  │  └─ OTA commission rates, calculations
│  └─ Tax Configuration (/settings/taxes) [NEW]
│     └─ Tax rates, tax IDs, compliance
│
├─ 🔐 SECURITY & PRIVACY
│  ├─ Security Settings (/settings/security) [NEW]
│  │  └─ Password policy, 2FA, IP whitelist
│  ├─ Data & Privacy (/settings/privacy) [NEW]
│  │  └─ Data retention, GDPR compliance
│  ├─ Backup & Export (/settings/backup) [NEW]
│  │  └─ Data backup, export functionality
│  └─ Third-party Access (/settings/third-party) [NEW]
│     └─ OAuth apps, connected services
│
├─ ⚙️ SYSTEM & PREFERENCES
│  ├─ Language & Localization (/settings/localization) [NEW]
│  │  └─ Language, timezone, date format
│  ├─ Advanced Settings (/settings/advanced) [NEW]
│  │  └─ System preferences, feature flags
│  └─ Developer Tools (/settings/developer) [NEW]
│     └─ Debug mode, logs, webhooks
│
└─ 👤 PERSONAL
   ├─ My Profile (/settings/user)
   │  └─ Personal account, email, password
   └─ Preferences (/settings/preferences) [NEW]
      └─ Dashboard layout, theme, language
```

---

## 5. MIGRATION PLAN

### Phase 1: Move from Main Nav to Settings (Week 1)
- ✅ Room Types: `/rooms/types` → `/settings/room-types`
- ✅ Rate Plans: `/rate-plans/*` → `/settings/pricing`, `/settings/seasonal-rates`, `/settings/promotions`
- ✅ Services: `/extra/*` → `/settings/services`, `/settings/meal-plans`, `/settings/packages`
- ✅ Staff/Users: `/staff-users/*` → `/settings/staff`, `/settings/users`, `/settings/roles-permissions`

### Phase 2: Consolidate Settings Pages (Week 2)
- ✅ Move `/settings/availability` → `/settings/checkin-rules`
- ✅ Merge `/settings/email-configuration` → `/settings/email-provider`
- ✅ Remove unused `/settings/crm`
- ✅ Organize existing pages into categories

### Phase 3: Create Missing Settings (Week 3-4)
- ✅ OTA Integrations
- ✅ Calendar Sync
- ✅ Payment Gateways
- ✅ Security Settings
- ✅ API Keys & Developer Tools
- ✅ Billing & Subscription Management

### Phase 4: Update Main Navigation (Week 2)
After moving items, main nav becomes:
1. Dashboard
2. Calendar & Availability (for viewing only)
3. Reservations
4. Guest Relationships
5. Rooms (operations only: overview, occupied/vacant status)
6. Housekeeping (operations: worksheets, maintenance tasks, inventory)
7. Team Workspace (messages, tasks)
8. Revenue & Reports (financial dashboards)
9. Settings (comprehensive configuration)

---

## 6. BENEFITS OF THIS RESTRUCTURE

✅ **Clear Separation**: Operations (dynamic) vs Configuration (static)
✅ **Reduced Clutter**: Main nav focused on daily operations
✅ **Scalability**: Room for growth without nav bloat
✅ **User Experience**: Admin can find all setup in one place
✅ **Permissions**: Clear settings that need admin vs staff
✅ **Mobile Friendly**: Settings sidebar works well on mobile
✅ **Searchable**: All settings easily searchable
✅ **Consistent**: Grouped logically by business areas

---

## 7. IMPLEMENTATION DETAILS

### New Settings Sidebar Navigation
```typescript
const settingsNavItems = [
  // Property & Setup
  { category: "property_setup", items: [
    { label: "general_info", href: "/settings/property" },
    { label: "property_images", href: "/settings/property-images" },
    { label: "booking_page", href: "/settings/booking" },
    { label: "checkin_rules", href: "/settings/checkin-rules" },
  ]},
  
  // Rooms & Configuration
  { category: "rooms_configuration", items: [
    { label: "room_types", href: "/settings/room-types" },
    { label: "rooms_inventory", href: "/settings/rooms-inventory" },
    { label: "housekeeping_rules", href: "/settings/housekeeping-rules" },
  ]},
  
  // Pricing
  { category: "pricing_revenue", items: [
    { label: "pricing_strategy", href: "/settings/pricing" },
    { label: "seasonal_rates", href: "/settings/seasonal-rates" },
    { label: "promotions", href: "/settings/promotions" },
  ]},
  
  // Services
  { category: "services_extras", items: [
    { label: "services", href: "/settings/services" },
    { label: "meal_plans", href: "/settings/meal-plans" },
    { label: "packages", href: "/settings/packages" },
  ]},
  
  // Team
  { category: "team_access", items: [
    { label: "staff_members", href: "/settings/staff" },
    { label: "user_management", href: "/settings/users" },
    { label: "roles_permissions", href: "/settings/roles-permissions" },
    { label: "audit_log", href: "/settings/audit-log" },
  ]},
  
  // Communication
  { category: "communication", items: [
    { label: "email_templates", href: "/settings/email-templates" },
    { label: "email_provider", href: "/settings/email-provider" },
    { label: "sms_config", href: "/settings/sms-config" },
    { label: "whatsapp", href: "/settings/whatsapp" },
    { label: "notifications", href: "/settings/notifications" },
  ]},
  
  // Integrations
  { category: "integrations", items: [
    { label: "ota_channels", href: "/settings/ota-integrations" },
    { label: "calendar_sync", href: "/settings/calendar-sync" },
    { label: "payment_gateways", href: "/settings/payment-methods" },
    { label: "accounting", href: "/settings/accounting-sync" },
    { label: "api_keys", href: "/settings/api-keys" },
  ]},
  
  // Billing
  { category: "billing_payments", items: [
    { label: "subscription", href: "/settings/subscription" },
    { label: "billing_methods", href: "/settings/billing-methods" },
    { label: "invoices", href: "/settings/billing" },
    { label: "commissions", href: "/settings/commissions" },
    { label: "taxes", href: "/settings/taxes" },
  ]},
  
  // Security
  { category: "security_privacy", items: [
    { label: "security", href: "/settings/security" },
    { label: "privacy", href: "/settings/privacy" },
    { label: "backup", href: "/settings/backup" },
    { label: "third_party", href: "/settings/third-party" },
  ]},
  
  // System
  { category: "system_preferences", items: [
    { label: "localization", href: "/settings/localization" },
    { label: "advanced", href: "/settings/advanced" },
    { label: "developer", href: "/settings/developer" },
  ]},
  
  // Personal
  { category: "personal", items: [
    { label: "my_profile", href: "/settings/user" },
    { label: "preferences", href: "/settings/preferences" },
  ]},
];
```

---

## 8. FILE STRUCTURE AFTER MIGRATION

```
src/app/(app)/
├── settings/
│   ├── layout.tsx (new: with mega sidebar)
│   ├── page.tsx (redirect to default)
│   ├── property/
│   ├── property-images/ [NEW]
│   ├── booking/
│   ├── checkin-rules/ [NEW]
│   ├── room-types/ [MOVED from /rooms/types]
│   ├── rooms-inventory/ [NEW]
│   ├── housekeeping-rules/ [NEW]
│   ├── pricing/ [NEW - replaces /rate-plans]
│   ├── seasonal-rates/ [MOVED]
│   ├── promotions/ [MOVED]
│   ├── services/ [MOVED from /extra/service]
│   ├── meal-plans/ [MOVED from /extra/meal-plan]
│   ├── packages/ [MOVED from /extra/packages]
│   ├── staff/ [MOVED from /staff-users/staff]
│   ├── users/ [MOVED from /staff-users/users]
│   ├── roles-permissions/ [NEW]
│   ├── audit-log/ [NEW]
│   ├── email-templates/
│   ├── email-provider/ [MERGED from email-configuration]
│   ├── sms-config/ [NEW]
│   ├── whatsapp/
│   ├── notifications/
│   ├── ota-integrations/ [NEW]
│   ├── calendar-sync/ [NEW]
│   ├── payment-methods/ [NEW]
│   ├── accounting-sync/ [NEW]
│   ├── api-keys/ [NEW]
│   ├── subscription/ [NEW]
│   ├── billing-methods/ [NEW]
│   ├── billing/ [NEW]
│   ├── commissions/ [NEW]
│   ├── taxes/ [NEW]
│   ├── security/ [NEW]
│   ├── privacy/ [NEW]
│   ├── backup/ [NEW]
│   ├── third-party/ [NEW]
│   ├── localization/ [NEW]
│   ├── advanced/ [NEW]
│   ├── developer/ [NEW]
│   ├── user/
│   └── preferences/ [NEW]
│
├── rooms/ (simplified to operations only)
│   ├── overview/
│   └── list/
│
├── rate-plans/ [DELETED - moved to settings]
├── extra/ [DELETED - moved to settings]
└── staff-users/ [DELETED - moved to settings]
```

---

## 9. UPDATED MAIN NAVIGATION (siteConfig)

```typescript
mainNav: [
  { title: "Dashboard", href: "/dashboard", icon: "Dashboard" },
  { 
    title: "Calendar", 
    href: "/calendar-availability", 
    icon: "CalendarDays",
    children: [
      { title: "Calendar View", href: "/calendar-availability/calendar" },
      { title: "Blocked Dates", href: "/calendar-availability/blocked-dates" },
    ]
  },
  { title: "Reservations", href: "/reservations", icon: "CalendarCheck" },
  { title: "Guests", href: "/guests", icon: "Users" },
  { 
    title: "Rooms", 
    href: "/rooms", 
    icon: "BedDouble",
    children: [
      { title: "Overview", href: "/rooms/overview" },
      { title: "All Rooms", href: "/rooms/list" },
    ]
  },
  { title: "Housekeeping", href: "/housekeeping", icon: "SprayCan" },
  { title: "Team Workspace", href: "/team-workspace", icon: "Users" },
  { title: "Revenue & Reports", href: "/revenue", icon: "TrendingUp" },
  { title: "Settings", href: "/settings", icon: "Settings" },
]
```

---

## Summary

**Current State**: 6 scattered settings pages, 20+ items spread across main navigation
**Proposed State**: 23 organized settings categories, cleaner main navigation (8 items max)
**Result**: Better UX, clearer separation of concerns, easier to navigate and maintain

