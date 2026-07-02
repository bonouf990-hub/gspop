"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type ChecklistItem = {
  id: string;
  item_name: string;
  condition: string;
  notes: string | null;
  photo_path: string | null;
};

type Checklist = {
  id: string;
  checklist_type: string;
  performed_by: string | null;
  created_at: string;
  performer: { full_name: string } | null;
  items: ChecklistItem[];
};

const DEFAULT_ITEMS = [
  "Front door & lock",
  "Living room — walls & ceiling",
  "Living room — flooring",
  "Kitchen — cabinets & countertop",
  "Kitchen — appliances (oven, hood, dishwasher)",
  "Kitchen — plumbing & fixtures",
  "Master bedroom — walls & flooring",
  "Master bedroom — wardrobe",
  "Bedroom 2 — walls & flooring",
  "Master bathroom — fixtures & tiles",
  "Master bathroom — plumbing",
  "Guest bathroom — fixtures & tiles",
  "AC units — all rooms",
  "Electrical — switches & outlets",
  "Balcony / terrace",
  "Windows & blinds",
  "Light fixtures",
  "Water heater",
  "Smoke detectors",
  "Keys & access cards",
];

const CONDITION_COLORS: Record<string, string> = {
  good: "text-green-400",
  fair: "text-amber-400",
  damaged: "text-red-400",
  missing: "text-red-400",
};

export default function ChecklistManager({
  leaseId,
  userId,
  checklists,
}: {
  leaseId: string;
  userId: string;
  checklists: Checklist[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [checklistType, setChecklistType] = useState<"move_in" | "move_out">("move_in");
  const [items, setItems] = useState<{ name: string; condition: string; notes: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startChecklist(type: "move_in" | "move_out") {
    setChecklistType(type);
    setItems(DEFAULT_ITEMS.map((name) => ({ name, condition: "good", notes: "" })));
    setCreating(true);
  }

  function updateItem(index: number, field: "condition" | "notes", value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addCustomItem() {
    setItems((prev) => [...prev, { name: "", condition: "good", notes: "" }]);
  }

  function updateItemName(index: number, name: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, name } : item)));
  }

  async function saveChecklist() {
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) return;

    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { data: checklist, error: clErr } = await supabase
      .from("move_checklists")
      .insert({
        lease_id: leaseId,
        checklist_type: checklistType,
        performed_by: userId,
      })
      .select("id")
      .single();

    if (clErr || !checklist) {
      setBusy(false);
      setError(clErr?.message ?? "Failed to create checklist");
      return;
    }

    const { error: itemsErr } = await supabase.from("move_checklist_items").insert(
      validItems.map((item) => ({
        move_checklist_id: checklist.id,
        item_name: item.name.trim(),
        condition: item.condition,
        notes: item.notes.trim() || null,
      }))
    );

    setBusy(false);
    if (itemsErr) {
      setError(itemsErr.message);
      return;
    }
    setCreating(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!creating && (
        <div className="flex gap-3">
          <button
            onClick={() => startChecklist("move_in")}
            className="px-4 py-2.5 btn-gold text-sm"
          >
            + New Move-In Checklist
          </button>
          <button
            onClick={() => startChecklist("move_out")}
            className="px-4 py-2.5 rounded-lg bg-[#213052] text-[#d4af5a] text-sm font-bold"
          >
            + New Move-Out Checklist
          </button>
        </div>
      )}

      {creating && (
        <div className="lux-card p-5">
          <h2 className="eyebrow mb-4">
            New {checklistType === "move_in" ? "Move-In" : "Move-Out"} Inspection
          </h2>
          <div className="space-y-2 mb-4">
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-2 bg-[#0f1626] rounded-lg p-3">
                <div className="flex-1">
                  {DEFAULT_ITEMS.includes(item.name) ? (
                    <p className="text-sm font-medium">{item.name}</p>
                  ) : (
                    <input
                      value={item.name}
                      onChange={(e) => updateItemName(i, e.target.value)}
                      placeholder="Item name..."
                      className="w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm font-medium mb-1"
                    />
                  )}
                  <input
                    value={item.notes}
                    onChange={(e) => updateItem(i, "notes", e.target.value)}
                    placeholder="Notes (optional)..."
                    className="w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm text-[#a0977e] mt-1"
                  />
                </div>
                <select
                  value={item.condition}
                  onChange={(e) => updateItem(i, "condition", e.target.value)}
                  className={`text-xs font-bold rounded-lg bg-[#1a2640] border border-[rgba(184,144,47,0.15)] px-2 py-1 ${CONDITION_COLORS[item.condition] ?? ""}`}
                >
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="damaged">Damaged</option>
                  <option value="missing">Missing</option>
                </select>
              </div>
            ))}
          </div>
          <button
            onClick={addCustomItem}
            className="text-xs text-[#d4af5a] hover:underline mb-4 block"
          >
            + Add custom item
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setCreating(false)}
              className="flex-1 py-2 rounded-lg border border-[rgba(184,144,47,0.15)] text-sm font-bold text-[#a0977e]"
            >
              Cancel
            </button>
            <button
              onClick={saveChecklist}
              disabled={busy}
              className="flex-1 py-2 btn-gold text-sm disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save Checklist"}
            </button>
          </div>
        </div>
      )}

      {/* Existing Checklists */}
      {checklists.length > 0 && (
        <section>
          <h2 className="eyebrow mb-3">
            Previous Checklists ({checklists.length})
          </h2>
          <div className="space-y-3">
            {checklists.map((cl) => {
              const damaged = cl.items.filter((i) => i.condition === "damaged" || i.condition === "missing");
              return (
                <div key={cl.id} className="lux-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        cl.checklist_type === "move_in" ? "bg-green-900/50 text-green-300" : "bg-amber-900/50 text-amber-300"
                      }`}>
                        {cl.checklist_type === "move_in" ? "Move-In" : "Move-Out"}
                      </span>
                      <span className="text-xs text-[#6b6454] ml-2">
                        {new Date(cl.created_at).toLocaleDateString()}
                        {cl.performer && ` · by ${cl.performer.full_name}`}
                      </span>
                    </div>
                    {damaged.length > 0 && (
                      <span className="text-xs font-bold text-red-400">
                        {damaged.length} issue{damaged.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {cl.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-sm py-1">
                        <span className={`w-2 h-2 rounded-full ${
                          item.condition === "good" ? "bg-green-400"
                            : item.condition === "fair" ? "bg-amber-400"
                            : "bg-red-400"
                        }`} />
                        <span className={item.condition === "good" ? "text-[#a0977e]" : ""}>
                          {item.item_name}
                        </span>
                        <span className={`text-[10px] capitalize ${CONDITION_COLORS[item.condition] ?? ""}`}>
                          {item.condition !== "good" && item.condition}
                        </span>
                        {item.notes && (
                          <span className="text-[10px] text-[#6b6454]">— {item.notes}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
