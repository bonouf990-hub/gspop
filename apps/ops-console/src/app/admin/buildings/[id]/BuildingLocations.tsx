"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Unit = { id: string; label: string; floor: string | null; bedrooms: number | null };
type Area = { id: string; name: string; category: string; floor: string | null };

const CATEGORIES = [
  "lobby", "basement", "parking", "corridor", "elevator", "staircase", "rooftop",
  "pool", "gym", "electrical_room", "pump_room", "fire_system", "garden", "waste_area", "other",
];
const catLabel = (c: string) => c.replace(/_/g, " ");

export default function BuildingLocations({
  buildingId,
  initialUnits,
  initialAreas,
}: {
  buildingId: string;
  initialUnits: Unit[];
  initialAreas: Area[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [area, setArea] = useState({ name: "", category: "pump_room", floor: "" });
  const [unit, setUnit] = useState({ label: "", floor: "", bedrooms: "" });

  async function addArea(e: React.FormEvent) {
    e.preventDefault();
    if (!area.name) return;
    setBusy(true); setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("common_areas").insert({
      property_id: buildingId, name: area.name, category: area.category, floor: area.floor || null,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setArea({ name: "", category: area.category, floor: "" });
    router.refresh();
  }

  async function addUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!unit.label) return;
    setBusy(true); setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("units").insert({
      property_id: buildingId, label: unit.label, floor: unit.floor || null,
      bedrooms: unit.bedrooms ? parseInt(unit.bedrooms, 10) : null,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setUnit({ label: "", floor: unit.floor, bedrooms: "" });
    router.refresh();
  }

  async function remove(table: "common_areas" | "units", id: string, what: string) {
    if (!confirm(`Remove ${what}?`)) return;
    const supabase = createClient();
    const { error: err } = await supabase.from(table).delete().eq("id", id);
    if (err) return setError(err.message);
    router.refresh();
  }

  const inp = "bg-white border border-[#d8dfeb] rounded-lg px-3 py-2 text-sm text-[#16233c]";

  return (
    <div className="space-y-8">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Common areas */}
      <section>
        <div className="flex items-center gap-4 mb-3">
          <h2 className="eyebrow whitespace-nowrap">Common Areas ({initialAreas.length})</h2>
          <div className="gold-rule flex-1 opacity-60" />
        </div>
        <form onSubmit={addArea} className="flex flex-wrap gap-2 mb-4">
          <input className={`${inp} flex-1 min-w-[180px]`} placeholder="Name, e.g. Basement Pump Room"
            value={area.name} onChange={(e) => setArea({ ...area, name: e.target.value })} />
          <select className={inp} value={area.category} onChange={(e) => setArea({ ...area, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{catLabel(c)}</option>)}
          </select>
          <input className={`${inp} w-24`} placeholder="Floor" value={area.floor}
            onChange={(e) => setArea({ ...area, floor: e.target.value })} />
          <button type="submit" disabled={busy} className="btn-gold text-sm px-4 py-2 disabled:opacity-50">Add</button>
        </form>
        {initialAreas.length === 0 ? (
          <p className="text-sm text-[#8b97ab]">No common areas yet. Add the pump room, electrical room, rooftop plant, etc.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {initialAreas.map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-[#f7f9fc] rounded-lg px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-[11px] text-[#8b97ab] capitalize">{catLabel(a.category)}{a.floor ? ` · Floor ${a.floor}` : ""}</p>
                </div>
                <button onClick={() => remove("common_areas", a.id, a.name)} className="text-[#8b97ab] hover:text-red-600 text-xs">Remove</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Apartments */}
      <section>
        <div className="flex items-center gap-4 mb-3">
          <h2 className="eyebrow whitespace-nowrap">Apartments ({initialUnits.length})</h2>
          <div className="gold-rule flex-1 opacity-60" />
        </div>
        <form onSubmit={addUnit} className="flex flex-wrap gap-2 mb-4">
          <input className={`${inp} w-32`} placeholder="Unit no." value={unit.label}
            onChange={(e) => setUnit({ ...unit, label: e.target.value })} />
          <input className={`${inp} w-24`} placeholder="Floor" value={unit.floor}
            onChange={(e) => setUnit({ ...unit, floor: e.target.value })} />
          <input className={`${inp} w-28`} type="number" min={0} placeholder="Bedrooms" value={unit.bedrooms}
            onChange={(e) => setUnit({ ...unit, bedrooms: e.target.value })} />
          <button type="submit" disabled={busy} className="btn-gold text-sm px-4 py-2 disabled:opacity-50">Add</button>
        </form>
        {initialUnits.length === 0 ? (
          <p className="text-sm text-[#8b97ab]">No apartments yet. Add them here or via bulk import.</p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto border border-[#eef1f7] rounded-lg">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 p-2">
              {initialUnits.map((u) => (
                <div key={u.id} className="flex items-center justify-between bg-[#f7f9fc] rounded-lg px-3 py-1.5">
                  <div>
                    <span className="text-sm font-medium">{u.label}</span>
                    <span className="text-[10px] text-[#8b97ab] ml-1">
                      {u.floor ? `F${u.floor}` : ""}{u.bedrooms != null ? ` · ${u.bedrooms}BR` : ""}
                    </span>
                  </div>
                  <button onClick={() => remove("units", u.id, `apartment ${u.label}`)} className="text-[#c3ccdb] hover:text-red-600 text-xs ml-1">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
