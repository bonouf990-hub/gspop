"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type InventoryItem = {
  id: string;
  name: string;
  sku: string | null;
  quantity_on_hand: number;
  unit_of_measure: string | null;
};

export default function RequestParts({
  workOrderId,
  propertyId,
  items,
}: {
  workOrderId: string;
  propertyId: string;
  items: InventoryItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [deliveryMethod, setDeliveryMethod] = useState("deliver");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemId) return;
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

    const { error: insErr } = await supabase.from("parts_requests").insert({
      work_order_id: workOrderId,
      inventory_item_id: itemId,
      requested_by: userId,
      quantity: Number(quantity),
      delivery_method: deliveryMethod,
      delivery_location: deliveryLocation || null,
      notes: notes || null,
      status: "requested",
    });

    setSubmitting(false);
    if (insErr) return setError(insErr.message);

    setOpen(false);
    setItemId("");
    setQuantity("1");
    setNotes("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#b8902f] text-[#0f1626]"
      >
        + Request Parts
      </button>
    );
  }

  const selectedItem = items.find((i) => i.id === itemId);
  const input = "w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2.5 text-sm text-[#f0ece4]";

  return (
    <form onSubmit={handleSubmit} className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 space-y-3">
      <h3 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-2">
        Request Parts from Store
      </h3>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Item *</label>
        <select
          className={input}
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          required
        >
          <option value="">Select item…</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.sku ? ` (${item.sku})` : ""}
              {` — ${Number(item.quantity_on_hand)} ${item.unit_of_measure ?? "units"} available`}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Quantity *</label>
          <input
            className={input}
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          {selectedItem && Number(quantity) > Number(selectedItem.quantity_on_hand) && (
            <p className="text-[10px] text-amber-400 mt-1">
              Exceeds available stock ({Number(selectedItem.quantity_on_hand)} available)
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Delivery Method *</label>
          <select
            className={input}
            value={deliveryMethod}
            onChange={(e) => setDeliveryMethod(e.target.value)}
          >
            <option value="deliver">Deliver to site</option>
            <option value="pickup">Pickup from store</option>
          </select>
        </div>
      </div>

      {deliveryMethod === "deliver" && (
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Delivery Location</label>
          <input
            className={input}
            placeholder="e.g. Building A, Floor 3, Unit 301"
            value={deliveryLocation}
            onChange={(e) => setDeliveryLocation(e.target.value)}
          />
        </div>
      )}

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Notes</label>
        <input
          className={input}
          placeholder="Any special instructions…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="bg-[#b8902f] text-[#0f1626] text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Request"}
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
