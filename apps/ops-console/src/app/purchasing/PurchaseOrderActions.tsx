"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function PurchaseOrderActions({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  async function updateStatus(status: string) {
    setUpdating(true);
    const supabase = createClient();
    await supabase
      .from("purchase_orders")
      .update({ status })
      .eq("id", orderId);
    setUpdating(false);
    router.refresh();
  }

  if (currentStatus === "fulfilled" || currentStatus === "rejected") {
    return null;
  }

  if (currentStatus === "pending") {
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
      </div>
    );
  }

  if (currentStatus === "approved") {
    return (
      <button
        onClick={() => updateStatus("fulfilled")}
        disabled={updating}
        className="text-xs font-bold px-2 py-1 rounded bg-[#b8902f] text-[#0f1626] disabled:opacity-50"
      >
        Mark Fulfilled
      </button>
    );
  }

  return null;
}
