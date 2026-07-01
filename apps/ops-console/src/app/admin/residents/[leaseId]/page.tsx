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
    return <main className="p-8"><p className="text-gray-500">Not authorized.</p></main>;
  }

  const { data: lease } = await supabase
    .from("leases")
    .select("id, tenant_full_name, status, rent_amount, rent_frequency, deposit_amount, deposit_status, start_date, end_date, units(label, properties(name))")
    .eq("id", leaseId)
    .single();

  if (!lease) {
    return <main className="p-8"><p className="text-gray-500">Lease not found.</p></main>;
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
      <Link href="/admin/residents" className="text-sm text-gray-400 hover:text-white">← Residents</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">{lease.tenant_full_name}</h1>
      <p className="text-gray-500 mb-6">
        {unit?.properties?.name ? `${unit.properties.name} — ` : ""}{unit?.label ?? "—"} ·{" "}
        {lease.rent_amount != null ? `${lease.rent_amount} AED${lease.rent_frequency ? `/${lease.rent_frequency}` : ""}` : "no rent set"} ·{" "}
        deposit {lease.deposit_amount != null ? `${lease.deposit_amount} AED (${lease.deposit_status})` : "—"}
      </p>

      <LeaseManager
        leaseId={leaseId}
        rentAmount={lease.rent_amount as number | null}
        invoices={(invoices ?? []) as never[]}
        documents={(documents ?? []) as never[]}
      />
    </main>
  );
}
