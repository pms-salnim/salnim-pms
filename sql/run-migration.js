#!/usr/bin/env node

/**
 * Migration script to add property infos columns to Supabase
 * Run with: npx node sql/run-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKeyServiceRole = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKeyServiceRole) {
    console.error('Error: Missing Supabase environment variables');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Initialize Supabase admin client
  const supabase = createClient(supabaseUrl, supabaseKeyServiceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log('🔄 Starting migration: Adding property infos columns...\n');

    // List of columns to add with their definitions
    const columnsToAdd = [
      { name: 'type', def: "type VARCHAR(100)" },
      { name: 'tagline', def: "tagline TEXT" },
      { name: 'year_established', def: "year_established INT" },
      { name: 'logo_url', def: "logo_url TEXT" },
      { name: 'star_rating', def: "star_rating DECIMAL(3, 1)" },
      { name: 'jurisdiction', def: "jurisdiction VARCHAR(100)" },
      { name: 'state_province', def: "state_province VARCHAR(100)" },
      { name: 'postal_code', def: "postal_code VARCHAR(20)" },
      { name: 'google_maps_link', def: "google_maps_link TEXT" },
      { name: 'legal_business_name', def: "legal_business_name VARCHAR(255)" },
      { name: 'property_style', def: "property_style VARCHAR(100)" },
      { name: 'total_rooms', def: "total_rooms INT" },
      { name: 'max_guest_capacity', def: "max_guest_capacity INT" },
      { name: 'property_size_square_feet', def: "property_size_square_feet INT" },
      { name: 'number_floors', def: "number_floors INT" },
      { name: 'number_buildings', def: "number_buildings INT" },
      { name: 'european_company_reg_number', def: "european_company_reg_number VARCHAR(100)" },
      { name: 'european_vat_number', def: "european_vat_number VARCHAR(100)" },
      { name: 'european_trade_reg_entry', def: "european_trade_reg_entry VARCHAR(100)" },
      { name: 'european_chamber_registration', def: "european_chamber_registration VARCHAR(100)" },
      { name: 'european_tax_registration', def: "european_tax_registration VARCHAR(100)" },
      { name: 'moroccan_legal_company_form', def: "moroccan_legal_company_form VARCHAR(100)" },
      { name: 'moroccan_rc', def: "moroccan_rc VARCHAR(100)" },
      { name: 'moroccan_if', def: "moroccan_if VARCHAR(100)" },
      { name: 'moroccan_ice', def: "moroccan_ice VARCHAR(100)" },
      { name: 'moroccan_cnss', def: "moroccan_cnss VARCHAR(100)" },
      { name: 'moroccan_patent_number', def: "moroccan_patent_number VARCHAR(100)" },
      { name: 'usa_ein', def: "usa_ein VARCHAR(100)" },
      { name: 'usa_state_license_number', def: "usa_state_license_number VARCHAR(100)" },
      { name: 'usa_secretary_of_state_number', def: "usa_secretary_of_state_number VARCHAR(100)" },
      { name: 'usa_federal_tax_id', def: "usa_federal_tax_id VARCHAR(100)" },
    ];

    // Build the migration SQL
    let migrationSQL = 'ALTER TABLE IF EXISTS properties\n';
    const columnDefs = columnsToAdd.map(col => `ADD COLUMN IF NOT EXISTS ${col.def}`).join(',\n');
    migrationSQL += columnDefs + ';';

    console.log('📋 Executing migration SQL:\n');
    console.log(migrationSQL);
    console.log('\n');

    // Execute the migration using the Supabase client
    const { error } = await supabase.rpc('exec', {
      sql: migrationSQL,
    }).catch(async () => {
      // Fallback: Try direct SQL execution if rpc doesn't work
      // Note: This requires the PostgREST API to support direct SQL
      console.log('⚠️  RPC method not available, attempting direct approach...\n');
      
      // We'll need to execute this in the Supabase SQL editor manually
      return { error: 'Please run the migration SQL manually in Supabase SQL editor' };
    });

    if (error) {
      throw new Error(error.message || String(error));
    }

    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Added columns:');
    columnsToAdd.forEach(col => console.log(`   ✓ ${col.name}`));
    console.log('\n✨ Property infos table is now ready for use!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n📝 Manual Migration Instructions:');
    console.log('1. Go to Supabase Dashboard: https://app.supabase.com');
    console.log('2. Open your project and go to SQL Editor');
    console.log('3. Open the file: sql/migration-add-property-infos.sql');
    console.log('4. Copy and paste the SQL content');
    console.log('5. Execute all statements\n');
    process.exit(1);
  }
}

runMigration();
