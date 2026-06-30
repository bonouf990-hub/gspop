import { createBrowserClient } from "@supabase/ssr";

// Used in Client Components (e.g. the login form). Stores the session in
// cookies (not localStorage), so the server client below can read the same
// session on the next request.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
