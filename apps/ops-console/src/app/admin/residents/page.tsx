import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CreateResidentForm from "./CreateResidentForm";
import ExportCsv from "@/components/ExportCsv";

export default async function ResidentsPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const { data: callerProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userData.user?.id ?? "")
    .single();

  const isAdmin = callerProfile && ["tenant_admin", "property_manager"].includes(callerProfile.role);
  if (!isAdmin) {
    return (
      <main className="p-8">
        <p className="text-[#8b97ab]">You don&apos;t have access to Residents &amp; Leases.</p>
      </main>
    );
  }

  const [{ data: leases }, { data: units }] = await Promise.all([
    supabase
      .from("leases")
      .select("id, tenant_full_name, status, rent_amount, rent_frequency, start_date, end_date, units(label, properties(name))")
      .order("start_date", { ascending: false }),
    supabase.from("units").select("id, label, properties(name)").order("label"),
  ]);

  const unitOptions = (units ?? []).map((u) => {
    const propName = (u as unknown as { properties: { name: string } | null }).properties?.name;
    return { id: u.id as string, label: propName ? `${propName} — ${u.label}` : (u.label as string) };
  });

  const csvRows = (leases ?? []).map((l) => {
    const unit = l.units as unknown as { label: string; properties: { name: string } | null } | null;
    return {
      Resident: l.tenant_full_name as string,
      Unit: unit
        ? `${unit.properties?.name ? `${unit.properties.name} — ` : ""}${unit.label}`
        : "",
      "Rent (AED)": l.rent_amount != null ? Number(l.rent_amount) : "",
      Frequency: (l.rent_frequency as string | null) ?? "",
      "Start Date": (l.start_date as string | null) ?? "",
      "End Date": (l.end_date as string | null) ?? "",
      Status: l.status as string,
    };
  });

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <Link href="/" className="text-sm text-[#5b6b85] hover:text-[#b01b42]">← Dashboard</Link>
          <h1 className="mt-1">Residents &amp; Leases</h1>
          <p className="text-[#5b6b85] mt-1">
            Onboard residents, set rent terms, and manage each lease&apos;s cheque schedule and documents.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/residents/renewals"
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#b01b42] text-[#b01b42] hover:bg-[rgba(176,27,66,0.12)]"
          >
            Lease Renewals
          </Link>
          <ExportCsv rows={csvRows} filename="leases" />
          <CreateResidentForm units={unitOptions} />
        </div>
      </div>

      <div className="lux-card overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[700px]">
        <thead>
          <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#5b6b85] bg-[rgba(176,27,66,0.04)]">
            <th className="px-5 py-3.5">Resident</th>
            <th className="px-5 py-3.5">Unit</th>
            <th className="px-5 py-3.5">Rent</th>
            <th className="px-5 py-3.5">Period</th>
            <th className="px-5 py-3.5">Status</th>
            <th className="px-5 py-3.5"></th>
          </tr>
        </thead>
        <tbody>
          {(leases ?? []).map((l) => {
            const unit = l.units as unknown as { label: string; properties: { name: string } | null } | null;
            return (
              <tr key={l.id} className="border-b border-[rgba(176,27,66,0.08)]">
                <td className="px-5 py-3.5">{l.tenant_full_name}</td>
                <td className="px-5 py-3.5 text-[#5b6b85]">
                  {unit?.properties?.name ? `${unit.properties.name} — ` : ""}{unit?.label ?? "—"}
                </td>
                <td className="px-5 py-3.5 text-[#5b6b85]">
                  {l.rent_amount != null ? `${l.rent_amount} AED${l.rent_frequency ? ` / ${l.rent_frequency}` : ""}` : "—"}
                </td>
                <td className="px-5 py-3.5 text-[#5b6b85]">
                  {l.start_date}{l.end_date ? ` – ${l.end_date}` : ""}
                </td>
                <td className="px-5 py-3.5 capitalize">{l.status}</td>
                <td className="px-5 py-3.5">
                  <Link href={`/admin/residents/${l.id}`} className="text-[#d9647f] hover:underline">
                    Manage
                  </Link>
                </td>
              </tr>
            );
          })}
          {(leases ?? []).length === 0 && (
            <tr><td colSpan={6} className="px-5 py-10 text-[#8b97ab] text-center">No leases yet.</td></tr>
          )}
        </tbody>
      </table>
      </div>
      </div>
    </main>
  );
}
