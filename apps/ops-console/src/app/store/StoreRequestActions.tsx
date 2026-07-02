"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const NEXT_STATUS: Record<string, { label: string; next: string }[]> = {
  requested: [
    { label: "Approve & Start Picking", next: "picking" },
    { label: "Reject", next: "rejected" },
  ],
  approved: [
    { label: "Start Picking", next: "picking" },
  ],
  picking: [
    { label: "Dispatched — Delivering", next: "delivering" },
    { label: "Ready for Pickup", next: "delivering" },
  ],
  delivering: [
    { label: "Mark Delivered", next: "delivered" },
    { label: "Collected by Technician", next: "collected" },
  ],
};

export default function StoreRequestActions({
  requestId,
  currentStatus,
  inventoryItemId,
  quantity,
  unitCost,
}: {
  requestId: string;
  currentStatus: string;
  inventoryItemId: string;
  quantity: number;
  unitCost: number;
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  const actions = NEXT_STATUS[currentStatus];
  if (!actions) return null;

  async function advance(nextStatus: string) {
    setUpdating(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    const update: Record<string, unknown> = { status: nextStatus };
    const isFulfillment = nextStatus === "delivered" || nextStatus === "collected";
    if (isFulfillment) {
      update.fulfilled_by = userData.user?.id;
      update.fulfilled_at = new Date().toISOString();
      update.unit_cost = unitCost;
      update.total_cost = unitCost * quantity;
    }

    await supabase.from("parts_requests").update(update).eq("id", requestId);

    if (isFulfillment && inventoryItemId) {
      await supabase.from("inventory_movements").insert({
        inventory_item_id: inventoryItemId,
        moved_by: userData.user?.id,
        movement_type: "issue",
        quantity: -quantity,
        unit_cost: unitCost,
        total_cost: unitCost * quantity,
        reason: `Parts request ${requestId.slice(0, 8)} fulfilled`,
      });
    }

    setUpdating(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      {actions.map((a) => (
        <button
          key={a.next + a.label}
          onClick={() => advance(a.next)}
          disabled={updating}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 ${
            a.next === "rejected"
              ? "bg-red-900 text-red-300 hover:bg-red-800"
              : "btn-gold"
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
