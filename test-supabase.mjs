import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', supabaseUrl?.substring(0, 50) + '...');
console.log('Key:', supabaseServiceKey?.substring(0, 20) + '...');

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

async function testTables() {
  const tables = ['warranty_claims', 'technicians', 'qc_issues', 'projects', 'user_sessions'];
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      console.log(table + ': ' + (error ? 'ERROR - ' + error.message : 'OK') + ' (' + (data?.length || 0) + ' rows)');
    } catch (e) {
      console.log(table + ': EXCEPTION - ' + e.message);
    }
  }
}

testTables();