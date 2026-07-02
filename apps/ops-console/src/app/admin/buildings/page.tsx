import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

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
    <main className="p-8 max-w-5xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1 className="mt-1">Buildings</h1>
          <p className="text-[#5b6b85] mt-1">
            Every building with its floors, apartments and common areas — the foundation the Asset Register attaches to.
          </p>
        </div>
        <Link href="/admin/buildings/import"
          className="text-sm font-bold px-4 py-2.5 rounded-lg border border-[#b01b42] text-[#b01b42] hover:bg-[rgba(176,27,66,0.06)]">
          Bulk Import
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[["Buildings", buildings.length], ["Apartments", totalUnits], ["Common Areas", totalCommon]].map(([label, value]) => (
          <div key={label as string} className="lux-card p-4">
            <p className="eyebrow text-[10px]">{label}</p>
            <p className="font-display text-3xl mt-1.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="lux-card overflow-hidden">
        <table className="w-full text-sm border-collapse">
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
