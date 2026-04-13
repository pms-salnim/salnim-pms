# Team/Users Page Migration - Firebase to Supabase Analysis

## Executive Summary

The **Users page** (`/property-settings/team/users`) is currently **100% Firebase-dependent**, using Firebase Auth and Firestore for staff user management. There is **NO existing Supabase infrastructure** for team/users management yet. This document outlines the complete migration requirements.

---

## 1. CURRENT FIREBASE IMPLEMENTATION

### Page Location & Purpose
- **Route:** `/app/(app)/property-settings/team/users/page.tsx`
- **Purpose:** Manage property staff with login capabilities (team members who have system access)
- **Scope:** Limited to staff with email + permissions (unlike general staff management)

### Firebase Services Used

#### A. Firebase Authentication (`firebase/auth`)
- Creates new users with email + password via `getAuth().createUser()`
- Deletes users from Auth via `getAuth().deleteUser()`
- Users identified by Firebase Auth UID

#### B. Firestore Database
- **Collection:** `staff` (located at `/staff/{uid}`)
- **Query:** Filters by `propertyId` to get property's team members
- **Real-time listening:** `onSnapshot()` for live updates

#### C. Cloud Functions (Europe-west1 Region)
```typescript
// Two callable functions:
- createStaffUser(email, password, fullName, role, permissions, propertyId, phone)
  └─ Creates Firebase Auth user + Firestore document
  
- deleteStaffUser(uid)
  └─ Removes user from both Auth and Firestore
```

### Data Structure - Firestore Staff Collection

```typescript
// Key fields stored:
{
  uid: string;                    // Firebase Auth UID (document ID)
  fullName: string;               // Combined first + last name
  email: string;                  // Login email (unique)
  phone?: string;
  role: StaffRole;                // "admin" | "manager" | "frontDesk" | etc.
  permissions: Permissions;       // Module-based access control (JSONB)
  propertyId: string;             // Multi-tenant scoping
  status: "Active" | "Inactive";
  lastLogin?: string;             // Timestamp of last login
  
  // Audit fields
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;              // UID of admin who created user
}
```

### Permission Model - Type Definition
```typescript
type Permissions = Record<AppModuleKey, boolean>;

// Supported modules:
- rooms
- reservations
- ratePlans
- guests
- finance
- availability
- reports
- settings
- staffManagement       // Can manage other staff
- housekeeping
- extras
- teamWorkspace       // Tasks + messages
```

### Components & Features

#### Staff Form Component (`staff-form.tsx`)
- **Fields:** First name, last name, email, phone, role, status, permissions
- **Actions:** 
  - Create: requires password (with optional generation)
  - Update: edit all fields except role (can't edit own role)
  - Password reset: placeholder only (not implemented)

#### Staff List Component (`staff-list.tsx`)
- **Display:** Table with columns: name, email, role, status, last login
- **Actions:** Edit, view profile, toggle status, delete, reset password
- **Permissions:** Only shows if user has `staffManagement` permission

#### Staff Profile Modal
- **Read-only view** of staff member details
- Shows all assigned permissions as a list

#### Delete Dialog & Confirmation
- Prevents admin from deleting own account
- Calls `deleteStaffUser` cloud function

### Current CRUD Operations

#### CREATE
1. Admin opens form (add new user)
2. Admin fills: email, password, full name, role, permissions
3. Form calls `createStaffUser` cloud function
4. Function creates Firebase Auth user + Firestore document
5. Real-time listener updates UI

#### READ
- `onSnapshot()` query on `staff` collection filtered by `propertyId`
- Fetches all team members with live updates
- Displays in table format

#### UPDATE
- Calls `updateDoc()` on Firestore directly
- Updates all editable fields (not auth password)
- Updates `updatedAt` timestamp

#### DELETE
- Calls `deleteStaffUser` cloud function
- Deletes from Firebase Auth first
- Then deletes Firestore document

---

## 2. EXISTING SUPABASE INFRASTRUCTURE

### Users Table (Current)
```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,                    -- Supabase Auth UID
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'manager',
  property_id UUID REFERENCES properties(id),
  phone VARCHAR(20),
  country, city, address,
  preferred_language VARCHAR(10),
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Current Status
- **Users table exists** but is **generic** (accommodates app users, property owners, managers)
- **Not designed specifically for team/staff management**
- **No role hierarchy** (single "role" field vs. multi-module permissions)
- **No audit fields** (createdBy, lastLogin tracking)
- **Already referenced** by API endpoints like meal-plans, packages

### Migration Status
- Meals, packages, rooms, other modules use Supabase
- **Staff/users module is NOT migrated** - still 100% Firebase
- No team-related RLS (Row Level Security) policies yet

---

## 3. REQUIRED SUPABASE INFRASTRUCTURE

### New Table: `team_members` (Recommended)
```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY,                         -- Supabase Auth UID
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  
  role VARCHAR(50) NOT NULL,                  -- "admin" | "manager" | etc.
  permissions JSONB NOT NULL DEFAULT '{}',   -- Module-based access control
  status VARCHAR(50) DEFAULT 'Active',        -- "Active" | "Inactive"
  
  -- Audit & activity tracking
  last_login TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(property_id, email),
  CHECK (status IN ('Active', 'Inactive')),
  CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);
