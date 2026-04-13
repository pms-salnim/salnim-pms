# Firebase to Supabase Migration Guide

## Overview
This guide walks you through migrating all your PMS data from Firebase Firestore to Supabase PostgreSQL.

**Timeline:** ~30 minutes (depending on data size)  
**Data Size:** < 10,000 records (small dataset, safe to migrate directly)

---

## Pre-Migration Checklist

- [ ] SQL schema is already created in Supabase (from previous step)
- [ ] Environment variables are set up (.env.local has Supabase keys)
- [ ] Firebase is still running and accessible
- [ ] You have a backup of your Firebase data
- [ ] No active reservations being created during migration

---

## Step 1: Verify Your Setup

### Check Environment Variables
Make sure `.env.local` has:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_...
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Check SQL Schema in Supabase
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor** → Run a test query:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see 14-15 tables listed (properties, rooms, reservations, etc.)

---

## Step 2: Run the Migration Script

### Option A: Automatic Migration (Recommended)

```bash
# Install tsx if not already installed
npm install -g tsx

# Run the migration script
npm run migrate:supabase
```

### Option B: Manual Migration (Step by Step)

If automatic migration fails, run TypeScript directly:

```bash
tsx scripts/migrate-to-supabase.ts
```

---

## Step 3: Monitor the Migration

The script will output progress:

```
[15:30:45] 🏨 Starting Properties migration...
[15:30:45]   Found 2 properties
[15:30:46] ✅ Properties migration complete (2 records)

[15:30:46] 🛏️  Starting Room Types migration...
[15:30:46]   Found 8 room types
[15:30:47] ✅ Room Types migration complete (8 records)

[15:30:47] 🚪 Starting Rooms migration...
[15:30:47]   Found 24 rooms
[15:30:48] ✅ Rooms migration complete (24 records)

...
```

### Final Summary
```
╔════════════════════════════════════════════════════════════╗
║                    MIGRATION SUMMARY                       ║
╚════════════════════════════════════════════════════════════╝

✅ properties              | Records:     2 | Errors: 0
✅ room_types             | Records:     8 | Errors: 0
✅ rooms                  | Records:    24 | Errors: 0
✅ guests                 | Records:    15 | Errors: 0
✅ reservations           | Records:   127 | Errors: 0
✅ services               | Records:    32 | Errors: 0
✅ meal_plans             | Records:     6 | Errors: 0
✅ tasks                  | Records:   45 | Errors: 0

Total Records Migrated: 259
Total Errors: 0

✅ Migration completed successfully!
```

---

## Step 4: Verify Migration in Supabase

### Check Data Counts

Go to Supabase → **SQL Editor** and run:

```sql
-- Check row counts in each table
SELECT 
  'properties' as table_name, COUNT(*) as count FROM properties
UNION ALL SELECT 'rooms', COUNT(*) FROM rooms
UNION ALL SELECT 'reservations', COUNT(*) FROM reservations
UNION ALL SELECT 'guests', COUNT(*) FROM guests
UNION ALL SELECT 'services', COUNT(*) FROM services
UNION ALL SELECT 'meal_plans', COUNT(*) FROM meal_plans
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
ORDER BY table_name;
```

### Spot Check Data

```sql
-- Verify sample data looks correct
SELECT * FROM properties LIMIT 1;
SELECT * FROM reservations LIMIT 1;
SELECT * FROM rooms LIMIT 5;
```

### Test Queries Work

```sql
-- Calculate occupancy
SELECT date_trunc('day', now())::date as today,
  COUNT(DISTINCT id) as occupied_rooms
FROM reservations
WHERE status IN ('Confirmed', 'Checked-in')
  AND start_date <= now()::date
  AND end_date > now()::date;

-- Revenue calculation
SELECT DATE_TRUNC('month', start_date)::date as month,
  SUM(total_price) as monthly_revenue
FROM reservations
WHERE status IN ('Checked-in', 'Completed')
GROUP BY DATE_TRUNC('month', start_date)
ORDER BY month DESC;
```

---

## Step 5: Test Your Application

### Test with Sample Page

Create a test page to verify queries work:

```bash
# Create test page
cat > pages/test/supabase.tsx << 'EOF'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function TestPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: properties } = await supabase.from('properties').select()
  const { data: reservations } = await supabase.from('reservations').select()
  const { data: rooms } = await supabase.from('rooms').select()

  return (
    <div style={{ padding: '20px' }}>
      <h1>✅ Supabase Migration Test</h1>
      <ul>
        <li>Properties: {properties?.length || 0}</li>
        <li>Reservations: {reservations?.length || 0}</li>
        <li>Rooms: {rooms?.length || 0}</li>
      </ul>
    </div>
  )
}
EOF
```

