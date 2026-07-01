"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

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

  async function handleDecide() {
    if (!winnerId) return;
    setSaving(true);
    const supabase = createClient();
    const winner = submissions.find((s) => s.id === winnerId);

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
    <div className="border border-[#b8902f] bg-[rgba(184,144,47,0.08)] rounded-xl p-4">
      <h3 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-2">
        Select Tender Winner
      </h3>
      <p className="text-xs text-[#a0977e] mb-3">
        Confirming a winner will notify the purchasing department to issue a purchase order.
      </p>
      <div className="flex gap-2 items-center">
        <select
          value={winnerId}
          onChange={(e) => setWinnerId(e.target.value)}
          className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm flex-1"
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
    </div>
  );
}
