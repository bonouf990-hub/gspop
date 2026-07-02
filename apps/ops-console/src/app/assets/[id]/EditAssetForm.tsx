"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Modal from "@/components/Modal";

type Building = { id: string; name: string };
type Unit = { id: string; label: string; floor: string | null; property_id: string };
type CommonArea = { id: string; name: string; floor: string | null; property_id: string };

export type AssetForEdit = {
  id: string;
  name: string;
  property_id: string | null;
  unit_id: string | null;
  common_area_id: string | null;
  system_type: string | null;
  category: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  qr_code: string | null;
  criticality: string | null;
  condition: string;
  status: string;
  installed_at: string | null;
  expected_life_months: number | null;
  warranty_expiry: string | null;
  warranty_provider: string | null;
  purchase_cost: number | null;
  maintenance_cycle_months: number | null;
  next_maintenance_due: string | null;
  prior_service_count: number | null;
  prior_service_cost: number | null;
};

const SYSTEMS = [
  ["", "— none —"], ["hvac", "HVAC"], ["electrical", "Electrical"], ["plumbing", "Plumbing"],
  ["fire_alarm", "Fire Alarm"], ["firefighting", "Firefighting"], ["elevator", "Elevator"],
  ["water_tank", "Water Tank"], ["pump", "Pump"], ["generator", "Generator"], ["bms", "BMS"], ["other", "Other"],
];

const STATUSES = [
  ["in_service", "In service"], ["under_repair", "Under repair"], ["spare_backup", "Spare / backup"],
  ["removed", "Removed"], ["redeployed", "Redeployed"], ["disposed", "Disposed"],
];

const num = (v: number | null) => (v == null ? "" : String(v));

export default function EditAssetForm({ asset }: { asset: AssetForEdit }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [areas, setAreas] = useState<CommonArea[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationType = asset.unit_id ? "unit" : asset.common_area_id ? "common" : "building";
  const [f, setF] = useState({
    name: asset.name,
    propertyId: asset.property_id ?? "",
    locationType,
    unitId: asset.unit_id ?? "",
    commonAreaId: asset.common_area_id ?? "",
    systemType: asset.system_type ?? "",
    category: asset.category ?? "",
    manufacturer: asset.manufacturer ?? "",
    model: asset.model ?? "",
    serialNumber: asset.serial_number ?? "",
    qrCode: asset.qr_code ?? "",
    criticality: asset.criticality ?? "",
    condition: asset.condition ?? "new",
    status: asset.status ?? "in_service",
    installedAt: asset.installed_at ?? "",
    expectedLifeMonths: num(asset.expected_life_months),
    warrantyExpiry: asset.warranty_expiry ?? "",
    warrantyProvider: asset.warranty_provider ?? "",
    purchaseCost: num(asset.purchase_cost),
    maintenanceCycleMonths: num(asset.maintenance_cycle_months),
    priorServiceCount: num(asset.prior_service_count),
    priorServiceCost: num(asset.prior_service_cost),
  });

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase.from("properties").select("id, name").order("name").then(({ data }) => {
      setBuildings((data ?? []) as Building[]);
    });
  }, [open]);

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

    const cycle = f.maintenanceCycleMonths ? parseInt(f.maintenanceCycleMonths, 10) : null;
    const nextDue =
      f.installedAt && cycle
        ? new Date(new Date(f.installedAt).setMonth(new Date(f.installedAt).getMonth() + cycle)).toISOString().slice(0, 10)
        : asset.next_maintenance_due;

    const update: Record<string, unknown> = {
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
      status: f.status,
      installed_at: f.installedAt || null,
      expected_life_months: f.expectedLifeMonths ? parseInt(f.expectedLifeMonths, 10) : null,
      warranty_expiry: f.warrantyExpiry || null,
      warranty_provider: f.warrantyProvider || null,
      purchase_cost: f.purchaseCost ? Number(f.purchaseCost) : null,
      maintenance_cycle_months: cycle,
      next_maintenance_due: nextDue,
      prior_service_count: f.priorServiceCount ? parseInt(f.priorServiceCount, 10) : 0,
      prior_service_cost: f.priorServiceCost ? Number(f.priorServiceCost) : 0,
    };

    const { error: updErr } = await supabase.from("assets").update(update).eq("id", asset.id);
    setSubmitting(false);
    if (updErr) return setError(updErr.message);
    setOpen(false);
    router.refresh();
  }

  const inp = "w-full bg-white border border-[#d8dfeb] rounded-lg p-2.5 text-sm text-[#16233c]";
  const lbl = "text-xs text-[#5b6b85] mb-1 block";

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="text-sm font-bold px-4 py-2 rounded-lg border border-[#d8dfeb] text-[#16233c] hover:border-[#b01b42] hover:text-[#b01b42]">
        Edit
      </button>
      {open && (
        <Modal title="Edit Equipment" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className={lbl}>Equipment name *</label>
              <input className={inp} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>

            <div className="grid grid-cols-3 gap-3">
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
              <div>
                <label className={lbl}>Status</label>
                <select className={inp} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                  {STATUSES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
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
              <div><label className={lbl}>Asset tag / QR code</label><input className={inp} value={f.qrCode} onChange={(e) => setF({ ...f, qrCode: e.target.value })} /></div>
              <div><label className={lbl}>Condition</label>
                <select className={inp} value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })}>
                  <option value="new">New</option><option value="refurbished">Refurbished</option>
                  <option value="used">Used</option><option value="damaged">Damaged</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div><label className={lbl}>Installed date</label><input type="date" className={inp} value={f.installedAt} onChange={(e) => setF({ ...f, installedAt: e.target.value })} /></div>
              <div><label className={lbl}>Expected life (months)</label><input type="number" min={1} className={inp} value={f.expectedLifeMonths} onChange={(e) => setF({ ...f, expectedLifeMonths: e.target.value })} /></div>
              <div><label className={lbl}>PPM cycle (months)</label><input type="number" min={1} className={inp} value={f.maintenanceCycleMonths} onChange={(e) => setF({ ...f, maintenanceCycleMonths: e.target.value })} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Warranty expiry</label><input type="date" className={inp} value={f.warrantyExpiry} onChange={(e) => setF({ ...f, warrantyExpiry: e.target.value })} /></div>
              <div><label className={lbl}>Warranty provider</label><input className={inp} value={f.warrantyProvider} onChange={(e) => setF({ ...f, warrantyProvider: e.target.value })} /></div>
            </div>

            {/* Cost & pre-system service history */}
            <div className="grid grid-cols-3 gap-3">
              <div><label className={lbl}>Purchase cost (AED)</label><input type="number" className={inp} value={f.purchaseCost} onChange={(e) => setF({ ...f, purchaseCost: e.target.value })} /></div>
              <div><label className={lbl}>Prior services (count)</label><input type="number" min={0} className={inp} placeholder="times serviced before" value={f.priorServiceCount} onChange={(e) => setF({ ...f, priorServiceCount: e.target.value })} /></div>
              <div><label className={lbl}>Prior service cost (AED)</label><input type="number" className={inp} placeholder="spent before go-live" value={f.priorServiceCost} onChange={(e) => setF({ ...f, priorServiceCost: e.target.value })} /></div>
            </div>
            <p className="text-[11px] text-[#8b97ab]">
              Prior fields capture history from before this system — the running totals of times serviced and money spent.
              Log individual past services below the profile once saved.
            </p>

            {error && <p className="text-red-600 text-xs">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={submitting} className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
                {submitting ? "Saving…" : "Save changes"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="bg-[#e9eef6] text-sm font-medium px-4 py-2 rounded-lg text-[#5b6b85]">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
