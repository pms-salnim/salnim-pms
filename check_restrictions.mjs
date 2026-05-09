import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vznivmdixuglalgjedji.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bml2bWRpeHVnbGFsZ2plZGppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDI1OTk2NzksImV4cCI6MjAxODE5NTY3OX0.4H0VGfXQRe2kLKJFf1HKqvUhbG1QgmvVnuSVIZXjfSo'
);

const { data, error } = await supabase
  .from('restrictions')
  .select('*')
  .eq('property_id', 'kyhZam7bFa3RdE2ygV4B')
  .eq('status', 'active');

console.log('✓ Restrictions found:', data?.length || 0);
if (data && data.length > 0) {
  console.log('Sample restrictions:');
  data.slice(0, 3).forEach(r => {
    console.log(`  - room_type_id: ${r.room_type_id}, type: ${r.restriction_type}, value: ${r.value}`);
  });
} else {
  console.log('⚠ No restrictions in database');
}
if (error) console.error('Error:', error);
