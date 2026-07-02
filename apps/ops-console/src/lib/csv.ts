// Minimal robust CSV parser — handles quoted fields, escaped quotes,
// and newlines inside quotes. Shared by every bulk importer.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

// Case-insensitive trimmed comparison key.
export const normKey = (s: string) => (s ?? "").trim().toLowerCase();

// Fetch the signed-in user's tenant id — needed to stamp rows that carry
// tenant_id directly (properties, inventory_items, …) under RLS.
import type { SupabaseClient } from "@supabase/supabase-js";
export async function currentTenantId(supabase: SupabaseClient): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data } = await supabase
    .from("user_profiles")
    .select("tenant_id")
    .eq("id", userData.user.id)
    .single();
  return (data?.tenant_id as string) ?? null;
}
