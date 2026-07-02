"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { checkWorkflow } from "@/lib/workflow";

type Tech = { id: string; fullName: string; trade: string | null };

export default function AssignTechnicianControl({
  workOrderId,
  currentTechId,
  technicians,
}: {
  workOrderId: string;
  currentTechId: string | null;
  technicians: Tech[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentTechId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const wf = await checkWorkflow(supabase, "work_orders", "assign");
    if (!wf.allowed) {
      setSaving(false);
      return setError(wf.reason);
    }

    const update: Record<string, unknown> = {
      assigned_technician_id: selected || null,
    };
    if (selected && !currentTechId) {
      update.status = "assigned";
    }
    const { error: err } = await supabase
      .from("work_orders")
      .update(update)
      .eq("id", workOrderId);
    setSaving(false);
    if (err) return setError(err.message);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2 text-sm flex-1 text-[#f0ece4]"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Unassigned</option>
        {technicians.map((t) => (
          <option key={t.id} value={t.id}>
            {t.fullName}
            {t.trade ? ` (${t.trade})` : ""}
          </option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={saving || selected === (currentTechId ?? "")}
        className="btn-gold text-sm px-4 py-2 disabled:opacity-40"
      >
        {saving ? "Saving…" : "Assign"}
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}
