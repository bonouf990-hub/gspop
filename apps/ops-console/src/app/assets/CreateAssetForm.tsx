"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Modal from "@/components/Modal";

type Building = { id: string; name: string };
type Unit = { id: string; label: string; floor: string | null; property_id: string };
type CommonArea = { id: string; name: string; floor: string | null; property_id: string };

const SYSTEMS = [
  ["", "— none —"], ["hvac", "HVAC"], ["electrical", "Electrical"], ["plumbing", "Plumbing"],
  ["fire_alarm", "Fire Alarm"], ["firefighting", "Firefighting"], ["elevator", "Elevator"],
  ["water_tank", "Water Tank"], ["pump", "Pump"], ["generator", "Generator"], ["bms", "BMS"], ["other", "Other"],
];

export default function CreateAssetForm({ buildings }: { buildings: Building[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [areas, setAreas] = useState<CommonArea[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    name: "", propertyId: "", locationType: "building", unitId: "", commonAreaId: "",
    systemType: "", category: "", manufacturer: "", model: "", serialNumber: "",
    qrCode: "", criticality: "", condition: "new", installedAt: "",
    warrantyExpiry: "", warrantyProvider: "", purchaseCost: "", maintenanceCycleMonths: "",
  });

  useEffect(() => {
    if (!open || !f.propertyId) { setUnits([]); setAreas([]); return; }
    const supabase = createClient();
    (async () => {
      const [{ data: u }, { data: c }] = await Promise.all([
        supabase.from("units").select("id, label, floor, property_id").eq("property_id", f.propertyId).order("label"),
        supabase.from("common_areas").select("id, name, floor, property_id").eq("property_id", f.propertyId).order("name"),
      ]);
      setUnits((u ?? []) as Unit[]);
      setAreas((c ?? []) as CommonArea[]);
    })();
  }, [open, f.propertyId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    const nextDue =
      f.installedAt && f.maintenanceCycleMonths
        ? new Date(new Date(f.installedAt).setMonth(new Date(f.installedAt).getMonth() + parseInt(f.maintenanceCycleMonths, 10)))
            .toISOString().slice(0, 10)
        : null;

    const insert: Record<string, unknown> = {
      property_id: f.propertyId,
      unit_id: f.locationType === "unit" ? f.unitId || null : null,
      common_area_id: f.locationType === "common" ? f.commonAreaId || null : null,
      name: f.name,
      category: f.category || null,
      system_type: f.systemType || null,
      manufacturer: f.manufacturer || null,
      model: f.model || null,
      serial_number: f.serialNumber || null,
      qr_code: f.qrCode || null,
      criticality: f.criticality || null,
      condition: f.condition,
      installed_at: f.installedAt || null,
      warranty_expiry: f.warrantyExpiry || null,
      warranty_provider: f.warrantyProvider || null,
      purchase_cost: f.purchaseCost ? Number(f.purchaseCost) : null,
      maintenance_cycle_months: f.maintenanceCycleMonths ? parseInt(f.maintenanceCycleMonths, 10) : null,
      next_maintenance_due: nextDue,
    };

    const { data, error: insErr } = await supabase.from("assets").insert(insert).select("id").single();
    setSubmitting(false);
    if (insErr) return setError(insErr.message);
    setOpen(false);
    router.push(`/assets/${data.id}`);
    router.refresh();
  }

  const inp = "w-full bg-white border border-[#d8dfeb] rounded-lg p-2.5 text-sm text-[#16233c]";
  const lbl = "text-xs text-[#5b6b85] mb-1 block";

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-gold text-sm px-5 py-2.5">+ Register Asset</button>
      {open && (
        <Modal title="Register Equipment" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className={lbl}>Equipment name *</label>
              <input className={inp} placeholder="e.g. Split AC — Bedroom, Chiller Pump #2" required
                value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>System type</label>
                <select className={inp} value={f.systemType} onChange={(e) => setF({ ...f, systemType: e.target.value })}>
                  {SYSTEMS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Criticality</label>
                <select className={inp} value={f.criticality} onChange={(e) => setF({ ...f, criticality: e.target.value })}>
                  <option value="">—</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Location: Building > Floor > Apartment/Common */}
            <div>
              <label className={lbl}>Building *</label>
              <select className={inp} required value={f.propertyId}
                onChange={(e) => setF({ ...f, propertyId: e.target.value, unitId: "", commonAreaId: "" })}>
                <option value="">Select building…</option>
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {f.propertyId && (
              <div>
                <label className={lbl}>Location within building</label>
                <div className="flex gap-2 mb-2">
                  {[["building", "Building-wide"], ["unit", "Apartment"], ["common", "Common area"]].map(([v, t]) => (
                    <button type="button" key={v}
                      onClick={() => setF({ ...f, locationType: v })}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${f.locationType === v ? "border-[#b01b42] text-[#b01b42] bg-[rgba(176,27,66,0.06)]" : "border-[#d8dfeb] text-[#5b6b85]"}`}>
                      {t}
                    </button>
                  ))}
                </div>
                {f.locationType === "unit" && (
                  <select className={inp} value={f.unitId} onChange={(e) => setF({ ...f, unitId: e.target.value })}>
                    <option value="">Select apartment…</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.floor ? `Floor ${u.floor} · ` : ""}{u.label}</option>)}
                  </select>
                )}
                {f.locationType === "common" && (
                  <select className={inp} value={f.commonAreaId} onChange={(e) => setF({ ...f, commonAreaId: e.target.value })}>
                    <option value="">Select common area…</option>
                    {areas.map((c) => <option key={c.id} value={c.id}>{c.floor ? `Floor ${c.floor} · ` : ""}{c.name}</option>)}
                  </select>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div><label className={lbl}>Manufacturer</label><input className={inp} value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} /></div>
              <div><label className={lbl}>Model</label><input className={inp} value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></div>
              <div><label className={lbl}>Serial no.</label><input className={inp} value={f.serialNumber} onChange={(e) => setF({ ...f, serialNumber: e.target.value })} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Asset tag / QR code</label><input className={inp} placeholder="e.g. AC-GS5-1203-01" value={f.qrCode} onChange={(e) => setF({ ...f, qrCode: e.target.value })} /></div>
              <div><label className={lbl}>Condition</label>
                <select className={inp} value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })}>
                  <option value="new">New</option><option value="refurbished">Refurbished</option>
                  <option value="used">Used</option><option value="damaged">Damaged</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Installed date</label><input type="date" className={inp} value={f.installedAt} onChange={(e) => setF({ ...f, installedAt: e.target.value })} /></div>
              <div><label className={lbl}>PPM cycle (months)</label><input type="number" min={1} className={inp} placeholder="e.g. 3" value={f.maintenanceCycleMonths} onChange={(e) => setF({ ...f, maintenanceCycleMonths: e.target.value })} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Warranty expiry</label><input type="date" className={inp} value={f.warrantyExpiry} onChange={(e) => setF({ ...f, warrantyExpiry: e.target.value })} /></div>
              <div><label className={lbl}>Warranty provider</label><input className={inp} value={f.warrantyProvider} onChange={(e) => setF({ ...f, warrantyProvider: e.target.value })} /></div>
            </div>

            <div><label className={lbl}>Purchase cost (AED)</label><input type="number" className={inp} value={f.purchaseCost} onChange={(e) => setF({ ...f, purchaseCost: e.target.value })} /></div>

            {error && <p className="text-red-600 text-xs">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={submitting} className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
                {submitting ? "Registering…" : "Register Asset"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="bg-[#e9eef6] text-sm font-medium px-4 py-2 rounded-lg text-[#5b6b85]">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
