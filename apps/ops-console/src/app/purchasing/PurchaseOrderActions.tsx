"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { checkWorkflow } from "@/lib/workflow";

export default function PurchaseOrderActions({
  orderId,
  currentStatus,
  amount,
}: {
  orderId: string;
  currentStatus: string;
  amount: number;
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          onClick={() => updateStatus("approved")}
          disabled={updating}
          className="text-xs font-bold px-2 py-1 rounded bg-green-800 text-green-200 hover:bg-green-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => updateStatus("rejected")}
          disabled={updating}
          className="text-xs font-bold px-2 py-1 rounded bg-red-900 text-red-300 hover:bg-red-800 disabled:opacity-50"
        >
          Reject
        </button>
        {isHighValue && (
          <button
            onClick={() => setShowEscalate(!showEscalate)}
            disabled={updating}
            className="text-xs font-bold px-2 py-1 rounded bg-[rgba(184,144,47,0.15)] text-[#d4af5a] hover:bg-[rgba(184,144,47,0.25)] disabled:opacity-50"
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
        {error && <span className="text-[#e08a8a] text-xs w-full text-right">{error}</span>}
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
          onClick={() => updateStatus("approved")}
          disabled={updating}
          className="text-xs font-bold px-2 py-1 rounded bg-green-800 text-green-200 hover:bg-green-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => updateStatus("rejected")}
          disabled={updating}
          className="text-xs font-bold px-2 py-1 rounded bg-red-900 text-red-300 hover:bg-red-800 disabled:opacity-50"
        >
          Reject
        </button>
        {error && <span className="text-[#e08a8a] text-xs">{error}</span>}
      </div>
    );
  }

  return null;
}
