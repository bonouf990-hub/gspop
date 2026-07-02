"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const STATUSES = [
  "submitted",
  "acknowledged",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
  "rejected",
];

export default function ComplaintStatusControl({
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
    const patch: Record<string, unknown> = { status };
    if (status === "acknowledged") patch.acknowledged_at = new Date().toISOString();
    if (status === "resolved" || status === "closed") patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("complaints").update(patch).eq("id", id);
    setSaving(false);
    if (error) return setError(error.message);
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
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={saving || status === currentStatus}
        className="btn-gold text-sm px-4 py-2 disabled:opacity-40"
      >
        {saving ? "Saving…" : "Update status"}
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}