Visit: `http://localhost:3000/test/supabase`

---

## Step 6: Start Using Supabase in Your App

### Update Dashboard Component

**Before (Firebase):**
```typescript
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const q = query(collection(db, 'reservations'), where('propertyId', '==', propertyId))
const snapshot = await getDocs(q)
const reservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
```

**After (Supabase):**
```typescript
import { fetchReservations } from '@/lib/supabase-queries'

const reservations = await fetchReservations(propertyId)
```

### Example: Migrate One Component

Update `src/app/(app)/dashboard/page.tsx`:

```typescript
// Add import
import { fetchReservations, fetchRooms } from '@/lib/supabase-queries'

// Replace Firebase getDocs with:
const [recentReservations, setRecentReservations] = useState<Reservation[]>([])
const [allRooms, setAllRooms] = useState<Room[]>([])

useEffect(() => {
  if (!propertyId) return
  
  // Use Supabase
  fetchReservations(propertyId).then(setRecentReservations)
  fetchRooms(propertyId).then(setAllRooms)
}, [propertyId])
```

---

## Migration Order (Optional Phased Approach)

If you want to migrate gradually instead of all-at-once:

### Phase 1: Read-Only (Week 1)
- Start reading from Supabase
- Keep writing to Firebase
- Do dual-write testing

### Phase 2: Non-Critical Writes (Week 2)
- Write rooms, guests, services to Supabase
- Keep Firebase for backup

### Phase 3: Full Migration (Week 3)
- Write all data to Supabase
- Disable Firebase writes
- Run background verification

---

## Troubleshooting

### Migration Script Fails

**Error: "Cannot connect to Firebase"**
- ✅ Ensure Firebase credentials are correct in `.env.local`
- ✅ Check internet connection
- ✅ Firebase console is accessible

**Error: "Supabase key invalid"**
- ✅ Regenerate keys from Supabase dashboard
- ✅ Update `.env.local` with new keys

**Error: "Foreign key constraint failed"**
- ✅ Migration runs in dependency order (properties → rooms → reservations)
- ✅ Check that all parent records exist before child records
- ✅ If specific table fails, run migration again

### Data Mismatch

Check row counts:
```sql
-- Firebase exports show: 127 reservations
-- Supabase shows: 125 reservations

-- Find missing records by comparing IDs:
SELECT id FROM reservations_firebase  -- hypothetical export
EXCEPT
SELECT id FROM reservations;  -- Supabase table
```

### Performance Issues Post-Migration

Add indexes (already included in schema):
```sql
-- Indexes are already created in schema.sql
-- Verify with:
SELECT * FROM pg_indexes WHERE tablename = 'reservations';
```

---

## Next Steps After Successful Migration

### 1. Update All Components to Use Supabase
- Dashboard page
- Reservations list
- Room management
- Guest profiles
- Payment tracking

### 2. Enable Real-Time Subscriptions
```typescript
import { subscribeToReservations } from '@/lib/supabase-queries'

useEffect(() => {
  const subscription = subscribeToReservations(propertyId, (payload) => {
    console.log('New reservation event:', payload)
    // Update UI
  })

  return () => subscription.unsubscribe()
}, [propertyId])
```

### 3. Disable Firebase (When Ready)
- Remove Firebase import from auth context
- Keep Firebase for authentication temporarily
- Plan auth migration to Supabase Auth

### 4. Delete Firebase Data (Optional)
- Keep backup for 30 days
- Export data before deletion
- Clear Firestore collections

---

## Backup Before Migration

### Firebase Backup
```bash
firebase firestore:export gs://your-bucket/backup-2026-04-03
```

### Supabase Backup
```bash
# Supabase handles backups automatically
# View in Dashboard → Settings → Backups
```

---

## Success Checklist

- [ ] Migration script runs without errors
- [ ] All tables have correct row counts
- [ ] Sample queries return expected data
- [ ] Test page shows all data
- [ ] Components can be updated to use new queries
- [ ] Performance is acceptable or better
- [ ] Real-time subscriptions work
- [ ] No data loss or corruption

---

## Questions?

**Check these resources:**
1. [Supabase Documentation](https://supabase.com/docs)
2. [PostgreSQL Docs](https://www.postgresql.org/docs/)
3. [Next.js Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)

---

**Estimated Time Remaining:**
- ✅ Setup: Done
- ✅ Run Migration: 5-10 min
- ⏳ Verify: 10 min
- ⏳ Update Components: 2-4 hours (spread across week)
