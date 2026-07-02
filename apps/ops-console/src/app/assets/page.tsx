import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CreateAssetForm from "./CreateAssetForm";

type AssetRow = {
  id: string;
  name: string;
  category: string | null;
  system_type: string | null;
  qr_code: string | null;
  status: string;
  condition: string;
  criticality: string | null;
  warranty_expiry: string | null;
  next_maintenance_due: string | null;
  properties: { name: string } | null;
  units: { label: string; floor: string | null } | null;
  common_areas: { name: string; floor: string | null } | null;
};

const SYSTEM_LABELS: Record<string, string> = {
  hvac: "HVAC", electrical: "Electrical", plumbing: "Plumbing",
  fire_alarm: "Fire Alarm", firefighting: "Firefighting", elevator: "Elevator",
  water_tank: "Water Tank", pump: "Pump", generator: "Generator", bms: "BMS", other: "Other",
};

const STATUS_STYLE: Record<string, string> = {
  in_service: "bg-green-50 text-green-700",
  under_repair: "bg-amber-50 text-amber-700",
  spare_backup: "bg-blue-50 text-blue-700",
  removed: "bg-[#eef1f7] text-[#5b6b85]",
  redeployed: "bg-blue-50 text-blue-700",
  disposed: "bg-red-50 text-red-600",
};

async function getData(building?: string, system?: string) {
  const supabase = await createClient();

  let q = supabase
    .from("assets")
    .select(
      "id, name, category, system_type, qr_code, status, condition, criticality, warranty_expiry, next_maintenance_due, properties(name), units(label, floor), common_areas(name, floor)"
    )
    .order("name");
  if (building) q = q.eq("property_id", building);
  if (system) q = q.eq("system_type", system);

  const [{ data: assets }, { data: buildings }] = await Promise.all([
    q,
    supabase.from("properties").select("id, name").order("name"),
  ]);

  return {
    assets: (assets ?? []) as unknown as AssetRow[],
    buildings: (buildings ?? []) as { id: string; name: string }[],
  };
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export default async function AssetRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ building?: string; system?: string }>;
}) {
  const { building, system } = await searchParams;
  const { assets, buildings } = await getData(building, system);

  const kpis = [
    { label: "Total Assets", value: assets.length },
    { label: "In Service", value: assets.filter((a) => a.status === "in_service").length },
    { label: "Under Repair", value: assets.filter((a) => a.status === "under_repair").length },
    {
      label: "Warranty ≤ 60d",
      value: assets.filter((a) => {
        const d = daysUntil(a.warranty_expiry);
        return d !== null && d >= 0 && d <= 60;
      }).length,
    },
    {
      label: "PPM Due ≤ 30d",
      value: assets.filter((a) => {
        const d = daysUntil(a.next_maintenance_due);
        return d !== null && d >= 0 && d <= 30;
      }).length,
    },
  ];

  const selectCls =
    "bg-white border border-[#d8dfeb] rounded-lg px-3 py-2 text-sm text-[#16233c]";

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="eyebrow">Assets &amp; Engineering</p>
          <h1 className="mt-1">Asset Register</h1>
          <p className="text-[#5b6b85] mt-1">
            Every piece of equipment — Building → Floor → Apartment / Common Area → Equipment. QR-tagged,
            with warranty, condition and maintenance history.
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Link
            href="/assets/import"
            className="text-sm font-bold px-4 py-2.5 rounded-lg border border-[#b01b42] text-[#b01b42] hover:bg-[rgba(176,27,66,0.06)]"
          >
            Import Equipment
          </Link>
          <Link
            href="/assets/history-import"
            className="text-sm font-bold px-4 py-2.5 rounded-lg border border-[#d8dfeb] text-[#16233c] hover:border-[#b01b42] hover:text-[#b01b42]"
          >
            Import History
          </Link>
          <CreateAssetForm buildings={buildings} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="lux-card p-4">
            <p className="eyebrow text-[10px]">{k.label}</p>
            <p className="font-display text-3xl mt-1.5">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3 mb-4 items-center">
        <select name="building" defaultValue={building ?? ""} className={selectCls}>
          <option value="">All buildings</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select name="system" defaultValue={system ?? ""} className={selectCls}>
          <option value="">All systems</option>
          {Object.entries(SYSTEM_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button type="submit" className="btn-gold text-sm px-4 py-2">Filter</button>
        {(building || system) && (
          <Link href="/assets" className="text-sm text-[#5b6b85] underline">clear</Link>
        )}
      </form>

      <div className="lux-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[900px]">
            <thead>
              <tr className="text-left border-b border-[#e4e9f2] text-[#5b6b85] bg-[#f7f9fc]">
                <th className="px-5 py-3.5 font-medium">Equipment</th>
                <th className="px-5 py-3.5 font-medium">System</th>
                <th className="px-5 py-3.5 font-medium">Location</th>
                <th className="px-5 py-3.5 font-medium">Condition</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
                <th className="px-5 py-3.5 font-medium">Warranty</th>
                <th className="px-5 py-3.5 font-medium">Next PPM</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const loc = a.units
                  ? `${a.units.floor ? `Floor ${a.units.floor} · ` : ""}${a.units.label}`
                  : a.common_areas
                    ? `${a.common_areas.floor ? `Floor ${a.common_areas.floor} · ` : ""}${a.common_areas.name}`
                    : "Building-wide";
                const wDays = daysUntil(a.warranty_expiry);
                const ppmDays = daysUntil(a.next_maintenance_due);
                return (
                  <tr key={a.id} className="border-b border-[#eef1f7] hover:bg-[#f6f8fc]">
                    <td className="px-5 py-3.5">
                      <Link href={`/assets/${a.id}`} className="font-medium text-[#16233c] hover:text-[#b01b42] hover:underline">
                        {a.name}
                      </Link>
                      {a.qr_code && <p className="text-[10px] text-[#8b97ab] mt-0.5">{a.qr_code}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      {a.system_type ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-[rgba(176,27,66,0.08)] text-[#b01b42]">
                          {SYSTEM_LABELS[a.system_type]}
                        </span>
                      ) : (
                        <span className="text-[#8b97ab] capitalize">{a.category ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[#5b6b85]">
                      {a.properties?.name ?? "—"}<br />
                      <span className="text-[11px] text-[#8b97ab]">{loc}</span>
                    </td>
                    <td className="px-5 py-3.5 capitalize">{a.condition}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_STYLE[a.status] ?? ""}`}>
                        {a.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {a.warranty_expiry ? (
                        <span className={wDays !== null && wDays < 0 ? "text-[#8b97ab]" : wDays !== null && wDays <= 60 ? "text-amber-700 font-medium" : ""}>
                          {wDays !== null && wDays < 0 ? "Expired" : new Date(a.warranty_expiry).toLocaleDateString()}
                        </span>
                      ) : <span className="text-[#8b97ab]">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {a.next_maintenance_due ? (
                        <span className={ppmDays !== null && ppmDays <= 0 ? "text-red-600 font-medium" : ppmDays !== null && ppmDays <= 30 ? "text-amber-700" : "text-[#5b6b85]"}>
                          {new Date(a.next_maintenance_due).toLocaleDateString()}
                        </span>
                      ) : <span className="text-[#8b97ab]">—</span>}
                    </td>
                  </tr>
                );
              })}
              {assets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[#8b97ab]">
                    No assets registered yet. Add your first piece of equipment to start building the register.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
