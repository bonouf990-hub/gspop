import { createClient } from "@/lib/supabase-server";

// Server-side gate for GM-only pages. Returns the profile if the signed-in
// user is the owner; otherwise null (the caller should 404). This is the real
// lock — the sidebar hiding the link is only cosmetic.
export async function getOwner(): Promise<{ id: string; full_name: string } | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from("user_profiles")
    .select("id, full_name, is_owner")
    .eq("id", uid)
    .single();
  if (!data || data.is_owner !== true) return null;
  return { id: data.id as string, full_name: data.full_name as string };
}
