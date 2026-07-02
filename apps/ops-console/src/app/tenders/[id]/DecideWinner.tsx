"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { checkWorkflow } from "@/lib/workflow";

export default function DecideWinner({
  tenderId,
  currency,
  submissions,
}: {
  tenderId: string;
  currency: string;
  submissions: {
    id: string;
    vendor_name: string;
    vendor_id: string | null;
    ai_score: number | null;
    proposed_amount: number;
  }[];
}) {
  const router = useRouter();
  const [winnerId, setWinnerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDecide() {
    if (!winnerId) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const winner = submissions.find((s) => s.id === winnerId);

    const wf = await checkWorkflow(supabase, "tenders", "decide_winner", {
      amount: winner ? Number(winner.proposed_amount) : undefined,
    });
    if (!wf.allowed) {
      setError(wf.reason);
      setSaving(false);
      return;
    }

    await supabase
      .from("tender_submissions")
      .update({ status: "rejected" })
      .eq("tender_id", tenderId)
      .neq("id", winnerId);

    await supabase
      .from("tender_submissions")
      .update({ status: "winner" })
      .eq("id", winnerId);

    await supabase
      .from("tenders")
      .update({
        status: "decided",
        decided_vendor_id: winner?.vendor_id ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", tenderId);

    setSaving(false);
    router.refresh();
  }

  return (
    <div className="border border-[#b01b42] bg-[rgba(176,27,66,0.08)] rounded-xl p-4">
      <h3 className="eyebrow mb-2">
        Select Tender Winner
      </h3>
      <p className="text-xs text-[#5b6b85] mb-3">
        Confirming a winner will notify the purchasing department to issue a purchase order.
      </p>
      <div className="flex gap-2 items-center">
        <select
          value={winnerId}
          onChange={(e) => setWinnerId(e.target.value)}
          className="bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] rounded-lg px-3 py-2 text-sm flex-1"
        >
          <option value="">Select winning vendor…</option>
          {submissions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.vendor_name}
              {s.ai_score !== null && ` (Score: ${Number(s.ai_score).toFixed(0)})`}
              {` — ${currency} ${Number(s.proposed_amount).toLocaleString()}`}
            </option>
          ))}
        </select>
        <button
          onClick={handleDecide}
          disabled={saving || !winnerId}
          className="text-xs font-bold px-4 py-2 rounded-lg bg-green-800 text-green-200 disabled:opacity-50"
        >
          {saving ? "Deciding…" : "Confirm Winner"}
        </button>
      </div>
      {error && <p className="text-[#c0304a] text-xs mt-2">{error}</p>}
    </div>
  );
}
