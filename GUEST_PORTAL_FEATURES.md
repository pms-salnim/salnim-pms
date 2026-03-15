# Guest Portal - Complete Features List

## Overview
The guest portal is a mobile-first, fully responsive application that provides guests with an intuitive platform to manage their reservation and access property services. Built with React 18, TypeScript, Next.js, Tailwind CSS, and Firebase.

---

## 1. HEADER & NAVIGATION

### Floating Header (Fixed Top)
- **Property Logo** - Displays property's branded logo with fallback to app default
- **Property Name** - Shows property name (visible on desktop)
- **Property Address** - Displays full address (visible on desktop)
- **Phone Button**
  - Desktop: Full button with phone number and icon
  - Mobile: Icon-only button with hover info
  - Direct calling functionality via tel: link
- **Logout Button** - Quick logout with hover effect

### Bottom Navigation Bar (Fixed)
- **Mobile-First Design** - All 5 tabs always visible (not collapsed)
- **5 Main Tabs:**
  1. **Home** - Dashboard/welcome section
  2. **Chat** - Real-time messaging with property
  3. **Bill** - Financial summary and payment details
  4. **Reviews** - Property and experience reviews
  5. **Profile** - Guest personal information
- **Responsive Heights:**
  - Mobile: `pb-24` (6rem padding bottom for nav)
  - Desktop: Adjusted spacing
- **Visual Feedback**
  - Active tab: Bright white text + elevated background
  - Inactive tabs: Muted white/60% opacity
  - Hover states with smooth transitions
  - Active indicator dot above selected tab

---

## 2. HOME TAB (Dashboard)

### 2.1 Hero Banner with Room Gallery
- **Feature:** Full-width image carousel showing room type images
- **Default Image:** Displays room type's main thumbnail image first
- **Navigation:**
  - Left/Right arrow buttons (appear on hover)
  - Clickable image indicator dots at bottom
  - Smooth image transitions
- **Images:** Combines thumbnail + gallery images in order
- **Responsive Heights:**
  - Mobile: `h-64` (256px)
  - Tablet: `sm:h-80` (320px)
  - Desktop: `lg:h-96` (384px)
- **Visual Effects:**
  - Gradient overlay (black fade from bottom)
  - Hover scale on navigation buttons
  - Image indicators change width when active

### 2.2 Welcome Section
- **Welcome Message** - Personalized greeting with guest name
- **Reservation Badge** - Shows reservation number
- **Reservation Status Indicator** - Color-coded status (Confirmed, Checked-in, etc.)
- **Stay Timeline**
  - Check-in date with day of week
  - Check-out date with day of week
  - Visual separation with arrow icon
- **Dynamic Welcome Text** - Changes based on reservation status:
  - Before check-in: "Your stay begins in X days"
  - During stay: "You have X days remaining"
  - After check-out: "Thank you for staying with us"
- **Online Check-in Button** - Direct access to check-in form

### 2.3 Room Details (Multi-room Support)
- **Room Cards for Each Booked Room** - Separate card per room
- **Room Information per Card:**
  - Room type name (e.g., "Deluxe Suite")
  - Room name/number (e.g., "201")
  - Number of nights staying
  - Adult count with Users icon
  - Children count with faded Users icon
- **Edit Button** - Quick access to edit reservation details
- **Flat Design** - No separate modals, inline display

### 2.4 Quick Actions Grid
- **4 Action Cards:**
  1. **Bill Card**
     - Shows total amount due
     - Currency symbol from property settings
     - Click to navigate to Bill tab
  2. **Chat Card**
     - Direct messaging with property
     - Click to navigate to Chat tab
  3. **Service Request Card**
     - Housekeeping/maintenance requests
     - Toast notification on submit
  4. **Profile Card**
     - Manage guest information
     - Click to navigate to Profile tab
- **Design Features:**
  - Gradient backgrounds with decorative blur effects
  - Color-coded icons per action
  - Hover animations (scale, shadow)
  - Responsive: 2 columns mobile, 4 columns desktop

### 2.5 Enhance Stay Section (Experiences)
- **Dynamic Extras Display** - Shows services, meal plans, and packages
- **Extra Types:**
  - Services (blue badges)
  - Meal Plans (orange badges)
  - Packages (purple badges)
- **Per Extra Card:**
  - Image (if available) or icon fallback
  - Name and description
  - Price display
  - "Add to Stay" button with toast notification
  - Category badge
  - Gradient overlay for image text visibility
- **View All Button** - Access complete list of available extras
- **Grid Layout:**
  - Mobile: 1 column, shows first 4
  - Desktop: 2 columns, shows first 4 with "All" button
- **Responsive Handling** - Adapts image heights for mobile/desktop

### 2.6 Property Amenities Section
- **Desktop Only Feature** - Hidden on mobile to save space
- **Amenity Icons Grid** - 4-column layout
- **Sample Amenities:** WiFi, Breakfast, AC, Premium features
- **Design:** Background gradient with consistent icon styling

---

## 3. BILL TAB

