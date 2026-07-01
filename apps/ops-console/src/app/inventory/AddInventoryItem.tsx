"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Property = { id: string; name: string };

export default function AddInventoryItem({ properties }: { properties: Property[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    unitOfMeasure: "",
    quantityOnHand: "",
    reorderThreshold: "",
    propertyId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", userData.user?.id ?? "")
      .single();

    const { error: insErr } = await supabase.from("inventory_items").insert({
      tenant_id: profile?.tenant_id,
      name: form.name,
      sku: form.sku || null,
      unit_of_measure: form.unitOfMeasure || null,
      quantity_on_hand: form.quantityOnHand ? Number(form.quantityOnHand) : 0,
      reorder_threshold: form.reorderThreshold ? Number(form.reorderThreshold) : 0,
      property_id: form.propertyId || null,
    });

    setSubmitting(false);
    if (insErr) return setError(insErr.message);

    setOpen(false);
    setForm({ name: "", sku: "", unitOfMeasure: "", quantityOnHand: "", reorderThreshold: "", propertyId: "" });
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-[#b8902f] text-[#0f1626] text-sm font-bold px-4 py-2 rounded-lg"
      >
        + Add Item
      </button>
    );
  }

  const input = "w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2.5 text-sm text-[#f0ece4]";

  return (
    <form onSubmit={handleSubmit} className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 space-y-3 max-w-sm">
      <h3 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-2">New Inventory Item</h3>

      <input className={input} placeholder="Item name *" value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <input className={input} placeholder="SKU (optional)" value={form.sku}
        onChange={(e) => setForm({ ...form, sku: e.target.value })} />
      <input className={input} placeholder="Unit (e.g. pcs, kg, liters)" value={form.unitOfMeasure}
        onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Qty on Hand</label>
          <input className={input} type="number" value={form.quantityOnHand}
            onChange={(e) => setForm({ ...form, quantityOnHand: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Reorder At</label>
          <input className={input} type="number" value={form.reorderThreshold}
            onChange={(e) => setForm({ ...form, reorderThreshold: e.target.value })} />
        </div>
      </div>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Property (optional)</label>
        <select className={input} value={form.propertyId}
          onChange={(e) => setForm({ ...form, propertyId: e.target.value })}>
          <option value="">All properties</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={submitting}
          className="bg-[#b8902f] text-[#0f1626] text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
          {submitting ? "Adding…" : "Add Item"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="bg-[#213052] text-sm font-medium px-4 py-2 rounded-lg text-[#a0977e]">
          Cancel
        </button>
      </div>
    </form>
  );
}
