import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Used in Server Components/pages. Reads the session cookie set by the
// browser client, so RLS-scoped queries (e.g. "only this resident's leases")
// run as the actual logged-in user instead of anonymous.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component without write access; the
            // middleware below handles refreshing the session instead.
          }
        },
      },
    }
  );
}
