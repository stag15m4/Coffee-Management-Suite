import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for storage features');
  }
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseServiceKey);
  }
  return cachedClient;
}
