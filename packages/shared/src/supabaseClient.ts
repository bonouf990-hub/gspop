import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  // Falls back to placeholder values so the client can be constructed at module load
  // time (e.g. during a build with no env vars yet) without throwing. Real calls will
  // fail clearly once made against the placeholder host.
  return createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder-anon-key", {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}
