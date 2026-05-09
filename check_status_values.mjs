import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vznivmdixuglalgjedji.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bml2bWRpeHVnbGFsZ2plZGppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4ODk4NywiZXhwIjoyMDg5MTY0OTg3fQ.9SJwP-_bB-o5e23UXx7pRHWIWxr4FshQ99hUvP6j-EE'
);

const { data, error } = await supabase
  .from('availability_calendar')
  .select('status')
  .eq('property_id', 'kyhZam7bFa3RdE2ygV4B')
  .limit(5);

console.log('Status values found:');
if (error) {
  console.error('Error:', error);
} else {
  const uniqueStatuses = new Set(data.map(r => r.status));
  uniqueStatuses.forEach(s => console.log(`  - "${s}"`));
}

// Also check records with min_nights
const { data: minRecords } = await supabase
  .from('availability_calendar')
  .select('status, min_nights')
  .eq('property_id', 'kyhZam7bFa3RdE2ygV4B')
  .not('min_nights', 'is', null)
  .limit(5);

console.log('\nRecords WITH min_nights:');
minRecords.forEach(r => {
  console.log(`  status: "${r.status}", min_nights: ${r.min_nights}`);
});
