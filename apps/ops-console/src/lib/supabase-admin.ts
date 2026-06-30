import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY. Uses the service_role key, which bypasses RLS entirely.
// Never import this from a Client Component or expose the key with a
// NEXT_PUBLIC_ prefix — it must only ever run inside API routes / Server
// Components on the server, where SUPABASE_SERVICE_ROLE_KEY is set as a
// secret Vercel environment variable.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