### Features (BillTab Component)
- **Real-time Ledger Synchronization** - Updates from Cloud Firestore
- **Bill Summary**
  - Base room rate
  - Additional charges/extras
  - Taxes
  - Total amount due
- **Payment Status**
- **Charge Breakdown** - Itemized view
- **Currency Display** - From property settings

---

## 4. CHAT TAB

### Features (GuestPortalChatView Component)
- **Real-time Messaging** - Firebase Firestore-backed
- **Message History** - Load and display conversation history
- **Send Messages** - Input field with send functionality
- **Conversation Management** - Multiple conversation support
- **Typing Indicators** - Real-time user presence
- **Timestamp Display** - Message timestamps

---

## 5. REVIEWS TAB

### Features
- **Property Reviews** - Guest-submitted reviews
- **Rating Display** - Star ratings
- **Review Submission** - Leave new review
- **Responsive Layout** - Mobile and desktop optimized

---

## 6. PROFILE TAB

### Features (ProfileTab Component)
- **Guest Information Display**
  - Name
  - Email
  - Phone
  - Country/City
  - Address
  - Zip code
- **Profile Editing** - Update guest details
- **ID Information** - Passport/ID number display
- **Gender & Date of Birth** - Personal details
- **Profile Image** - Guest avatar/photo
- **Notes/History** - Guest notes from property

---

## 7. MODALS & DIALOGS

### 7.1 Check-in Form Modal
- **Header** - Key icon + "Check-in Form" title
- **Progress Indicator**
  - Bar showing completion percentage
  - 3-step progress:
    1. ID Verified
    2. Payment Confirmed
    3. Key Issued
- **Room Cards with Images** - One card per room
  - Room type gallery images with navigation
  - Left/Right arrow buttons for browsing images
  - Image indicator dots (clickable)
  - Room details (name, price, stay length)
  - Full-width responsive image display
- **Guest ID Upload Section**
  - ID Type dropdown selector
  - Front document upload (image/PDF)
  - Back document upload (image/PDF)
  - Document previews with thumbnails
  - Delete buttons for each document
  - Editable guest names
  - Per-guest document organization
- **Validation** - All guests must have both front/back documents
- **Session Storage** - Persists data during session, clears after check-in
- **Submit Button** - Completes check-in process

### 7.2 Edit Reservation Modal
- **Header** - Document icon + "Edit Reservation" title
- **Editable Fields**
  - Dates (check-in/check-out)
  - Accommodation type
  - Guest count
- **Visual Elements**
  - Cancel button
  - Delete icon
  - Building icon
- **Close Button** - X icon in header

---

## 8. REAL-TIME FEATURES

### Firebase Integration
- **Firestore Collections Used:**
  - `/properties/{propertyId}` - Property data, settings, logo
  - `/roomTypes/{roomTypeId}` - Room type details with images
  - `/reservations/{reservationId}` - Reservation data
  - `/conversations` - Chat messages
- **Cloud Functions:**
  - `guestPortalCheck.ts` - Validates reservations, calculates guest counts
  - `guestPortalData.ts` - Fetches services, meal plans, packages
- **Real-time Listeners**
  - Reservation status updates
  - Chat message sync
  - Service/meal plan/package availability

### Data Structures
- **Reservation Object:**
  - `reservationId`, `reservationNumber`
  - `startDate`, `endDate`
  - `status`, `guestName`
  - `rooms[]` - Array of booked rooms
  - `additionalGuests[]` - Extra guests
- **Room in Reservation:**
  - `roomTypeId`, `roomTypeName`, `roomName`
  - `adults`, `children`
  - `price`, `selectedExtras`
- **Room Type:**
  - `name`, `description`
  - `thumbnailImageUrl` - Main image
  - `galleryImageUrls[]` - Additional images
  - `amenities`, `maxGuests`, `beds`

---

## 9. RESPONSIVE DESIGN

### Breakpoints
- **Mobile** (< 640px)
  - Stacked layouts
  - Single column grids
  - Icon-only buttons in header
  - Larger touch targets
  - Reduced padding/margins (40-50% more content visible)
- **Tablet** (sm: 640px - 1024px)
  - 2-column layouts for some sections
  - Visible text labels + icons
  - More generous spacing
- **Desktop** (lg: 1024px+)
  - Full features displayed
  - 4-column grids
  - All decorative elements
  - Maximum information density

### Mobile-First Optimizations
- Fixed footer navigation (5 tabs always accessible)
- Reduced padding on mobile
- Inline information without extra cards
- Touch-friendly button sizing (min 44px × 44px)
- Performance optimized with lazy loading
- Simplified view on mobile (e.g., no amenities section)

---

## 10. STATE MANAGEMENT

### useState Variables
- `activeTab` - Current selected tab (home/chat/bill/reviews/profile)
- `showCheckInModal` - Check-in form visibility
- `showEditModal` - Edit reservation visibility
- `currentImageIndex` - Hero banner image carousel position
- `roomTypeImages` - Hero banner images array
- `roomImagesMap` - Per-room images map (for check-in cards)
- `roomImageIndices` - Per-room current image index
- `checkInProgress` - Check-in progress state (id/payment/key)
- `guestIdDocuments` - Guest ID uploads with previews
- `fetchedLogoUrl`, `fetchedPhone` - Cached property data

