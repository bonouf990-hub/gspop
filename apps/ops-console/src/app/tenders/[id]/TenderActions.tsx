"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const NEXT_ACTIONS: Record<string, { label: string; next: string; color: string }[]> = {
  draft: [
    { label: "Publish Tender", next: "published", color: "bg-green-800 text-green-200" },
    { label: "Cancel", next: "cancelled", color: "bg-red-900 text-red-700" },
  ],
  published: [
    { label: "Schedule Site Visit", next: "site_visit", color: "btn-gold" },
    { label: "Open Submissions", next: "submissions_open", color: "bg-green-800 text-green-200" },
    { label: "Cancel", next: "cancelled", color: "bg-red-900 text-red-700" },
  ],
  site_visit: [
    { label: "Open Submissions", next: "submissions_open", color: "bg-green-800 text-green-200" },
  ],
  submissions_open: [
    { label: "Close Submissions", next: "closed", color: "bg-amber-800 text-amber-800" },
  ],
  closed: [
    { label: "Begin Evaluation", next: "evaluating", color: "btn-gold" },
  ],
  evaluating: [],
};

export default function TenderActions({
  tenderId,
  currentStatus,
}: {
  tenderId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  const actions = NEXT_ACTIONS[currentStatus];
  if (!actions || actions.length === 0) return null;

  async function advance(nextStatus: string) {
    setUpdating(true);
    const supabase = createClient();
    await supabase.from("tenders").update({ status: nextStatus }).eq("id", tenderId);
    setUpdating(false);
    router.refresh();
  }

  return (
    <div className="flex gap-1">
      {actions.map((a) => (
        <button
          key={a.next}
          onClick={() => advance(a.next)}
          disabled={updating}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 ${a.color}`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
