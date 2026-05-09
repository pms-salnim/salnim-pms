import { createClient } from '@supabase/supabase-js';

// Test with service role key (bypasses RLS)
const supabaseService = createClient(
  'https://vznivmdixuglalgjedji.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bml2bWRpeHVnbGFsZ2plZGppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4ODk4NywiZXhwIjoyMDg5MTY0OTg3fQ.9SJwP-_bB-o5e23UXx7pRHWIWxr4FshQ99hUvP6j-EE'
);

// Test with anon key (affected by RLS)
const supabaseAnon = createClient(
  'https://vznivmdixuglalgjedji.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bml2bWRpeHVnbGFsZ2plZGppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODg5ODcsImV4cCI6MjA4OTE2NDk4N30.5aZFo4-TeqUOIzOwxuSA5EuSmw74KVmBDKHgVhJz8Gw'
);

const propertyId = 'kyhZam7bFa3RdE2ygV4B';

console.log('=== Testing with SERVICE ROLE KEY (bypasses RLS) ===');
const { data: srvData, error: srvError } = await supabaseService
  .from('availability_calendar')
  .select('room_type_id, min_nights, max_nights, date, status, room_id')
  .eq('property_id', propertyId)
  .eq('status', 'available')
  .not('room_type_id', 'is', null)
  .is('room_id', null);

console.log('Error:', srvError || 'None');
console.log('Found:', srvData?.length || 0, 'records');
if (srvData && srvData.length > 0) {
  srvData.forEach((r, i) => {
    console.log(`  [${i}] room_type: ${r.room_type_id?.slice(0,10)}..., min: ${r.min_nights}, max: ${r.max_nights}, status: ${r.status}`);
  });
}

console.log('\n=== Testing with ANON KEY (affected by RLS) ===');
const { data: anonData, error: anonError } = await supabaseAnon
  .from('availability_calendar')
  .select('room_type_id, min_nights, max_nights, date, status, room_id')
  .eq('property_id', propertyId)
  .eq('status', 'available')
  .not('room_type_id', 'is', null)
  .is('room_id', null);

console.log('Error:', anonError || 'None');
console.log('Found:', anonData?.length || 0, 'records');
if (anonData && anonData.length > 0) {
  anonData.forEach((r, i) => {
    console.log(`  [${i}] room_type: ${r.room_type_id?.slice(0,10)}..., min: ${r.min_nights}, max: ${r.max_nights}`);
  });
}

if (srvData?.length > 0 && anonData?.length === 0) {
  console.log('\n⚠️  RLS IS BLOCKING ACCESS - Service role can read, but anon key cannot!');
}
