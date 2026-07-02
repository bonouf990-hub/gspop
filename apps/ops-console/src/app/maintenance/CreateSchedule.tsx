"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { checkWorkflow } from "@/lib/workflow";

type Property = { id: string; name: string };
type Unit = { id: string; label: string; property_id: string };
type Asset = { id: string; name: string; property_id: string };
type Vendor = { id: string; name: string };
type Tech = { id: string; full_name: string; trade: string | null };

const TYPES = ["preventive", "inspection", "certification"];
const FREQUENCIES = ["daily", "weekly", "biweekly", "monthly", "quarterly", "biannual", "annual"];
const PRIORITIES = ["low", "medium", "high"];

export default function CreateSchedule({
  properties,
  units,
  assets,
  vendors,
  technicians,
}: {
  properties: Property[];
  units: Unit[];
  assets: Asset[];
  vendors: Vendor[];
  technicians: Tech[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    propertyId: "",
    unitId: "",
    assetId: "",
    type: "preventive",
    frequency: "monthly",
    priority: "medium",
    trade: "",
    technicianId: "",
    vendorId: "",
    nextDueDate: "",
    estimatedHours: "",
  });
  const [filteredUnits, setFilteredUnits] = useState<Unit[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (form.propertyId) {
      setFilteredUnits(units.filter((u) => u.property_id === form.propertyId));
      setFilteredAssets(assets.filter((a) => a.property_id === form.propertyId));
    } else {
      setFilteredUnits([]);
      setFilteredAssets([]);
    }
    setForm((f) => ({ ...f, unitId: "", assetId: "" }));
  }, [form.propertyId, units, assets]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setError("Not authenticated");
      setSubmitting(false);
      return;
    }

    const wf = await checkWorkflow(supabase, "maintenance", "create");
    if (!wf.allowed) {
      setError(wf.reason);
      setSubmitting(false);
      return;
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    const { error: insErr } = await supabase.from("maintenance_schedules").insert({
      tenant_id: profile?.tenant_id,
      property_id: form.propertyId,
      unit_id: form.unitId || null,
      asset_id: form.assetId || null,
      title: form.title,
      description: form.description || null,
      type: form.type,
      frequency: form.frequency,
      priority: form.priority,
      trade: form.trade || null,
      assigned_technician_id: form.technicianId || null,
      assigned_vendor_id: form.vendorId || null,
      next_due_date: form.nextDueDate,
      estimated_duration_hours: form.estimatedHours ? Number(form.estimatedHours) : null,
      created_by: userId,
    });

    setSubmitting(false);
    if (insErr) return setError(insErr.message);

    setOpen(false);
    setForm({
      title: "", description: "", propertyId: "", unitId: "", assetId: "",
      type: "preventive", frequency: "monthly", priority: "medium", trade: "",
      technicianId: "", vendorId: "", nextDueDate: "", estimatedHours: "",
    });
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-gold text-sm px-4 py-2"
      >
        + New Schedule
      </button>
    );
  }

  const input = "w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2.5 text-sm text-[#f0ece4]";

  return (
    <form onSubmit={handleSubmit} className="lux-card p-5 space-y-3 max-w-md">
      <h3 className="eyebrow mb-2">
        New Maintenance Schedule
      </h3>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Title *</label>
        <input className={input} placeholder="e.g. HVAC Filter Replacement"
          value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
      </div>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Description</label>
        <textarea className={input} rows={2} placeholder="Task details and instructions…"
          value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Type *</label>
          <select className={input} value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Frequency *</label>
          <select className={input} value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Priority *</label>
          <select className={input} value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Property *</label>
        <select className={input} value={form.propertyId}
          onChange={(e) => setForm({ ...form, propertyId: e.target.value })} required>
          <option value="">Select property…</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Unit (optional)</label>
          <select className={input} value={form.unitId}
            onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
            <option value="">All units</option>
            {filteredUnits.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Asset (optional)</label>
          <select className={input} value={form.assetId}
            onChange={(e) => setForm({ ...form, assetId: e.target.value })}>
            <option value="">No asset</option>
            {filteredAssets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Trade</label>
          <input className={input} placeholder="e.g. HVAC, Electrical"
            value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Est. Hours</label>
          <input className={input} type="number" step="0.25" placeholder="2.5"
            value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Technician</label>
          <select className={input} value={form.technicianId}
            onChange={(e) => setForm({ ...form, technicianId: e.target.value })}>
            <option value="">Unassigned</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}{t.trade ? ` (${t.trade})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Vendor</label>
          <select className={input} value={form.vendorId}
            onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
            <option value="">No vendor</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Next Due Date *</label>
        <input className={input} type="date" value={form.nextDueDate}
          onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} required />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={submitting}
          className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
          {submitting ? "Creating…" : "Create Schedule"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="bg-[#213052] text-sm font-medium px-4 py-2 rounded-lg text-[#a0977e]">
          Cancel
        </button>
      </div>
    </form>
  );
}
