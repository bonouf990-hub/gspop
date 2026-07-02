"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { checkWorkflow } from "@/lib/workflow";

type BudgetInfo = { total: number; committed: number; remaining: number };

export default function PurchaseOrderActions({
  orderId,
  currentStatus,
  amount,
  budget,
}: {
  orderId: string;
  currentStatus: string;
  amount: number;
  budget?: BudgetInfo | null;
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOver, setConfirmOver] = useState(false);

  // Budget guard: would approving this PO push the building past its budget?
  const overBy = budget && budget.total > 0 ? budget.committed + amount - budget.total : 0;
  const wouldExceed = overBy > 0;

  function handleApprove() {
    if (wouldExceed && !confirmOver) {
      setConfirmOver(true);
      return;
    }
    updateStatus("approved");
  }

  async function updateStatus(status: string) {
    setUpdating(true);
    setError(null);
    const supabase = createClient();

    if (status === "approved" || status === "rejected") {
      const wf = await checkWorkflow(
        supabase,
        "purchase_orders",
        status === "approved" ? "approve" : "reject",
        status === "approved" ? { amount } : undefined
      );
      if (!wf.allowed) {
        setError(wf.reason);
        setUpdating(false);
        return;
      }
    }

    const updateData: Record<string, unknown> = { status };

    if (status === "approved" || status === "rejected" || status === "escalated") {
      const { data: userData } = await supabase.auth.getUser();
      updateData.approved_by = userData.user?.id ?? null;
      updateData.approved_at = new Date().toISOString();
    }

    await supabase
      .from("purchase_orders")
      .update(updateData)
      .eq("id", orderId);
    setUpdating(false);
    setShowEscalate(false);
    router.refresh();
  }

  if (currentStatus === "fulfilled" || currentStatus === "rejected") {
    return null;
  }

  if (currentStatus === "pending") {
    const isHighValue = amount >= 50000;
    return (
      <div className="flex gap-1 flex-wrap justify-end">
        <button
          onClick={handleApprove}
          disabled={updating}
          className={`text-xs font-bold px-2 py-1 rounded disabled:opacity-50 ${wouldExceed ? "bg-amber-600 text-white hover:bg-amber-700" : "bg-green-800 text-green-200 hover:bg-green-700"}`}
        >
          {wouldExceed && confirmOver ? "Approve anyway" : "Approve"}
        </button>
        <button
          onClick={() => updateStatus("rejected")}
          disabled={updating}
          className="text-xs font-bold px-2 py-1 rounded bg-red-900 text-red-700 hover:bg-red-800 disabled:opacity-50"
        >
          Reject
        </button>
        {isHighValue && (
          <button
            onClick={() => setShowEscalate(!showEscalate)}
            disabled={updating}
            className="text-xs font-bold px-2 py-1 rounded bg-[rgba(176,27,66,0.15)] text-[#d9647f] hover:bg-[rgba(176,27,66,0.25)] disabled:opacity-50"
          >
            Escalate
          </button>
        )}
        {showEscalate && (
          <button
            onClick={() => updateStatus("escalated")}
            disabled={updating}
            className="text-xs btn-gold px-2 py-1 disabled:opacity-50"
          >
            Confirm Escalation
          </button>
        )}
        {wouldExceed && (
          <p className="w-full text-right text-[11px] text-amber-700 font-medium mt-0.5">
            ⚠ Over budget by AED {overBy.toLocaleString()} · committed {budget!.committed.toLocaleString()} of {budget!.total.toLocaleString()}
          </p>
        )}
        {error && <span className="text-[#c0304a] text-xs w-full text-right">{error}</span>}
      </div>
    );
  }

  if (currentStatus === "approved") {
    return (
      <button
        onClick={() => updateStatus("fulfilled")}
        disabled={updating}
        className="text-xs btn-gold px-2 py-1 disabled:opacity-50"
      >
        Mark Fulfilled
      </button>
    );
  }

  if (currentStatus === "escalated") {
    return (
      <div className="flex gap-1">
        <button
          onClick={handleApprove}
          disabled={updating}
          className={`text-xs font-bold px-2 py-1 rounded disabled:opacity-50 ${wouldExceed ? "bg-amber-600 text-white hover:bg-amber-700" : "bg-green-800 text-green-200 hover:bg-green-700"}`}
        >
          {wouldExceed && confirmOver ? "Approve anyway" : "Approve"}
        </button>
        <button
          onClick={() => updateStatus("rejected")}
          disabled={updating}
          className="text-xs font-bold px-2 py-1 rounded bg-red-900 text-red-700 hover:bg-red-800 disabled:opacity-50"
        >
          Reject
        </button>
        {wouldExceed && (
          <span className="w-full text-[11px] text-amber-700 font-medium">
            ⚠ Over budget by AED {overBy.toLocaleString()}
          </span>
        )}
        {error && <span className="text-[#c0304a] text-xs">{error}</span>}
      </div>
    );
  }

  return null;
}