### useEffect Hooks
- Logo and phone number fetching (property id dependency)
- Check-in room images fetching (when check-in modal opens)
- Session storage persistence for documents
- Real-time Firestore listeners (via custom hooks)

---

## 11. STYLING & ANIMATIONS

### Design System
- **Color Palette:**
  - Slate: Primary neutral colors
  - Blue/Purple/Pink: Gradients for highlights
  - Emerald/Cyan: Success/positive states
  - Amber/Orange: Warning/secondary states
- **Shadows:** Consistent shadow hierarchy (sm/md/lg/xl)
- **Rounded Corners:** Consistent radius (lg/xl/2xl)
- **Transitions:** Smooth 300ms ease for all interactive elements

### Hover Effects
- Scale transforms (buttons)
- Background color shifts
- Shadow elevation
- Text color transitions
- Icon animations

### Animations
- Image carousel smooth transitions
- Progress bar width animation
- Floating decorative elements (blur effect)
- Slide-in/out modals
- Pulse animations (indicators)

---

## 12. ACCESSIBILITY FEATURES

- **Semantic HTML** - Proper heading hierarchy, button labels
- **Color Contrast** - WCAG AA compliant text colors
- **Touch Targets** - Minimum 44px × 44px on mobile
- **Keyboard Navigation** - All interactive elements keyboard accessible
- **Screen Reader Support** - Alt text, aria labels where needed
- **Focus States** - Visible focus indicators

---

## 13. PERFORMANCE OPTIMIZATIONS

- **Lazy Loading** - Images load on demand
- **Session Storage** - Reduces API calls for documents
- **Memoization** - useMemo for expensive calculations
- **Component Splitting** - Separate components for each tab
- **Firebase Indexing** - Optimized queries
- **Image Optimization** - Responsive images with correct formats

---

## 14. ERROR HANDLING & UX

### Error States
- Missing images - Fallback to placeholder icon
- Missing data - Default values displayed
- Fetch failures - Console logging + graceful degradation
- Validation errors - Toast notifications
- Network errors - Retry mechanisms

### User Feedback
- Toast notifications for actions (Add, Save, Delete)
- Loading states with visual indicators
- Progress bars for multi-step processes
- Empty states with helpful messages
- Confirmation dialogs for destructive actions

---

## 15. SECURITY & PERMISSIONS

- **Firestore Security Rules** - Document-level access control
- **Property Isolation** - Guests only see own reservation
- **Session Persistence** - Session storage (cleared on close)
- **File Uploads** - Secure Storage upload path
- **Authentication** - Firebase Auth integration (in parent component)

---

## 16. INTERNATIONALIZATION (i18n)

- **Multi-language Support**
  - Status labels translated
  - UI text from translation keys
  - Fallback to English if translation missing
- **Timezone Handling** - Uses guest's local time for dates
- **Currency Display** - Property-specific currency symbols

---

## 17. INTEGRATIONS

### External Services
- **Firebase Authentication** - User management
- **Firebase Firestore** - Real-time database
- **Firebase Cloud Storage** - Image storage
- **Cloud Functions** - Serverless backend logic

### Libraries
- **date-fns** - Date formatting and calculations
- **Lucide React** - Icon library
- **Tailwind CSS** - Styling framework
- **Next.js** - Framework & routing
- **React 18** - UI library

---

## 18. FUTURE ENHANCEMENT OPPORTUNITIES

1. Payment processing integration (Stripe/PayPal)
2. Guest preferences/special requests storage
3. Digital key delivery (Apple Wallet)
4. Weather and local recommendations
5. Dining reservation booking
6. Activity/tour booking
7. Housekeeping scheduling
8. Maintenance request tracking
9. Guest feedback surveys
10. Loyalty points display

---

## 19. DEVELOPMENT NOTES

### File Structure
```
src/components/guest-portal/
├── Dashboard.tsx (1215 lines) - Main component
├── BillTab.tsx - Billing interface
├── ProfileTab.tsx - Profile management
└── types.ts - TypeScript interfaces
```

### Key Props
- `activeTab`, `setActiveTab` - Tab management
- `data` - All portal data (property, reservation, services, etc.)
- `triggerToast` - Toast notification handler
- `showToast`, `toastMessage` - Toast state
- `customContent` - Override JSX for custom views
- `onLogout` - Logout handler

### Recent Implementations
1. ✅ Guest count calculation from rooms array (not reservation-level fields)
2. ✅ Multi-room reservation display
3. ✅ Hero banner with room type gallery
4. ✅ Check-in form with image navigation per room
5. ✅ Thumbnail-first image ordering in check-in
6. ✅ Document upload with session persistence
7. ✅ Mobile-first comprehensive redesign

---

**Last Updated:** February 9, 2026  
**Status:** Production Ready  
**Build:** ✅ Clean (0 errors)
