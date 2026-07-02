"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { checkWorkflow } from "@/lib/workflow";

const PAYMENT_METHODS = ["cheque", "bank_transfer", "cash", "credit_card"];

export default function InvoiceActions({
  invoiceId,
  currentStatus,
}: {
  invoiceId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [acting, setActing] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [payForm, setPayForm] = useState({ method: "bank_transfer", reference: "" });
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(status: string) {
    setActing(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    const wfAction =
      status === "verified" ? "verify" : status === "approved" ? "approve" : null;
    if (wfAction) {
      const wf = await checkWorkflow(supabase, "invoices", wfAction);
      if (!wf.allowed) {
        setError(wf.reason);
        setActing(false);
        return;
      }
    }

    const update: Record<string, unknown> = { status };
    if (status === "verified") {
      update.verified_by = userData.user?.id;
      update.verified_at = new Date().toISOString();
    }

    await supabase.from("invoices").update(update).eq("id", invoiceId);
    setActing(false);
    router.refresh();
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    setActing(true);
    setError(null);
    const supabase = createClient();

    const wf = await checkWorkflow(supabase, "invoices", "record_payment");
    if (!wf.allowed) {
      setError(wf.reason);
      setActing(false);
      return;
    }

    await supabase.from("invoices").update({
      status: "paid",
      payment_method: payForm.method,
      payment_reference: payForm.reference || null,
      paid_at: new Date().toISOString(),
    }).eq("id", invoiceId);
    setActing(false);
    setShowPay(false);
    router.refresh();
  }

  if (showPay) {
    const input = "bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-1.5 text-xs text-[#f0ece4]";
    return (
      <form onSubmit={handlePay} className="flex flex-col gap-1">
        <select className={input} value={payForm.method}
          onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
          ))}
        </select>
        <input className={input} placeholder="Reference #" value={payForm.reference}
          onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
        <div className="flex gap-1">
          <button type="submit" disabled={acting}
            className="text-[10px] font-bold px-2 py-1 rounded bg-green-800 text-green-200 disabled:opacity-50">
            Confirm
          </button>
          <button type="button" onClick={() => setShowPay(false)}
            className="text-[10px] px-2 py-1 rounded bg-[#213052] text-[#a0977e]">
            Cancel
          </button>
        </div>
        {error && <p className="text-[#e08a8a] text-xs">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {currentStatus === "received" && (
        <>
          <button onClick={() => updateStatus("verified")} disabled={acting}
            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-green-800 text-green-200 disabled:opacity-50">
            Verify
          </button>
          <button onClick={() => updateStatus("disputed")} disabled={acting}
            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-800 text-red-200 disabled:opacity-50">
            Dispute
          </button>
        </>
      )}
      {currentStatus === "verified" && (
        <button onClick={() => updateStatus("approved")} disabled={acting}
          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[rgba(184,144,47,0.2)] text-[#d4af5a] disabled:opacity-50">
          Approve
        </button>
      )}
      {currentStatus === "disputed" && (
        <button onClick={() => updateStatus("verified")} disabled={acting}
          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-green-800 text-green-200 disabled:opacity-50">
          Resolve
        </button>
      )}
      {currentStatus === "approved" && (
        <button onClick={() => setShowPay(true)} disabled={acting}
          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#b8902f] text-[#0f1626] disabled:opacity-50">
          Record Payment
        </button>
      )}
      {error && <p className="text-[#e08a8a] text-xs">{error}</p>}
    </div>
  );
}
