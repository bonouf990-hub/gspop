import { createSupabaseClient } from "@gspop/shared";

// Same Supabase backend as the ops console and mobile app — RLS enforces that
// a resident only ever sees their own data. This app's bundle just never
// ships any ops/admin UI code, keeping it small and fast for tenants.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
