import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CreateResidentForm from "./CreateResidentForm";

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
        <p className="text-gray-500">You don&apos;t have access to Residents &amp; Leases.</p>
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

  return (
    <main className="p-8">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/" className="text-sm text-gray-400 hover:text-white">← Dashboard</Link>
      </div>
      <h1 className="text-2xl font-bold mb-2">Residents &amp; Leases</h1>
      <p className="text-gray-500 mb-6">
        Onboard residents, set rent terms, and manage each lease&apos;s cheque schedule and documents.
      </p>

      <CreateResidentForm units={unitOptions} />

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-gray-700">
            <th className="py-2">Resident</th>
            <th className="py-2">Unit</th>
            <th className="py-2">Rent</th>
            <th className="py-2">Period</th>
            <th className="py-2">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {(leases ?? []).map((l) => {
            const unit = l.units as unknown as { label: string; properties: { name: string } | null } | null;
            return (
              <tr key={l.id} className="border-b border-gray-800">
                <td className="py-2">{l.tenant_full_name}</td>
                <td className="py-2 text-gray-400">
                  {unit?.properties?.name ? `${unit.properties.name} — ` : ""}{unit?.label ?? "—"}
                </td>
                <td className="py-2 text-gray-400">
                  {l.rent_amount != null ? `${l.rent_amount} AED${l.rent_frequency ? ` / ${l.rent_frequency}` : ""}` : "—"}
                </td>
                <td className="py-2 text-gray-400">
                  {l.start_date}{l.end_date ? ` – ${l.end_date}` : ""}
                </td>
                <td className="py-2 capitalize">{l.status}</td>
                <td className="py-2">
                  <Link href={`/admin/residents/${l.id}`} className="text-blue-400 hover:underline">
                    Manage
                  </Link>
                </td>
              </tr>
            );
          })}
          {(leases ?? []).length === 0 && (
            <tr><td colSpan={6} className="py-6 text-gray-500 text-center">No leases yet.</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
