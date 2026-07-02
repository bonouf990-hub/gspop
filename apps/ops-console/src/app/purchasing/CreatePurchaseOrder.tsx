"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { checkWorkflow } from "@/lib/workflow";
import Modal from "@/components/Modal";

type Property = { id: string; name: string };
type Vendor = { id: string; name: string; category: string | null };

export default function CreatePurchaseOrder({
  properties,
  vendors,
}: {
  properties: Property[];
  vendors: Vendor[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    description: "",
    amount: "",
    propertyId: "",
    vendorId: "",
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

    const wf = await checkWorkflow(supabase, "purchase_orders", "create", {
      amount: Number(form.amount),
    });
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

    const { error: insErr } = await supabase.from("purchase_orders").insert({
      tenant_id: profile?.tenant_id,
      property_id: form.propertyId,
      vendor_id: form.vendorId || null,
      requested_by: userId,
      amount: Number(form.amount),
      description: form.description || null,
      status: "pending",
    });

    setSubmitting(false);
    if (insErr) return setError(insErr.message);

    setOpen(false);
    setForm({ description: "", amount: "", propertyId: "", vendorId: "" });
    router.refresh();
  }

  const input = "w-full bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] rounded-lg p-2.5 text-sm text-[#16233c]";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-gold text-sm px-5 py-2.5"
      >
        + New Purchase Order
      </button>

      {open && (
        <Modal title="New Purchase Order" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs text-[#5b6b85] mb-1 block">Description *</label>
        <input className={input} placeholder="What needs to be purchased?"
          value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
      </div>

      <div>
        <label className="text-xs text-[#5b6b85] mb-1 block">Amount (AED) *</label>
        <input className={input} type="number" step="0.01" placeholder="0.00"
          value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
      </div>

      <div>
        <label className="text-xs text-[#5b6b85] mb-1 block">Property *</label>
        <select className={input} value={form.propertyId}
          onChange={(e) => setForm({ ...form, propertyId: e.target.value })} required>
          <option value="">Select property…</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs text-[#5b6b85] mb-1 block">Vendor (optional)</label>
        <select className={input} value={form.vendorId}
          onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
          <option value="">No vendor selected</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}{v.category ? ` (${v.category})` : ""}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={submitting}
          className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
          {submitting ? "Creating…" : "Submit Order"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="bg-[#e9eef6] text-sm font-medium px-4 py-2 rounded-lg text-[#5b6b85]">
          Cancel
        </button>
      </div>
          </form>
        </Modal>
      )}
    </>
  );
}
