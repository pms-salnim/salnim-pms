import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vznivmdixuglalgjedji.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bml2bWRpeHVnbGFsZ2plZGppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4ODk4NywiZXhwIjoyMDg5MTY0OTg3fQ.9SJwP-_bB-o5e23UXx7pRHWIWxr4FshQ99hUvP6j-EE'
);

// Check availability_calendar schema
const { data: avail, error: err1 } = await supabase
  .from('availability_calendar')
  .select('*')
  .eq('property_id', 'kyhZam7bFa3RdE2ygV4B')
  .limit(1);

console.log('=== AVAILABILITY_CALENDAR ===');
if (err1) console.error('Error:', err1);
else if (avail && avail.length > 0) {
  console.log('Columns:', Object.keys(avail[0]).sort());
}

// Check restrictions table
const { data: restr, error: err2 } = await supabase
  .from('restrictions')
  .select('*')
  .limit(1);

console.log('\n=== RESTRICTIONS ===');
if (err2) console.error('Error:', err2);
else if (restr) {
  if (restr.length > 0) {
    console.log('Columns:', Object.keys(restr[0]).sort());
  } else {
    console.log('Table exists but empty');
  }
}

// Check for min_nights/max_nights data
const { data: minData, error: err3 } = await supabase
  .from('availability_calendar')
  .select('date, room_type_id, room_id, min_nights, max_nights')
  .eq('property_id', 'kyhZam7bFa3RdE2ygV4B')
  .not('min_nights', 'is', null)
  .limit(3);

console.log('\n=== RECORDS WITH min_nights/max_nights ===');
if (err3) console.error('Error:', err3);
else console.log('Found:', minData?.length || 0, 'records');
if (minData && minData.length > 0) {
  minData.forEach(r => {
    console.log(`  ${r.date} | rt: ${r.room_type_id?.slice(0, 8)}... | room: ${r.room_id ? r.room_id.slice(0, 8) + '...' : 'null'} | min: ${r.min_nights} | max: ${r.max_nights}`);
  });
}
