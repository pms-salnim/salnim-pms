# Property Settings - Visual Layout Guide

**Updated:** February 9, 2026

---

## UI LAYOUT

### Sidebar Navigation (Left)
Only shows **main tabs** - no subtabs in sidebar

```
┌──────────────────────┐
│   SETTINGS           │ ← Header
├──────────────────────┤
│ ⚙  System            │
│ 🏢 Property          │
│ 🛏  Rooms & Config   │
│ 💲 Pricing & Revenue │
│ ⚡ Services & Extras │
│ 👥 Team & Access     │
│ 💬 Communication     │
│ 🔧 Integrations      │
│ 💳 Billing & Payments│
│ 🔒 Security & Privacy│
└──────────────────────┘
```

---

## Page Layout Example: System Tab

When user clicks "System" in sidebar:

```
┌────────────────────────────────────────────────────────────┐
│  SIDEBAR           │ System                                │
│                    │ Manage system preferences             │
│ ⚙ System          │                                        │
│ 🏢 Property       │ ┌─────────────────────────────────┐   │
│ ...               │ │ Preferences │ Notifications     │   │ ← Subtab Bar
│                   │ └─────────────────────────────────┘   │
│                   │                                        │
│                   │ [PAGE CONTENT HERE]                    │
│                   │                                        │
│                   │ - Form fields                          │
│                   │ - Inputs                               │
│                   │ - Actions                              │
│                   │ - etc.                                 │
│                   │                                        │
└────────────────────────────────────────────────────────────┘
```

---

## Page Layout Example: Property Tab

When user clicks "Property" in sidebar:

```
┌────────────────────────────────────────────────────────────┐
│  SIDEBAR           │ Property                               │
│                    │ Property management                    │
│ 🏢 Property       │                                        │
│ 🛏  Rooms & Config │ ┌──────────────────────────────────┐  │
│ ...                │ │ Property Infos                   │  │
│                    │ │ Contact                          │  │
│                    │ │ Multi-Property                   │  │
│                    │ │ Operational Defaults             │  │
│                    │ └──────────────────────────────────┘  │ ← Subtab Bar
│                    │                                        │
│                    │ [PAGE CONTENT FOR SELECTED SUBTAB]    │
│                    │                                        │
│                    │ For "Property Infos":                  │
│                    │ - Property Name                        │
│                    │ - Legal Information                    │
│                    │ - etc.                                 │
│                    │                                        │
└────────────────────────────────────────────────────────────┘
```

---

## Page Layout Example: Rooms & Configuration Tab

```
┌────────────────────────────────────────────────────────────┐
│  SIDEBAR           │ Rooms & Configuration                  │
│                    │ Manage rooms and amenities             │
│ 🛏  Rooms & Config │                                        │
│ 💲 Pricing & ...   │ ┌──────────────────────────────────┐  │
│ ...                │ │ Room types │ Rooms │ Features... │  │
│                    │ └──────────────────────────────────┘  │ ← Subtab Bar
│                    │                                        │
│                    │ [PAGE CONTENT]                         │
│                    │                                        │
│                    │ Currently viewing: Room types          │
│                    │ - Create room type                     │
│                    │ - Edit room type                       │
│                    │ - List of room types                   │
│                    │                                        │
└────────────────────────────────────────────────────────────┘
```

---

## Page Layout Example: Pricing & Revenue Tab

```
┌────────────────────────────────────────────────────────────┐
│  SIDEBAR           │ Pricing & Revenue                      │
│                    │ Pricing management                     │
│ 💲 Pricing & ...   │                                        │
│ ⚡ Services & ...  │ ┌──────────────────────────────────┐  │
│ ...                │ │ Rate Plans │ Seasonnal Rates │... │  │
│                    │ └──────────────────────────────────┘  │ ← Subtab Bar
│                    │                                        │
│                    │ [PAGE CONTENT]                         │
│                    │                                        │
│                    │ Currently viewing: Rate Plans          │
│                    │ - Manage pricing tiers                 │
│                    │ - Set default rates                    │
│                    │ - View pricing history                 │
│                    │                                        │
└────────────────────────────────────────────────────────────┘
```

---

## Page Layout Example: Services & Extras Tab

```
┌────────────────────────────────────────────────────────────┐
│  SIDEBAR           │ Services & Extras                      │
│                    │ Manage services and packages           │
│ ⚡ Services & ...  │                                        │
│ 👥 Team & Access   │ ┌──────────────────────────────────┐  │
│ ...                │ │ Services │ Meal Plans │ Packages │  │
│                    │ └──────────────────────────────────┘  │ ← Subtab Bar
│                    │                                        │
│                    │ [PAGE CONTENT]                         │
│                    │                                        │
│                    │ Currently viewing: Services            │
│                    │ - Add service                          │
│                    │ - Edit service                         │
│                    │ - Set pricing & availability           │
│                    │                                        │
└────────────────────────────────────────────────────────────┘
```

