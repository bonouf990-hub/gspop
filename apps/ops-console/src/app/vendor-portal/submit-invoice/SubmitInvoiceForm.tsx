"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

type PO = { id: string; description: string | null; amount: number; status: string };

export default function SubmitInvoiceForm({
  vendorId,
  tenantId,
  pos,
}: {
  vendorId: string;
  tenantId: string;
  pos: PO[];
}) {
  const router = useRouter();
  const [poId, setPoId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [vatAmount, setVatAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAmount = (Number(amount) || 0) + (Number(vatAmount) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceNumber.trim() || !amount || !invoiceDate) return;
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("invoices").insert({
      tenant_id: tenantId,
      vendor_id: vendorId,
      purchase_order_id: poId || null,
      invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      amount: Number(amount),
      vat_amount: Number(vatAmount) || 0,
      total_amount: totalAmount,
      status: "received",
      notes: notes.trim() || null,
    });

    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.push("/vendor-portal");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 text-[#5b6b85]">Linked Purchase Order (optional)</label>
        <select
          value={poId}
          onChange={(e) => setPoId(e.target.value)}
          className="w-full rounded-lg bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] p-2.5 text-sm"
        >
          <option value="">— No PO —</option>
          {pos.map((po) => (
            <option key={po.id} value={po.id}>
              {po.description ?? po.id.slice(0, 8)} — AED {Number(po.amount).toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-[#5b6b85]">Invoice Number *</label>
          <input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            required
            placeholder="INV-001"
            className="w-full rounded-lg bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] p-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-[#5b6b85]">Invoice Date *</label>
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            required
            className="w-full rounded-lg bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] p-2.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-[#5b6b85]">Due Date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-lg bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] p-2.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-[#5b6b85]">Amount (AED) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="0.00"
            className="w-full rounded-lg bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] p-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-[#5b6b85]">VAT (AED)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={vatAmount}
            onChange={(e) => setVatAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] p-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-[#5b6b85]">Total</label>
          <div className="w-full rounded-lg bg-[#e9eef6] border border-[rgba(176,27,66,0.15)] p-2.5 text-sm font-bold text-[#d9647f]">
            AED {totalAmount.toFixed(2)}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-[#5b6b85]">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Additional details or payment instructions..."
          className="w-full rounded-lg bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] p-2.5 text-sm resize-none"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-3">
        <Link
          href="/vendor-portal"
          className="flex-1 py-2.5 rounded-lg border border-[rgba(176,27,66,0.15)] text-center text-sm font-bold text-[#5b6b85]"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting || !invoiceNumber.trim() || !amount}
          className="flex-1 py-2.5 btn-gold text-sm disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Invoice"}
        </button>
      </div>
    </form>
  );
}
