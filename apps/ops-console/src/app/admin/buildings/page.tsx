import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import PageHeader from "@/components/PageHeader";
import { Building2 } from "lucide-react";

type Building = {
  id: string;
  name: string;
  address: string | null;
  units: { count: number }[];
  common_areas: { count: number }[];
};

async function getBuildings() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("id, name, address, units(count), common_areas(count)")
    .order("name");
  return (data ?? []) as unknown as Building[];
}

export default async function BuildingsPage() {
  const buildings = await getBuildings();
  const totalUnits = buildings.reduce((s, b) => s + (b.units?.[0]?.count ?? 0), 0);
  const totalCommon = buildings.reduce((s, b) => s + (b.common_areas?.[0]?.count ?? 0), 0);

  return (
    <main className="p-6 sm:p-8 max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Portfolio"
        title="Buildings"
        icon={Building2}
        description="Every building with its floors, apartments and common areas — the foundation the Asset Register attaches to."
        actions={
          <Link href="/admin/buildings/import" className="btn-ghost text-sm px-4 py-2.5">
            Bulk Import
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[["Buildings", buildings.length], ["Apartments", totalUnits], ["Common Areas", totalCommon]].map(([label, value]) => (
          <div key={label as string} className="lux-card p-4">
            <p className="eyebrow text-[10px]">{label}</p>
            <p className="text-3xl font-extrabold text-[#16233c] mt-1.5 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="lux-card overflow-hidden">
        <table className="lux-table w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-[#e4e9f2] text-[#5b6b85] bg-[#f7f9fc]">
              <th className="px-5 py-3.5 font-medium">Building</th>
              <th className="px-5 py-3.5 font-medium">Address</th>
              <th className="px-5 py-3.5 font-medium">Apartments</th>
              <th className="px-5 py-3.5 font-medium">Common Areas</th>
            </tr>
          </thead>
          <tbody>
            {buildings.map((b) => (
              <tr key={b.id} className="border-b border-[#eef1f7] hover:bg-[#f6f8fc]">
                <td className="px-5 py-3.5">
                  <Link href={`/admin/buildings/${b.id}`} className="font-medium text-[#16233c] hover:text-[#b01b42] hover:underline">
                    {b.name}
                  </Link>
                </td>
                <td className="px-5 py-3.5 text-[#5b6b85]">{b.address ?? "—"}</td>
                <td className="px-5 py-3.5">{b.units?.[0]?.count ?? 0}</td>
                <td className="px-5 py-3.5">{b.common_areas?.[0]?.count ?? 0}</td>
              </tr>
            ))}
            {buildings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-[#8b97ab]">
                  No buildings yet. Use <b>Bulk Import</b> to load your whole portfolio in one file.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
