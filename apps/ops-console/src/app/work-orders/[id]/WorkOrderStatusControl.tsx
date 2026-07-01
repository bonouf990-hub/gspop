"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "assigned",
  "in_progress",
  "paused",
  "completed_by_technician",
  "verified_by_supervisor",
  "confirmed_by_resident",
  "closed",
  "cancelled",
];

export default function WorkOrderStatusControl({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("work_orders")
      .update({ status })
      .eq("id", id);
    setSaving(false);
    if (err) return setError(err.message);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2 text-sm capitalize text-[#f0ece4]"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={saving || status === currentStatus}
        className="bg-[#b8902f] text-[#0f1626] text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-40"
      >
        {saving ? "Saving…" : "Update"}
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}
