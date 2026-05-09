import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vznivmdixuglalgjedji.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bml2bWRpeHVnbGFsZ2plZGppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4ODk4NywiZXhwIjoyMDg5MTY0OTg3fQ.9SJwP-_bB-o5e23UXx7pRHWIWxr4FshQ99hUvP6j-EE'
);

const propertyId = 'kyhZam7bFa3RdE2ygV4B';

// Test the exact query from the page
const { data: restrictions, error: restrictionsError } = await supabase
  .from('availability_calendar')
  .select('room_type_id, min_nights, max_nights, date')
  .eq('property_id', propertyId)
  .eq('status', 'active')
  .not('room_type_id', 'is', null)
  .is('room_id', null);

console.log('✓ Query Results:');
console.log('  Error:', restrictionsError || 'None');
console.log('  Found:', restrictions?.length || 0, 'records');

if (restrictions && restrictions.length > 0) {
  console.log('\nFirst 3 records:');
  restrictions.slice(0, 3).forEach((r, i) => {
    console.log(`  [${i}] room_type_id: ${r.room_type_id?.slice(0, 8)}..., min: ${r.min_nights}, max: ${r.max_nights}, date: ${r.date}`);
  });
}
