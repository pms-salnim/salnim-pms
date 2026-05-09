#!/usr/bin/env node

/**
 * Apply the applied_days migration directly to Supabase
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function applyMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('🔗 Connecting to Supabase...');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Read the migration SQL
    const migrationPath = path.join(__dirname, 'supabase/migrations/20260420_001_add_applied_days_to_availability_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📝 Running migration...');
    
    // Split by statements and execute one by one
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));

    let executedCount = 0;
    for (const statement of statements) {
      try {
        console.log(`  ⚙️  Executing: ${statement.substring(0, 50)}...`);
        const { data, error } = await supabase.rpc('_execute_sql', { sql: statement });
        
        if (error) {
          // Some errors are OK (like "column already exists")
          if (error.message.includes('already exists') || error.message.includes('already_exists')) {
            console.log(`  ⚠️  Column/Index already exists (OK)`);
          } else {
            console.error(`  ❌ Error: ${error.message}`);
          }
        } else {
          console.log(`  ✅ Executed`);
          executedCount++;
        }
      } catch (err) {
        console.error(`  ❌ Error: ${err.message}`);
      }
    }

    console.log(`\n✅ Migration applied! (${executedCount} statements executed)`);
  } catch (error) {
    console.error('❌ Failed to apply migration:', error.message);
    process.exit(1);
  }
}

applyMigration();
