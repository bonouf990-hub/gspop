import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import LeaseManager from "./LeaseManager";

export default async function LeaseDetailPage({ params }: { params: Promise<{ leaseId: string }> }) {
  const { leaseId } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const { data: callerProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userData.user?.id ?? "")
    .single();
  const isAdmin = callerProfile && ["tenant_admin", "property_manager"].includes(callerProfile.role);
  if (!isAdmin) {
    return <main className="p-8"><p className="text-[#8b97ab]">Not authorized.</p></main>;
  }

  const { data: lease } = await supabase
    .from("leases")
    .select("id, tenant_full_name, status, rent_amount, rent_frequency, deposit_amount, deposit_status, start_date, end_date, units(label, properties(name))")
    .eq("id", leaseId)
    .single();

  if (!lease) {
    return <main className="p-8"><p className="text-[#8b97ab]">Lease not found.</p></main>;
  }

  const [{ data: invoices }, { data: documents }] = await Promise.all([
    supabase
      .from("rent_invoices")
      .select("id, amount, due_date, status, cheque_number, cheque_bank, cleared_at")
      .eq("lease_id", leaseId)
      .order("due_date", { ascending: true }),
    supabase
      .from("lease_documents")
      .select("id, doc_type, title, uploaded_at")
      .eq("lease_id", leaseId)
      .order("uploaded_at", { ascending: false }),
  ]);

  const unit = lease.units as unknown as { label: string; properties: { name: string } | null } | null;

  return (
    <main className="p-8 max-w-3xl">
      <Link href="/admin/residents" className="text-sm text-[#5b6b85] hover:text-[#b01b42]">← Residents</Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-1">{lease.tenant_full_name}</h1>
      <p className="text-[#5b6b85] mb-6">
        {unit?.properties?.name ? `${unit.properties.name} — ` : ""}{unit?.label ?? "—"} ·{" "}
        {lease.rent_amount != null ? `${lease.rent_amount} AED${lease.rent_frequency ? `/${lease.rent_frequency}` : ""}` : "no rent set"} ·{" "}
        deposit {lease.deposit_amount != null ? `${lease.deposit_amount} AED (${lease.deposit_status})` : "—"}
      </p>

      <div className="flex gap-3 mb-6">
        <Link
          href={`/admin/residents/${leaseId}/checklist`}
          className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#b01b42] text-[#b01b42] hover:bg-[rgba(176,27,66,0.12)]"
        >
          Move Checklists
        </Link>
        <Link
          href="/admin/residents/renewals"
          className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[rgba(176,27,66,0.15)] text-[#5b6b85] hover:bg-[rgba(176,27,66,0.12)]"
        >
          Renewal Tracker
        </Link>
      </div>

      <LeaseManager
        leaseId={leaseId}
        rentAmount={lease.rent_amount as number | null}
        invoices={(invoices ?? []) as never[]}
        documents={(documents ?? []) as never[]}
      />
    </main>
  );
}
