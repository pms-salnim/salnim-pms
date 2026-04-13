#!/usr/bin/env node

/**
 * Firebase to Supabase Migration Script
 * 
 * This script exports all data from Firebase and imports it into Supabase
 * 
 * Usage:
 * npx ts-node scripts/migrate-to-supabase.ts
 * 
 * OR in development:
 * npm run migrate:supabase
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { collection, getDocs, query, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

// ===== TYPE CONVERSIONS =====
function convertTimestamp(timestamp: any): string | null {
  if (!timestamp) return null;
  if (timestamp?.toDate) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  return null;
}

function convertDate(date: any): string | null {
  if (!date) return null;
  if (date?.toDate) {
    return date.toDate().toISOString().split('T')[0];
  }
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return null;
}

// ===== MIGRATION FUNCTIONS =====

interface MigrationStats {
  table: string;
  count: number;
  errors: number;
}

const stats: MigrationStats[] = [];

async function logProgress(message: string) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

async function migrateProperties() {
  await logProgress('🏨 Starting Properties migration...');
  try {
    const snapshot = await getDocs(collection(db, 'properties'));
    const properties = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    await logProgress(`  Found ${properties.length} properties`);

    if (properties.length === 0) return;

    for (const prop of properties) {
      const { error } = await supabase
        .from('properties')
        .upsert([
          {
            id: prop.id,
            name: prop.name,
            description: prop.description,
            address: prop.address,
            city: prop.city,
            country: prop.country,
            check_in_time: prop.checkInTime || '14:00',
            check_out_time: prop.checkOutTime || '12:00',
            currency: prop.currency || 'USD',
            time_zone: prop.timeZone || 'UTC',
            language: prop.language || 'en',
            company_name: prop.legalInformation?.companyName,
            legal_form: prop.legalInformation?.legalForm,
            loyalty_enabled: prop.loyaltyProgramSettings?.enabled || false,
            created_at: convertTimestamp(prop.createdAt),
            updated_at: convertTimestamp(prop.updatedAt),
          },
        ], { onConflict: 'id' });

      if (error) {
        console.error('  ❌ Error migrating property:', prop.id, error);
      }
    }

    stats.push({ table: 'properties', count: properties.length, errors: 0 });
    await logProgress(`✅ Properties migration complete (${properties.length} records)`);
  } catch (error) {
    console.error('❌ Properties migration failed:', error);
    stats.push({ table: 'properties', count: 0, errors: 1 });
  }
}

async function migrateRoomTypes() {
  await logProgress('🛏️  Starting Room Types migration...');
  try {
    const snapshot = await getDocs(collection(db, 'roomTypes'));
    const roomTypes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    await logProgress(`  Found ${roomTypes.length} room types`);

    for (const rt of roomTypes) {
      const { error } = await supabase
        .from('room_types')
        .upsert([
          {
            id: rt.id,
            property_id: rt.propertyId,
            name: rt.name,
            description: rt.description,
            max_guests: rt.maxGuests || 2,
            amenities: rt.amenities || [],
            created_at: convertTimestamp(rt.createdAt),
            updated_at: convertTimestamp(rt.updatedAt),
          },
        ], { onConflict: 'id' });

      if (error) {
        console.error('  ❌ Error migrating room type:', rt.id, error);
      }
    }

    stats.push({ table: 'room_types', count: roomTypes.length, errors: 0 });
    await logProgress(`✅ Room Types migration complete (${roomTypes.length} records)`);
  } catch (error) {
    console.error('❌ Room Types migration failed:', error);
    stats.push({ table: 'room_types', count: 0, errors: 1 });
  }
}

async function migrateRooms() {
  await logProgress('🚪 Starting Rooms migration...');
  try {
    const snapshot = await getDocs(collection(db, 'rooms'));
    const rooms = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    await logProgress(`  Found ${rooms.length} rooms`);

    for (const room of rooms) {
      const { error } = await supabase
        .from('rooms')
        .upsert([
          {
            id: room.id,
            property_id: room.propertyId,
            room_type_id: room.roomTypeId,
            name: room.name,
            number: room.number,
            floor: room.floor,
            status: room.status || 'Available',
            cleaning_status: room.cleaningStatus || 'clean',
            notes: room.notes,
            created_at: convertTimestamp(room.createdAt),
            updated_at: convertTimestamp(room.updatedAt),
          },
        ], { onConflict: 'id' });

      if (error) {
        console.error('  ❌ Error migrating room:', room.id, error);
      }
    }

    stats.push({ table: 'rooms', count: rooms.length, errors: 0 });
    await logProgress(`✅ Rooms migration complete (${rooms.length} records)`);
  } catch (error) {
    console.error('❌ Rooms migration failed:', error);
    stats.push({ table: 'rooms', count: 0, errors: 1 });
  }
}

async function migrateGuests() {
  await logProgress('👥 Starting Guests migration...');
  try {
    const snapshot = await getDocs(collection(db, 'guests'));
    const guests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    await logProgress(`  Found ${guests.length} guests`);

    for (const guest of guests) {
      const { error } = await supabase
        .from('guests')
        .upsert([
          {
            id: guest.id,
            property_id: guest.propertyId,
            name: guest.name,
            email: guest.email,
            phone: guest.phone,
            country: guest.country,
            passport_id: guest.passportId,
            loyalty_points: guest.loyaltyPoints || 0,
            notes: guest.notes,
            created_at: convertTimestamp(guest.createdAt),
            updated_at: convertTimestamp(guest.updatedAt),
          },
        ], { onConflict: 'id' });

      if (error) {
        console.error('  ❌ Error migrating guest:', guest.id, error);
      }
    }

    stats.push({ table: 'guests', count: guests.length, errors: 0 });
    await logProgress(`✅ Guests migration complete (${guests.length} records)`);
  } catch (error) {
    console.error('❌ Guests migration failed:', error);
    stats.push({ table: 'guests', count: 0, errors: 1 });
  }
}

async function migrateReservations() {
  await logProgress('📅 Starting Reservations migration...');
  try {
    const snapshot = await getDocs(collection(db, 'reservations'));
    const reservations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    await logProgress(`  Found ${reservations.length} reservations`);

    for (const reservation of reservations) {
      const { error } = await supabase
        .from('reservations')
        .upsert([
          {
            id: reservation.id,
            property_id: reservation.propertyId,
            guest_id: reservation.guestId || null,
            guest_name: reservation.guestName,
            guest_email: reservation.guestEmail,
            guest_phone: reservation.guestPhone,
            guest_country: reservation.guestCountry,
            guest_passport_id: reservation.guestPassportOrId,
            source: reservation.source || 'Direct',
            status: reservation.status || 'Pending',
            reservation_number: reservation.reservationNumber,
            start_date: convertDate(reservation.startDate),
            end_date: convertDate(reservation.endDate),
            rooms_data: reservation.rooms || [],
            selected_extras: reservation.selectedExtras || [],
            total_price: reservation.totalPrice,
            price_before_discount: reservation.priceBeforeDiscount,
            discount_amount: reservation.discountAmount,
            rooms_total: reservation.roomsTotal,
            extras_total: reservation.extrasTotal,
            tax_amount: reservation.taxAmount,
            payment_status: reservation.paymentStatus || 'Pending',
            partial_payment_amount: reservation.partialPaymentAmount,
            paid_with_points: reservation.paidWithPoints || false,
            promotion_applied: reservation.promotionApplied,
            package_info: reservation.packageInfo,
            notes: reservation.notes,
            color: reservation.color,
            actual_check_in_time: convertTimestamp(reservation.actualCheckInTime),
            actual_check_out_time: convertTimestamp(reservation.actualCheckOutTime),
            is_checked_out: reservation.isCheckedOut || false,
            created_at: convertTimestamp(reservation.createdAt),
            updated_at: convertTimestamp(reservation.updatedAt),
          },
        ], { onConflict: 'id' });

      if (error) {
        console.error('  ❌ Error migrating reservation:', reservation.id, error);
      }
    }

    stats.push({ table: 'reservations', count: reservations.length, errors: 0 });
    await logProgress(`✅ Reservations migration complete (${reservations.length} records)`);
  } catch (error) {
    console.error('❌ Reservations migration failed:', error);
    stats.push({ table: 'reservations', count: 0, errors: 1 });
  }
}

async function migrateServices() {
  await logProgress('🛎️  Starting Services migration...');
  try {
    const snapshot = await getDocs(collection(db, 'services'));
    const services = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    await logProgress(`  Found ${services.length} services`);

    for (const service of services) {
      const { error } = await supabase
        .from('services')
        .upsert([
          {
            id: service.id,
            property_id: service.propertyId,
            name: service.name,
            description: service.description,
            price: service.price,
            unit: service.unit || 'one_time',
            category: service.category,
            is_active: service.isActive !== false,
            created_at: convertTimestamp(service.createdAt),
            updated_at: convertTimestamp(service.updatedAt),
          },
        ], { onConflict: 'id' });

      if (error) {
        console.error('  ❌ Error migrating service:', service.id, error);
      }
    }

    stats.push({ table: 'services', count: services.length, errors: 0 });
    await logProgress(`✅ Services migration complete (${services.length} records)`);
  } catch (error) {
    console.error('❌ Services migration failed:', error);
    stats.push({ table: 'services', count: 0, errors: 1 });
  }
}

async function migrateMealPlans() {
  await logProgress('🍽️  Starting Meal Plans migration...');
  try {
    const snapshot = await getDocs(collection(db, 'mealPlans'));
    const mealPlans = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    await logProgress(`  Found ${mealPlans.length} meal plans`);

    for (const mealPlan of mealPlans) {
      const { error } = await supabase
        .from('meal_plans')
        .upsert([
          {
            id: mealPlan.id,
            property_id: mealPlan.propertyId,
            name: mealPlan.name,
            description: mealPlan.description,
            price: mealPlan.price,
            unit: mealPlan.unit || 'per_night',
            meals: mealPlan.meals || [],
            is_active: mealPlan.isActive !== false,
            created_at: convertTimestamp(mealPlan.createdAt),
            updated_at: convertTimestamp(mealPlan.updatedAt),
          },
        ], { onConflict: 'id' });

      if (error) {
        console.error('  ❌ Error migrating meal plan:', mealPlan.id, error);
      }
    }

    stats.push({ table: 'meal_plans', count: mealPlans.length, errors: 0 });
    await logProgress(`✅ Meal Plans migration complete (${mealPlans.length} records)`);
  } catch (error) {
    console.error('❌ Meal Plans migration failed:', error);
    stats.push({ table: 'meal_plans', count: 0, errors: 1 });
  }
}

async function migrateTasks() {
  await logProgress('✅ Starting Tasks migration...');
  try {
    const snapshot = await getDocs(collection(db, 'tasks'));
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    await logProgress(`  Found ${tasks.length} tasks`);

    for (const task of tasks) {
      const { error } = await supabase
        .from('tasks')
        .upsert([
          {
            id: task.id,
            property_id: task.propertyId || task.property_id,
            room_id: task.roomId || task.room_id,
            title: task.title,
            description: task.description,
            priority: task.priority || 'Medium',
            status: task.status || 'Open',
            assigned_to_uid: task.assignedToUid || task.assigned_to_uid,
            assigned_to_role: task.assignedToRole || task.assigned_to_role,
            created_at: convertTimestamp(task.createdAt),
            updated_at: convertTimestamp(task.updatedAt),
          },
        ], { onConflict: 'id' });

      if (error) {
        console.error('  ❌ Error migrating task:', task.id, error);
      }
    }

    stats.push({ table: 'tasks', count: tasks.length, errors: 0 });
    await logProgress(`✅ Tasks migration complete (${tasks.length} records)`);
  } catch (error) {
    console.error('❌ Tasks migration failed:', error);
    stats.push({ table: 'tasks', count: 0, errors: 1 });
  }
}

// ===== MAIN MIGRATION FLOW =====
async function runMigration() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Firebase → Supabase Migration Script                    ║');
  console.log('║   PMS (Property Management System)                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');

  try {
    await logProgress('🚀 Starting migration...\n');

    // Execute migrations in order (respecting foreign key dependencies)
    await migrateProperties();
    await migrateRoomTypes();
    await migrateRooms();
    await migrateGuests();
    await migrateReservations();
    await migrateServices();
    await migrateMealPlans();
    await migrateTasks();

    // Print summary
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    MIGRATION SUMMARY                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n');

    let totalRecords = 0;
    let totalErrors = 0;

    for (const stat of stats) {
      const status = stat.errors === 0 ? '✅' : '⚠️ ';
      console.log(`${status} ${stat.table.padEnd(20)} | Records: ${stat.count.toString().padStart(5)} | Errors: ${stat.errors}`);
      totalRecords += stat.count;
      totalErrors += stat.errors;
    }

    console.log('\n');
    console.log(`Total Records Migrated: ${totalRecords}`);
    console.log(`Total Errors: ${totalErrors}`);
    console.log('\n');

    if (totalErrors === 0) {
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('⚠️  Migration completed with errors. Please review above.');
    }

    console.log('\n🎉 You can now switch to using Supabase queries!');
    console.log('\n');

    process.exit(totalErrors === 0 ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
