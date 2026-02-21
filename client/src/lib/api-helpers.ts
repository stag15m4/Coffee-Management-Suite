import { supabase } from './supabase-queries';

/**
 * Get auth headers for Express API calls.
 * Sends the Supabase JWT as a standard Authorization Bearer token.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}