---

## Page Layout Example: Team & Access Tab

```
┌────────────────────────────────────────────────────────────┐
│  SIDEBAR           │ Team & Access                          │
│                    │ Team management                        │
│ 👥 Team & Access   │                                        │
│ 💬 Communication   │ ┌──────────────────────────────────┐  │
│ ...                │ │ Users │ Roles & Perms │ Depts │ │  │
│                    │ │  Activity logs                   │  │
│                    │ └──────────────────────────────────┘  │ ← Subtab Bar
│                    │                                        │
│                    │ [PAGE CONTENT]                         │
│                    │                                        │
│                    │ Currently viewing: Users               │
│                    │ - Create user                          │
│                    │ - List all users                       │
│                    │ - Assign roles & permissions           │
│                    │                                        │
└────────────────────────────────────────────────────────────┘
```

---

## Subtab Navigation Styling

### Active Tab (Currently Selected)
```
┌─────────────────────────────────┐
│ Preferences │ Notifications     │
│─────────────┴───────────────────│  ← Blue underline on active
│ BORDER-BOTTOM: blue-500         │
│ TEXT: blue-600                  │
└─────────────────────────────────┘
```

### Inactive Tab (Not Selected)
```
┌─────────────────────────────────┐
│ Preferences │ Notifications     │
│             │                   │
│ NO UNDERLINE                    │  ← No border
│ TEXT: slate-600                 │
│ HOVER: slate-900                │
└─────────────────────────────────┘
```

---

## Color Scheme

### Sidebar
- **Background:** Light gray (`bg-slate-50`)
- **Border:** Subtle gray (`border-slate-200`)
- **Text:** Dark gray (`text-slate-700`)
- **Active Tab:** Blue background with blue text
  - Background: `bg-blue-50`
  - Text: `text-blue-700`
- **Hover:** Lighter gray background
  - Background: `hover:bg-slate-100`

### Subtab Bar
- **Background:** White (inherits from page)
- **Border:** Bottom border (`border-b border-slate-200`)
- **Text:** Dark gray (`text-slate-600`)
- **Active Tab:** Blue underline
  - Border: `border-blue-500` (bottom)
  - Text: `text-blue-600`
- **Hover:** Dark text
  - Text: `hover:text-slate-900`

---

## Navigation Flow

### User Journey

1. **User lands on settings**
   - Redirected to: `/property-settings/system/preferences`

2. **User clicks "Property" in sidebar**
   - Navigates to: `/property-settings/property/infos`
   - Subtabs appear: Property Infos | Contact | Multi-Property | Operational Defaults

3. **User clicks "Contact" subtab**
   - Navigates to: `/property-settings/property/contact`
   - Content changes, subtab "Contact" is highlighted with blue underline

4. **User clicks "Rooms & Configuration" in sidebar**
   - Navigates to: `/property-settings/rooms/room-types`
   - Subtabs change to: Room types | Rooms | Features & Amenities

5. **User can navigate between subtabs within same section**
   - Subtabs stay visible at top
   - Only content changes
   - No reload of sidebar

---

## Responsive Behavior

### Desktop (lg and above - 1024px+)
- Sidebar visible on left: 264px width
- Subtab bar visible at top of content
- Full content area available

### Tablet & Mobile (below lg - less than 1024px)
- Sidebar hidden
- Could add mobile menu (hamburger icon) in future
- Subtab bar still visible at top

---

## Component Structure

```
PropertySettingsLayout (main layout.tsx)
├── PropertySettingsSidebar (always visible on lg)
│   └── Links to 10 main tabs
│
└── Main Content Area
    ├── Current Page Component (e.g., System)
    │   └── [System Layout]
    │       ├── PropertySettingsSubtabs
    │       │   └── Links to 2 subtabs: Preferences, Notifications
    │       │
    │       └── Page Content
    │           └── [Preferences Page or Notifications Page]
```

---

## Accessibility Features

- ✅ Tab navigation with keyboard support
- ✅ Active state clearly indicated
- ✅ Semantic HTML with proper link structure
- ✅ Color contrast meets WCAG standards
- ✅ Clear labeling for all navigation items

---

**Last Updated:** February 9, 2026  
**Design Pattern:** Sidebar + Horizontal Tabs