```

### Alternative: Extend Existing `users` Table
If keeping a single users table:
- Add `is_team_member BOOLEAN DEFAULT FALSE`
- Add `team_role VARCHAR(50)` separate from generic `role`
- Add permissions, last_login, created_by
- Update RLS policies to handle both user types

### Required Indexes
```sql
CREATE INDEX idx_team_members_property_id ON team_members(property_id);
CREATE INDEX idx_team_members_email ON team_members(email);
CREATE INDEX idx_team_members_status ON team_members(status);
```

### RLS (Row Level Security) Policies Needed
```sql
-- Property owners can manage their team
CREATE POLICY team_members_read ON team_members
  FOR SELECT USING (
    property_id IN (
      SELECT id FROM properties 
      WHERE owner_id = auth.uid()
    )
  );

-- Team members can be created/updated by property owners
CREATE POLICY team_members_manage ON team_members
  FOR ALL USING (
    property_id IN (
      SELECT id FROM properties 
      WHERE owner_id = auth.uid()
    )
  );
```

---

## 4. NEW API ENDPOINTS REQUIRED

### Pattern: Following Existing CRUD Endpoints

The system already has a pattern for CRUD operations:
- `/api/meal-plans/crud` - POST for create/update/delete
- `/api/packages/crud` - POST for create/update/delete
- `/api/rooms/crud` - POST for create/update/delete

### New Endpoints for Team Members

#### `POST /api/team-members/crud`
**Actions:**
- `create` - Add new team member (calls Supabase Auth + inserts record)
- `update` - Modify team member
- `delete` - Remove team member (delete from Auth + DB)

**Request Body:**
```json
{
  "action": "create|update|delete",
  "propertyId": "uuid",
  "id": "uuid (for update/delete)",
  "email": "user@example.com",
  "password": "hashedpass (for create only)",
  "fullName": "John Doe",
  "phone": "+1234567890",
  "role": "manager",
  "permissions": { "rooms": true, "reservations": true, ... },
  "status": "Active"
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "fullName": "John Doe",
  "role": "manager",
  "permissions": {...},
  "status": "Active",
  "created_at": "2024-04-10T00:00:00Z",
  "updated_at": "2024-04-10T00:00:00Z"
}
```

#### `GET /api/team-members/list`
**Query Params:**
- `propertyId` - Required for filtering

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "manager",
    "status": "Active",
    "lastLogin": "2024-04-09T...",
    "permissions": {...}
  }
]
```

---

## 5. FRONTEND CHANGES NEEDED

