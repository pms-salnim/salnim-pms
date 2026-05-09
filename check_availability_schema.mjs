import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vznivmdixuglalgjedji.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bml2bWRpeHVnbGFsZ2plZGppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDI1OTk2NzksImV4cCI6MjAxODE5NTY3OX0.4H0VGfXQRe2kLKJFf1HKqvUhbG1QgmvVnuSVIZXjfSo'
);

const { data, error } = await supabase
  .from('availability_calendar')
  .select('*')
  .eq('property_id', 'kyhZam7bFa3RdE2ygV4B')
  .limit(1);

if (error) {
  console.error('Error:', error);
} else {
  console.log('✓ Sample row from availability_calendar:');
  if (data && data.length > 0) {
    const row = data[0];
    console.log('Columns:', Object.keys(row).sort());
    console.log('Sample data:', JSON.stringify(row, null, 2));
  } else {
    console.log('No data found');
  }
}

// Also check for records with min_nights or max_nights
const { data: minMaxData, error: err2 } = await supabase
  .from('availability_calendar')
  .select('*')
  .eq('property_id', 'kyhZam7bFa3RdE2ygV4B')
  .not('min_nights', 'is', null)
  .limit(5);

if (!err2 && minMaxData && minMaxData.length > 0) {
  console.log('\n✓ Records WITH min_nights/max_nights:');
  minMaxData.forEach(r => {
    console.log(`  date: ${r.date}, room_type_id: ${r.room_type_id}, room_id: ${r.room_id}, min_nights: ${r.min_nights}, max_nights: ${r.max_nights}`);
  });
}
