"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const NEXT_STATUSES: Record<string, { label: string; value: string }[]> = {
  not_started: [
    { label: "Send Renewal Notice", value: "notice_sent" },
    { label: "Mark Not Renewing", value: "not_renewing" },
  ],
  notice_sent: [
    { label: "Start Negotiation", value: "negotiating" },
    { label: "Mark Not Renewing", value: "not_renewing" },
  ],
  negotiating: [
    { label: "Mark as Renewed", value: "renewed" },
    { label: "Mark Not Renewing", value: "not_renewing" },
  ],
  not_renewing: [
    { label: "Re-open Negotiation", value: "negotiating" },
  ],
  renewed: [],
};

export default function RenewalActions({
  leaseId,
  currentStatus,
  residentName,
}: {
  leaseId: string;
  currentStatus: string;
  residentName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const actions = NEXT_STATUSES[currentStatus] ?? [];

  async function updateStatus(newStatus: string) {
    setBusy(true);
    const supabase = createClient();
    const updateData: Record<string, unknown> = {
      renewal_status: newStatus,
      renewal_decision_at: new Date().toISOString(),
    };
    if (newStatus === "notice_sent") {
      updateData.renewal_notice_sent_at = new Date().toISOString();
    }
    if (notes.trim()) {
      updateData.renewal_notes = notes.trim();
    }

    await supabase.from("leases").update(updateData).eq("id", leaseId);
    setBusy(false);
    setShowNotes(false);
    setNotes("");
    router.refresh();
  }

  if (actions.length === 0) return null;

  return (
    <div>
      {showNotes && (
        <div className="mb-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={`Notes about ${residentName}'s renewal...`}
            rows={2}
            className="w-full rounded-lg bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] p-2 text-sm resize-none"
          />
        </div>
      )}
      <div className="flex gap-2">
        {!showNotes && (
          <button
            onClick={() => setShowNotes(true)}
            className="text-xs font-bold px-3 py-2 rounded-lg bg-[#e9eef6] text-[#5b6b85] hover:bg-[rgba(176,27,66,0.12)]"
          >
            + Add Note
          </button>
        )}
        {actions.map((a) => (
          <button
            key={a.value}
            onClick={() => updateStatus(a.value)}
            disabled={busy}
            className={`text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50 ${
              a.value === "not_renewing"
                ? "bg-red-50 text-red-700 hover:bg-red-900"
                : a.value === "renewed"
                ? "bg-green-50 text-green-700 hover:bg-green-900"
                : "bg-[#b01b42]/20 text-[#d9647f] hover:bg-[#b01b42]/30"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
