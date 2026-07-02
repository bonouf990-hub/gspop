"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function ApprovalDecision({
  approvalId,
  currentDecision,
}: {
  approvalId: string;
  currentDecision: string;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approved" | "rejected") {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("approvals")
      .update({
        decision,
        comment: comment || null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", approvalId);
    setSaving(false);
    if (err) return setError(err.message);
    router.refresh();
  }

  if (currentDecision !== "pending") {
    return (
      <span
        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          currentDecision === "approved"
            ? "bg-green-900 text-green-300"
            : currentDecision === "rejected"
              ? "bg-red-900 text-red-300"
              : "bg-amber-900 text-amber-300"
        }`}
      >
        {currentDecision}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-2 py-1 text-xs text-[#f0ece4] w-36"
        placeholder="Comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button
        onClick={() => decide("approved")}
        disabled={saving}
        className="text-xs font-bold px-3 py-1 rounded-lg bg-green-800 text-green-200 hover:bg-green-700 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        onClick={() => decide("rejected")}
        disabled={saving}
        className="text-xs font-bold px-3 py-1 rounded-lg bg-red-900 text-red-300 hover:bg-red-800 disabled:opacity-50"
      >
        Reject
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}