### No component changes required initially
The existing components can work with Supabase if the API is compatible:

- **`staff-form.tsx`** - Already structured to pass generic data objects
- **`staff-list.tsx`** - Expects generic staff array
- **`staff-profile-modal.tsx`** - Uses passed data, no backend integration

### Changes in `page.tsx` (/property-settings/team/users/)

```typescript
// CURRENT: Firebase Firestore query
const q = query(staffColRef, where("propertyId", "==", currentUserPropertyId));
const unsubscribe = onSnapshot(q, ...);

// NEW: Supabase API call
const [staffMembers, setStaffMembers] = useState([]);

useEffect(() => {
  const fetchTeamMembers = async () => {
    const response = await fetch(
      `/api/team-members/list?propertyId=${propertyId}`
    );
    const data = await response.json();
    setStaffMembers(data);
  };
  
  fetchTeamMembers();
  // Could add polling or WebSocket for real-time updates
}, [propertyId]);
```

### Handle Form Save Changes
```typescript
// CURRENT: Cloud function call
const createStaffUser = httpsCallable(functions, 'createStaffUser');

// NEW: API call
const response = await fetch('/api/team-members/crud', {
  method: 'POST',
  body: JSON.stringify({
    action: 'create',
    propertyId: currentUserPropertyId,
    email: formData.email,
    password: formData.password,
    fullName: formData.fullName,
    ...
  })
});
```

### Real-time Updates
- **Current:** Firebase's `onSnapshot()` provides live updates
- **Options for migration:**
  1. **Polling:** Fetch every 5-10 seconds
  2. **WebSocket:** Supabase Realtime (if enabled)
  3. **Optimistic UI:** Update UI immediately, sync in background

---

## 6. DATA STRUCTURE & SCHEMA DIFFERENCES

### Firebase vs Supabase Comparison

| Aspect | Firebase | Supabase |
|--------|----------|----------|
| **Auth** | Firebase Auth (managed) | Supabase Auth (PostgreSQL based) |
| **Storage** | Firestore Document | PostgreSQL row |
| **Permissions** | Cloud Functions check | RLS Policies + Application code |
| **Real-time** | SDK listeners | WebSocket + Polling |
| **Transactions** | Document-level atomic | PostgreSQL ACID |
| **User ID** | Firebase UID (string) | UUID (standard) |
| **Permissions field** | Nested JSONB object | JSONB column |
| **Audit trail** | Manual fields | Timestamps + created_by |

### Type Definitions - No Changes Needed
The existing TypeScript types can remain:
```typescript
// These work for both Firebase and Supabase
interface AuthStaffMember extends StaffMember {
  id: string;
  email: string;
  permissions: Permissions;
  lastLogin?: string;
}

type Permissions = Record<AppModuleKey, boolean>;
```

---

## 7. MIGRATION ROADMAP

### Phase 1: Backend Infrastructure (2-3 hours)
- [x] Create Firestore analysis (done)
- [ ] Create `team_members` table in Supabase
- [ ] Add indexes for performance
- [ ] Configure RLS policies
- [ ] Set up Supabase Auth integration

### Phase 2: API Implementation (3-4 hours)
- [ ] Create `/api/team-members/crud` endpoint
- [ ] Create `/api/team-members/list` endpoint
- [ ] Implement create logic (Auth + DB insert)
- [ ] Implement update logic
- [ ] Implement delete logic (Auth + DB cascade)
- [ ] Add error handling + validation

### Phase 3: Frontend Migration (2-3 hours)
- [ ] Update page.tsx to use new API
- [ ] Replace `onSnapshot` with API calls
- [ ] Replace cloud function calls with API calls
- [ ] Test create/read/update/delete flows
- [ ] Implement error handling

### Phase 4: Testing & Validation (2 hours)
- [ ] Migrate test data from Firebase
- [ ] Verify permissions still work
- [ ] Test role-based access
- [ ] Verify audit fields (created_by, timestamps)
- [ ] Test edge cases (self-deletion, role restrictions)

