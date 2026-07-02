import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import ChecklistManager from "./ChecklistManager";

type ChecklistRow = {
  id: string;
  checklist_type: string;
  performed_by: string | null;
  created_at: string;
  performer: { full_name: string } | null;
};

type ChecklistItemRow = {
  id: string;
  move_checklist_id: string;
  item_name: string;
  condition: string;
  notes: string | null;
  photo_path: string | null;
};

export default async function ChecklistPage({ params }: { params: Promise<{ leaseId: string }> }) {
  const { leaseId } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userData.user?.id ?? "")
    .single();

  if (!profile || !["tenant_admin", "property_manager", "supervisor"].includes(profile.role)) {
    return <main className="p-8"><p className="text-[#5d6880]">Not authorized.</p></main>;
  }

  const [{ data: lease }, { data: checklists }, { data: items }] = await Promise.all([
    supabase
      .from("leases")
      .select("id, tenant_full_name, units(label, properties(name))")
      .eq("id", leaseId)
      .single(),
    supabase
      .from("move_checklists")
      .select("id, checklist_type, performed_by, created_at, performer:user_profiles!move_checklists_performed_by_fkey(full_name)")
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: false }),
    supabase
      .from("move_checklist_items")
      .select("id, move_checklist_id, item_name, condition, notes, photo_path")
      .in(
        "move_checklist_id",
        ((await supabase
          .from("move_checklists")
          .select("id")
          .eq("lease_id", leaseId)).data ?? []).map((c: { id: string }) => c.id)
      ),
  ]);

  if (!lease) {
    return <main className="p-8"><p className="text-[#5d6880]">Lease not found.</p></main>;
  }

  const unit = lease.units as unknown as { label: string; properties: { name: string } | null } | null;

  const checklistsWithItems = ((checklists ?? []) as unknown as ChecklistRow[]).map((cl) => ({
    ...cl,
    performer: cl.performer as { full_name: string } | null,
    items: ((items ?? []) as ChecklistItemRow[]).filter((i) => i.move_checklist_id === cl.id),
  }));

  return (
    <main className="p-8 max-w-3xl">
      <Link href={`/admin/residents/${leaseId}`} className="text-sm text-[#9aa5bd] hover:text-[#b01b42]">
        ← Lease Details
      </Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-1">Move Checklists</h1>
      <p className="text-[#9aa5bd] mb-6">
        {lease.tenant_full_name} · {unit?.properties?.name ? `${unit.properties.name} — ` : ""}{unit?.label ?? "—"}
      </p>

      <ChecklistManager
        leaseId={leaseId}
        userId={userData.user?.id ?? ""}
        checklists={checklistsWithItems}
      />
    </main>
  );
}
