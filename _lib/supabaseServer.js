import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Server-side Supabase keys are missing. Check environment variables.');
}

// Service role client - bypasses RLS for server-side operations
export const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '', {
  auth: { persistSession: false }
});

// Helper to get authenticated user from request Authorization header
export async function getAuthUser(req) {
  const authHeader = req.headers.authorization || req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}
