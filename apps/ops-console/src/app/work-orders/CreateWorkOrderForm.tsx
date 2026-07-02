"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Modal from "@/components/Modal";

type Property = { id: string; name: string };
type Unit = { id: string; label: string; property_id: string };
type Tech = { id: string; full_name: string; trade: string | null };

const TYPES = ["corrective", "preventive", "inspection", "incident"];
const PRIORITIES = ["low", "medium", "high", "emergency"];

export default function CreateWorkOrderForm({
  properties,
  units,
  technicians,
}: {
  properties: Property[];
  units: Unit[];
  technicians: Tech[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    propertyId: "",
    unitId: "",
    type: "corrective",
    priority: "medium",
    title: "",
    description: "",
    technicianId: "",
    estimatedCost: "",
  });
  const [filteredUnits, setFilteredUnits] = useState<Unit[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (form.propertyId) {
      setFilteredUnits(units.filter((u) => u.property_id === form.propertyId));
    } else {
      setFilteredUnits([]);
    }
    setForm((f) => ({ ...f, unitId: "" }));
  }, [form.propertyId, units]);

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

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    const insert: Record<string, unknown> = {
      tenant_id: profile?.tenant_id,
      property_id: form.propertyId,
      unit_id: form.unitId || null,
      type: form.type,
      priority: form.priority,
      title: form.title,
      description: form.description || null,
      created_by: userId,
      status: form.technicianId ? "assigned" : "draft",
      assigned_technician_id: form.technicianId || null,
      estimated_cost: form.estimatedCost ? Number(form.estimatedCost) : null,
    };

    const { error: insErr } = await supabase.from("work_orders").insert(insert);
    setSubmitting(false);
    if (insErr) return setError(insErr.message);

    setOpen(false);
    setForm({
      propertyId: "", unitId: "", type: "corrective", priority: "medium",
      title: "", description: "", technicianId: "", estimatedCost: "",
    });
    router.refresh();
  }

  const input = "w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2.5 text-sm text-[#f0ece4]";

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-gold text-sm px-5 py-2.5">
        + Create Work Order
      </button>

      {open && (
        <Modal title="New Work Order" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Property *</label>
        <select className={input} value={form.propertyId}
          onChange={(e) => setForm({ ...form, propertyId: e.target.value })} required>
          <option value="">Select property…</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {filteredUnits.length > 0 && (
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Unit (optional)</label>
          <select className={input} value={form.unitId}
            onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
            <option value="">Common area / no unit</option>
            {filteredUnits.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Title *</label>
        <input className={input} placeholder="e.g. AC not cooling in unit 304"
          value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
      </div>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Description</label>
        <textarea className={`${input} h-20`} placeholder="Details about the issue…"
          value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Type</label>
          <select className={input} value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Priority</label>
          <select className={input} value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Assign Technician (optional)</label>
        <select className={input} value={form.technicianId}
          onChange={(e) => setForm({ ...form, technicianId: e.target.value })}>
          <option value="">Unassigned — save as draft</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}{t.trade ? ` (${t.trade})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Estimated Cost (AED) — optional, for external work only</label>
        <input className={input} type="number" placeholder="Leave empty for internal jobs"
          value={form.estimatedCost}
          onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={submitting}
          className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
          {submitting ? "Creating…" : "Create Work Order"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="bg-[#213052] text-sm font-medium px-4 py-2 rounded-lg text-[#a0977e]">
          Cancel
        </button>
      </div>
          </form>
        </Modal>
      )}
    </>
  );
}
