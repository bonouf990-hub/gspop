"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Vendor = { id: string; name: string; category: string | null };

export default function CreateWorkOrderPO({
  workOrderId,
  propertyId,
  workOrderTitle,
  vendors,
}: {
  workOrderId: string;
  propertyId: string;
  workOrderTitle: string;
  vendors: Vendor[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    vendorId: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const { error: insErr } = await supabase.from("purchase_orders").insert({
      property_id: propertyId,
      vendor_id: form.vendorId || null,
      work_order_id: workOrderId,
      requested_by: userId,
      amount: Number(form.amount),
      description: form.description || `Materials/services for: ${workOrderTitle}`,
      status: "pending",
    });

    setSubmitting(false);
    if (insErr) return setError(insErr.message);

    setOpen(false);
    setForm({ amount: "", vendorId: "", description: "" });
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#213052] text-[#d4af5a] hover:bg-[rgba(184,144,47,0.15)]"
      >
        + Create PO
      </button>
    );
  }

  const input = "w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2.5 text-sm text-[#f0ece4]";

  return (
    <form onSubmit={handleSubmit} className="lux-card p-4 space-y-3">
      <h3 className="eyebrow mb-2">
        Create Purchase Order
      </h3>
      <p className="text-xs text-[#a0977e]">
        For: {workOrderTitle}
      </p>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Description</label>
        <input
          className={input}
          placeholder="What needs to be purchased?"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Amount (AED) *</label>
          <input
            className={input}
            type="number"
            step="0.01"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Vendor (optional)</label>
          <select
            className={input}
            value={form.vendorId}
            onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
          >
            <option value="">Select vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}{v.category ? ` (${v.category})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="btn-gold text-sm px-4 py-2 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Submit PO"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="bg-[#213052] text-sm font-medium px-4 py-2 rounded-lg text-[#a0977e]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
