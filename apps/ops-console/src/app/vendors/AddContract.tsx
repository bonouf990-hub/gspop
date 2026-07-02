"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Modal from "@/components/Modal";

const SYSTEMS = [
  ["general", "General (whole building)"], ["hvac", "HVAC"], ["electrical", "Electrical"],
  ["plumbing", "Plumbing"], ["fire_alarm", "Fire Alarm"], ["firefighting", "Firefighting"],
  ["elevator", "Elevator"], ["water_tank", "Water Tank"], ["pump", "Pump"],
  ["generator", "Generator"], ["bms", "BMS"], ["other", "Other"],
];

export default function AddContract({
  vendors,
  properties,
}: {
  vendors: { id: string; name: string }[];
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    vendorId: "", propertyId: "", title: "", coveredSystem: "general",
    startDate: "", endDate: "", value: "", slaHours: "",
  });

  async function handleSubmit() {
    if (!f.vendorId || !f.title) { setError("Vendor and title are required."); return; }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("user_profiles").select("tenant_id").eq("id", userData.user?.id ?? "").single();

    const { error: insErr } = await supabase.from("contracts").insert({
      tenant_id: profile?.tenant_id,
      vendor_id: f.vendorId,
      property_id: f.propertyId || null,
      title: f.title,
      covered_system: f.coveredSystem || null,
      start_date: f.startDate || null,
      end_date: f.endDate || null,
      value: f.value ? Number(f.value) : null,
      sla_hours: f.slaHours ? Number(f.slaHours) : null,
    });
    setSaving(false);
    if (insErr) return setError(insErr.message);
    setOpen(false);
    setF({ vendorId: "", propertyId: "", title: "", coveredSystem: "general", startDate: "", endDate: "", value: "", slaHours: "" });
    router.refresh();
  }

  const inp = "bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] rounded-lg px-3 py-2 text-sm";

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-sm font-bold px-4 py-2.5 rounded-lg border border-[#b01b42] text-[#b01b42] hover:bg-[rgba(176,27,66,0.06)]">
        + New AMC / Contract
      </button>

      {open && (
        <Modal title="New AMC / Contract" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <p className="text-xs text-[#5b6b85]">
              Record an annual maintenance contract or warranty-backed agreement. Pinning it to a building and system lets the
              app warn — on a work order — that a repair may already be covered.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select value={f.vendorId} onChange={(e) => setF({ ...f, vendorId: e.target.value })} className={inp}>
                <option value="">Select Vendor…</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <select value={f.propertyId} onChange={(e) => setF({ ...f, propertyId: e.target.value })} className={inp}>
                <option value="">Building (all / unspecified)</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input placeholder="Contract title, e.g. HVAC AMC 2026" value={f.title}
                onChange={(e) => setF({ ...f, title: e.target.value })} className={`${inp} sm:col-span-2`} />
              <select value={f.coveredSystem} onChange={(e) => setF({ ...f, coveredSystem: e.target.value })} className={inp}>
                {SYSTEMS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
              <input placeholder="Value (AED)" type="number" value={f.value}
                onChange={(e) => setF({ ...f, value: e.target.value })} className={inp} />
              <div>
                <label className="text-[11px] text-[#8b97ab] block mb-0.5">Start date</label>
                <input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} className={`${inp} w-full`} />
              </div>
              <div>
                <label className="text-[11px] text-[#8b97ab] block mb-0.5">End date (coverage until)</label>
                <input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} className={`${inp} w-full`} />
              </div>
              <input placeholder="Response SLA (hours)" type="number" value={f.slaHours}
                onChange={(e) => setF({ ...f, slaHours: e.target.value })} className={inp} />
            </div>
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleSubmit} disabled={saving || !f.vendorId || !f.title}
                className="text-xs btn-gold px-4 py-2 disabled:opacity-50">
                {saving ? "Saving…" : "Save Contract"}
              </button>
              <button onClick={() => setOpen(false)}
                className="text-xs font-bold px-4 py-2 rounded-lg bg-[#f4f6fa] text-[#5b6b85] border border-[rgba(176,27,66,0.15)]">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