### Phase 5: Production Cutover (1 hour)
- [ ] Backup Firebase staff collection
- [ ] Migrate live data using migration script
- [ ] Verify data integrity
- [ ] Switch frontend traffic to new API
- [ ] Monitor errors in production

---

## 8. RISKS & CONSIDERATIONS

### Authentication Risks
- **Firebase Auth vs Supabase Auth:** Need to handle user creation via Supabase Auth instead of Firebase
- **Password Management:** Supabase handles hashing; no need to pass hashed passwords
- **Email Verification:** May want to add email verification flow

### Data Consistency
- **Permissions JSONB:** Must ensure format matches exactly between systems
- **Role validation:** Some roles may only be available to admins

### Real-time Requirement
- If real-time is critical, must implement WebSocket or polling
- Supabase Realtime may have performance implications with large teams

### Tenant Isolation
- Must verify RLS policies correctly isolate team members by property
- Cross-property access should be impossible

---

## 9. REFERENCE FILES & COMPONENTS

### Key Files
- **Page:** `src/app/(app)/property-settings/team/users/page.tsx`
- **Components:** 
  - `src/components/staff/staff-form.tsx`
  - `src/components/staff/staff-list.tsx`
  - `src/components/staff/staff-profile-modal.tsx`
- **Types:** `src/types/staff.ts`, `src/types/firestoreUser.ts`
- **Cloud Functions:** `functions/source/staff/createStaffUser.ts`, `deleteStaffUser.ts`
- **Supabase Utils:** `src/utils/supabase/client.ts`, `src/utils/supabase/server.ts`

### API Endpoint Examples (Already Migrated)
- `/api/meal-plans/crud` - Good pattern for team-members endpoint
- `/api/packages/crud` - Another reference implementation
- Both use Supabase client with `createClient()`

---

## 10. IMPLEMENTATION CHECKLIST

### Database Layer
- [ ] Create `team_members` table
- [ ] Add indexes
- [ ] Configure RLS policies
- [ ] Test table structure

### API Layer
- [ ] Create `POST /api/team-members/crud` endpoint
- [ ] Create `GET /api/team-members/list` endpoint  
- [ ] Implement Supabase Auth integration for user creation
- [ ] Add validation & error handling
- [ ] Test all CRUD operations

### Frontend Layer
- [ ] Update page.tsx to call new API instead of Firebase
- [ ] Replace `onSnapshot` pattern
- [ ] Update form save handler
- [ ] Update delete handler
- [ ] Add error toast notifications
- [ ] Test create/read/update/delete UI flows

### Testing
- [ ] Unit test API endpoints
- [ ] Integration test create/delete with Auth
- [ ] Test permission checks
- [ ] Test error cases (duplicate email, invalid role, etc.)
- [ ] Verify audit fields populate correctly

### Documentation
- [ ] Update API documentation
- [ ] Document RLS policies
- [ ] Add code comments for complex flows
- [ ] Update team onboarding docs

---

## Summary Matrix

| Component | Current | Required |
|-----------|---------|----------|
| **Storage** | Firestore `staff` | Supabase `team_members` |
| **Auth** | Firebase Auth | Supabase Auth (same user) |
| **CRUD** | Cloud Functions | REST API Endpoints |
| **Real-time** | `onSnapshot()` | Polling / WebSocket |
| **Permissions** | Firestore + Code | RLS Policies + Code |
| **UI Components** | **No change needed** | Can reuse existing |
| **Type Definitions** | **No change needed** | Can reuse existing |

---

## Next Steps

1. **Review this analysis** with the team
2. **Create Supabase migration task** in your project tracker
3. **Build `team_members` table** in Supabase dev environment
4. **Start Phase 2** (API implementation) once DB is ready
5. **Coordinate** with team to avoid conflicts during migration
