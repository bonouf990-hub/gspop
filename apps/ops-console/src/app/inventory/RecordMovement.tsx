"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const MOVEMENT_TYPES = [
  { value: "receipt", label: "Receipt (stock in)" },
  { value: "issue", label: "Issue (stock out)" },
  { value: "adjustment", label: "Adjustment" },
  { value: "return", label: "Return" },
];

export default function RecordMovement({
  itemId,
  itemName,
}: {
  itemId: string;
  itemName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("issue");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quantity || Number(quantity) <= 0) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();
    const qty = Number(quantity);

    const { error: movErr } = await supabase.from("inventory_movements").insert({
      inventory_item_id: itemId,
      moved_by: userData.user?.id,
      movement_type: type,
      quantity: type === "issue" ? -qty : qty,
      reason: reason || null,
    });

    if (movErr) {
      setError(movErr.message);
      setSubmitting(false);
      return;
    }

    const delta = type === "issue" ? -qty : qty;
    const { error: rpcErr } = await supabase.rpc("increment_inventory", { item_id: itemId, delta });
    if (rpcErr) {
      await supabase
        .from("inventory_items")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", itemId);
    }

    setSubmitting(false);
    setOpen(false);
    setQuantity("");
    setReason("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-[#d4af5a] hover:underline"
      >
        Record
      </button>
    );
  }

  const input = "w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2 text-sm text-[#f0ece4]";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="lux-card p-5 space-y-3 w-80">
        <h3 className="eyebrow mb-1">
          Stock Movement
        </h3>
        <p className="text-sm text-[#a0977e] mb-2">{itemName}</p>

        <select className={input} value={type} onChange={(e) => setType(e.target.value)}>
          {MOVEMENT_TYPES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <input className={input} type="number" placeholder="Quantity" min="0.01" step="any"
          value={quantity} onChange={(e) => setQuantity(e.target.value)} required />

        <input className={input} placeholder="Reason (optional)"
          value={reason} onChange={(e) => setReason(e.target.value)} />

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={submitting}
            className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
            {submitting ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="bg-[#213052] text-sm font-medium px-4 py-2 rounded-lg text-[#a0977e]">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
