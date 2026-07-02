"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Vendor = { id: string; name: string };
type PO = { id: string; description: string | null; amount: number; vendor: { name: string } | null };

const PAYMENT_METHODS = ["cheque", "bank_transfer", "cash", "credit_card"];

export default function CreateInvoice({
  vendors,
  purchaseOrders,
}: {
  vendors: Vendor[];
  purchaseOrders: PO[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    invoiceNumber: "",
    vendorId: "",
    purchaseOrderId: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    amount: "",
    vatAmount: "0",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePOChange(poId: string) {
    const po = purchaseOrders.find((p) => p.id === poId);
    setForm((f) => ({
      ...f,
      purchaseOrderId: poId,
      amount: po ? String(po.amount) : f.amount,
      vendorId: "", // vendor comes from PO context
    }));
  }

  const amt = Number(form.amount) || 0;
  const vat = Number(form.vatAmount) || 0;
  const total = amt + vat;

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

    const { error: insErr } = await supabase.from("invoices").insert({
      tenant_id: profile?.tenant_id,
      purchase_order_id: form.purchaseOrderId || null,
      vendor_id: form.vendorId || null,
      invoice_number: form.invoiceNumber,
      invoice_date: form.invoiceDate,
      due_date: form.dueDate || null,
      amount: amt,
      vat_amount: vat,
      total_amount: total,
      notes: form.notes || null,
      status: "received",
    });

    setSubmitting(false);
    if (insErr) return setError(insErr.message);

    setOpen(false);
    setForm({
      invoiceNumber: "", vendorId: "", purchaseOrderId: "",
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: "", amount: "", vatAmount: "0", notes: "",
    });
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-[#b8902f] text-[#0f1626] text-sm font-bold px-4 py-2 rounded-lg"
      >
        + New Invoice
      </button>
    );
  }

  const input = "w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2.5 text-sm text-[#f0ece4]";

  return (
    <form onSubmit={handleSubmit} className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 space-y-3 max-w-md">
      <h3 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-2">
        Record Invoice
      </h3>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Invoice Number *</label>
        <input className={input} placeholder="INV-2024-001"
          value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} required />
      </div>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Link to Purchase Order</label>
        <select className={input} value={form.purchaseOrderId}
          onChange={(e) => handlePOChange(e.target.value)}>
          <option value="">No PO link</option>
          {purchaseOrders.map((po) => {
            const v = po.vendor as { name: string } | null;
            return (
              <option key={po.id} value={po.id}>
                {po.description?.slice(0, 30) ?? po.id.slice(0, 8)} — AED {Number(po.amount).toLocaleString()}
                {v ? ` (${v.name})` : ""}
              </option>
            );
          })}
        </select>
      </div>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Vendor *</label>
        <select className={input} value={form.vendorId}
          onChange={(e) => setForm({ ...form, vendorId: e.target.value })} required>
          <option value="">Select vendor…</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Invoice Date *</label>
          <input className={input} type="date" value={form.invoiceDate}
            onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Due Date</label>
          <input className={input} type="date" value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Amount (AED) *</label>
          <input className={input} type="number" step="0.01" placeholder="0.00"
            value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">VAT</label>
          <input className={input} type="number" step="0.01" placeholder="0.00"
            value={form.vatAmount} onChange={(e) => setForm({ ...form, vatAmount: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Total</label>
          <p className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2.5 text-sm text-[#d4af5a] font-bold">
            {total.toLocaleString()}
          </p>
        </div>
      </div>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Notes</label>
        <textarea className={input} rows={2} placeholder="Additional details…"
          value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={submitting}
          className="bg-[#b8902f] text-[#0f1626] text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
          {submitting ? "Recording…" : "Record Invoice"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="bg-[#213052] text-sm font-medium px-4 py-2 rounded-lg text-[#a0977e]">
          Cancel
        </button>
      </div>
    </form>
  );
}
