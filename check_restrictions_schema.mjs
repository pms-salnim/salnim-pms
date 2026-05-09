import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vznivmdixuglalgjedji.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bml2bWRpeHVnbGFsZ2plZGppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDI1OTk2NzksImV4cCI6MjAxODE5NTY3OX0.4H0VGfXQRe2kLKJFf1HKqvUhbG1QgmvVnuSVIZXjfSo';

const supabase = createClient(supabaseUrl, supabaseKey);

// Get a single row to see schema
const { data, error } = await supabase
  .from('restrictions')
  .select('*')
  .limit(1);

if (error) {
  console.error('Error:', error);
} else {
  console.log('Sample row:', JSON.stringify(data, null, 2));
  if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  }
}
