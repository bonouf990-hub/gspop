import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { qrDataUrl, assetUrl } from "@/lib/qr";
import PrintButton from "./PrintButton";

const SYSTEM_LABELS: Record<string, string> = {
  hvac: "HVAC", electrical: "Electrical", plumbing: "Plumbing", fire_alarm: "Fire Alarm",
  firefighting: "Firefighting", elevator: "Elevator", water_tank: "Water Tank",
  pump: "Pump", generator: "Generator", bms: "BMS", other: "Other",
};

async function getAsset(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assets")
    .select("*, properties(name), units(label, floor), common_areas(name, floor)")
    .eq("id", id)
    .single();
  return data;
}

async function getCases(assetId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("work_orders")
    .select("id, case_number, title, status, priority, actual_cost, created_at")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false });
  return (data ?? []) as {
    id: string; case_number: string | null; title: string; status: string;
    priority: string; actual_cost: number | null; created_at: string;
  }[];
}

async function getLifecycle(assetId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("asset_lifecycle_events")
    .select("event_type, notes, event_date, performer:user_profiles!asset_lifecycle_events_performed_by_fkey(full_name)")
    .eq("asset_id", assetId)
    .order("event_date", { ascending: false });
  return (data ?? []) as unknown as {
    event_type: string; notes: string | null; event_date: string; performer: { full_name: string } | null;
  }[];
}

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await getAsset(id);
  if (!asset) {
    return <main className="p-8 max-w-6xl mx-auto"><p className="text-[#8b97ab]">Asset not found.</p></main>;
  }

  const [cases, lifecycle, qr] = await Promise.all([
    getCases(id),
    getLifecycle(id),
    qrDataUrl(assetUrl(id)),
  ]);

  const property = asset.properties as unknown as { name: string } | null;
  const unit = asset.units as unknown as { label: string; floor: string | null } | null;
  const area = asset.common_areas as unknown as { name: string; floor: string | null } | null;

  const location = unit
    ? `${property?.name ?? ""}${unit.floor ? ` · Floor ${unit.floor}` : ""} · ${unit.label}`
    : area
      ? `${property?.name ?? ""}${area.floor ? ` · Floor ${area.floor}` : ""} · ${area.name}`
      : `${property?.name ?? ""} · Building-wide`;

  const warrantyDays = asset.warranty_expiry
    ? Math.ceil((new Date(asset.warranty_expiry as string).getTime() - Date.now()) / 86400000)
    : null;
  const underWarranty = warrantyDays !== null && warrantyDays >= 0;

  const lifetimeCost = cases.reduce((s, c) => s + Number(c.actual_cost ?? 0), 0);
  const repairCount = cases.length;

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <Link href="/assets" className="text-sm text-[#5b6b85] hover:text-[#b01b42]">← Asset Register</Link>
          <p className="eyebrow mt-2">{asset.qr_code as string ?? "Equipment"}</p>
          <h1 className="mt-0.5">{asset.name as string}</h1>
          <p className="text-[#5b6b85] mt-1">{location}</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full capitalize ${
          asset.status === "in_service" ? "bg-green-50 text-green-700"
          : asset.status === "under_repair" ? "bg-amber-50 text-amber-700"
          : "bg-[#eef1f7] text-[#5b6b85]"}`}>
          {(asset.status as string).replace(/_/g, " ")}
        </span>
      </div>

      {/* Warranty / AMC guard banner */}
      {underWarranty && (
        <div className="lux-card p-4 mb-6 border-l-4 border-l-green-500 flex items-center gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <p className="font-bold text-sm text-green-800">Under warranty — repairs may be covered</p>
            <p className="text-xs text-[#5b6b85]">
              Valid until {new Date(asset.warranty_expiry as string).toLocaleDateString()} ({warrantyDays} days)
              {asset.warranty_provider ? ` · ${asset.warranty_provider}` : ""}. Check coverage before charging a repair.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        {/* Left: profile + history */}
        <div className="space-y-6">
          <section className="lux-card p-6">
            <h2 className="eyebrow mb-4">Equipment Profile</h2>
            <div className="grid grid-cols-2 gap-y-2.5 text-sm">
              <span className="text-[#5b6b85]">System</span>
              <span>{asset.system_type ? SYSTEM_LABELS[asset.system_type as string] : (asset.category as string ?? "—")}</span>
              <span className="text-[#5b6b85]">Criticality</span>
              <span className="capitalize">{asset.criticality as string ?? "—"}</span>
              <span className="text-[#5b6b85]">Manufacturer</span>
              <span>{asset.manufacturer as string ?? "—"}</span>
              <span className="text-[#5b6b85]">Model</span>
              <span>{asset.model as string ?? "—"}</span>
              <span className="text-[#5b6b85]">Serial no.</span>
              <span>{asset.serial_number as string ?? "—"}</span>
              <span className="text-[#5b6b85]">Condition</span>
              <span className="capitalize">{asset.condition as string}</span>
              <span className="text-[#5b6b85]">Installed</span>
              <span>{asset.installed_at ? new Date(asset.installed_at as string).toLocaleDateString() : "—"}</span>
              <span className="text-[#5b6b85]">Expected life</span>
              <span>{asset.expected_life_months ? `${asset.expected_life_months} months` : "—"}</span>
              <span className="text-[#5b6b85]">Warranty</span>
              <span>{asset.warranty_expiry
                ? `${new Date(asset.warranty_expiry as string).toLocaleDateString()}${asset.warranty_provider ? ` (${asset.warranty_provider})` : ""}`
                : "—"}</span>
              <span className="text-[#5b6b85]">Purchase cost</span>
              <span>{asset.purchase_cost ? `AED ${Number(asset.purchase_cost).toLocaleString()}` : "—"}</span>
              <span className="text-[#5b6b85]">Next PPM due</span>
              <span>{asset.next_maintenance_due ? new Date(asset.next_maintenance_due as string).toLocaleDateString() : "—"}</span>
            </div>
          </section>

          <section className="lux-card p-6">
            <h2 className="eyebrow mb-4">Maintenance History ({repairCount})</h2>
            {cases.length === 0 ? (
              <p className="text-sm text-[#8b97ab]">No maintenance cases for this equipment yet.</p>
            ) : (
              <div className="space-y-2">
                {cases.map((c) => (
                  <Link key={c.id} href={`/work-orders/${c.id}`}
                    className="flex items-center justify-between bg-[#f7f9fc] rounded-lg px-4 py-2.5 hover:bg-[#f0f4f9]">
                    <div>
                      <p className="text-[10px] font-bold tracking-wider text-[#b01b42]">{c.case_number ?? ""}</p>
                      <p className="text-sm font-medium">{c.title}</p>
                      <p className="text-[11px] text-[#8b97ab] capitalize">{c.status.replace(/_/g, " ")} · {new Date(c.created_at).toLocaleDateString()}</p>
                    </div>
                    {c.actual_cost != null && <span className="text-sm font-bold text-[#16233c]">AED {Number(c.actual_cost).toLocaleString()}</span>}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {lifecycle.length > 0 && (
            <section className="lux-card p-6">
              <h2 className="eyebrow mb-4">Lifecycle</h2>
              <ol className="space-y-3">
                {lifecycle.map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#b01b42] mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium capitalize">{e.event_type.replace(/_/g, " ")}</p>
                      <p className="text-[11px] text-[#8b97ab]">
                        {new Date(e.event_date).toLocaleString()}{e.performer ? ` · ${e.performer.full_name}` : ""}
                        {e.notes ? ` · ${e.notes}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* Right rail: QR + cost */}
        <div className="space-y-4">
          <section className="lux-card p-6 text-center print-area">
            <h2 className="eyebrow mb-4">Asset QR Tag</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Asset QR code" className="w-44 h-44 mx-auto" />
            <p className="mt-3 font-bold text-sm">{asset.name as string}</p>
            <p className="text-xs text-[#5b6b85]">{asset.qr_code as string ?? ""}</p>
            <p className="text-[11px] text-[#8b97ab] mt-0.5">{location}</p>
            <div className="mt-4 print:hidden">
              <PrintButton />
            </div>
            <p className="text-[10px] text-[#8b97ab] mt-2 print:hidden">
              Print &amp; stick on the equipment. Technicians scan it on site to open this file.
            </p>
          </section>

          <section className="lux-card p-5">
            <h2 className="eyebrow mb-3">Cost &amp; Wear</h2>
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-[#5b6b85]">Repairs to date</span><span className="font-bold">{repairCount}</span></div>
              <div className="flex justify-between"><span className="text-[#5b6b85]">Lifetime repair cost</span><span className="font-bold">AED {lifetimeCost.toLocaleString()}</span></div>
              {asset.purchase_cost != null && (
                <div className="flex justify-between"><span className="text-[#5b6b85]">Purchase cost</span><span>AED {Number(asset.purchase_cost).toLocaleString()}</span></div>
              )}
            </div>
            {asset.purchase_cost != null && lifetimeCost > Number(asset.purchase_cost) * 0.6 && (
              <p className="mt-3 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2.5">
                ⚠ Repairs have reached {Math.round((lifetimeCost / Number(asset.purchase_cost)) * 100)}% of purchase cost —
                consider replacement.
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
