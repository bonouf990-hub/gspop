"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Props = {
  id: string;
  currentStatus: string;
  startedAt: string | null;
};

const STATUS_TRANSITIONS: Record<string, { label: string; next: string; style: string }[]> = {
  draft: [
    { label: "Assign & Open", next: "assigned", style: "bg-[#b8902f] text-[#0f1626]" },
    { label: "Cancel", next: "cancelled", style: "bg-[#213052] text-[#6b6454]" },
  ],
  assigned: [
    { label: "Start Work", next: "in_progress", style: "bg-green-800 text-green-200" },
    { label: "Cancel", next: "cancelled", style: "bg-[#213052] text-[#6b6454]" },
  ],
  in_progress: [
    { label: "Complete Job", next: "completed_by_technician", style: "bg-green-800 text-green-200" },
    { label: "Pause", next: "paused", style: "bg-amber-800 text-amber-200" },
  ],
  paused: [
    { label: "Resume Work", next: "in_progress", style: "bg-green-800 text-green-200" },
    { label: "Cancel", next: "cancelled", style: "bg-[#213052] text-[#6b6454]" },
  ],
  completed_by_technician: [
    { label: "Supervisor Verify", next: "verified_by_supervisor", style: "bg-[#b8902f] text-[#0f1626]" },
    { label: "Reopen", next: "in_progress", style: "bg-amber-800 text-amber-200" },
  ],
  verified_by_supervisor: [
    { label: "Resident Confirmed", next: "confirmed_by_resident", style: "bg-green-800 text-green-200" },
    { label: "Close Job", next: "closed", style: "bg-[#213052] text-[#a0977e]" },
  ],
  confirmed_by_resident: [
    { label: "Close Job", next: "closed", style: "bg-[#213052] text-[#a0977e]" },
  ],
  pending_approval: [
    { label: "Approve", next: "approved", style: "bg-green-800 text-green-200" },
    { label: "Reject", next: "rejected", style: "bg-red-800 text-red-200" },
  ],
  approved: [
    { label: "Assign & Start", next: "assigned", style: "bg-[#b8902f] text-[#0f1626]" },
  ],
  rejected: [],
  closed: [],
  cancelled: [],
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  assigned: "Assigned",
  in_progress: "In Progress",
  paused: "Paused",
  completed_by_technician: "Completed by Technician",
  verified_by_supervisor: "Verified by Supervisor",
  confirmed_by_resident: "Confirmed by Resident",
  closed: "Closed",
  cancelled: "Cancelled",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[#213052] text-[#a0977e]",
  pending_approval: "bg-amber-900/60 text-amber-300",
  approved: "bg-green-900/40 text-green-300",
  rejected: "bg-red-900/40 text-red-300",
  assigned: "bg-blue-900/40 text-blue-300",
  in_progress: "bg-green-900/60 text-green-300",
  paused: "bg-amber-900/40 text-amber-300",
  completed_by_technician: "bg-[rgba(184,144,47,0.12)] text-[#d4af5a]",
  verified_by_supervisor: "bg-green-900/40 text-green-300",
  confirmed_by_resident: "bg-green-900/60 text-green-300",
  closed: "bg-[#213052] text-[#6b6454]",
  cancelled: "bg-red-900/20 text-red-400",
};

export default function WorkOrderStatusControl({ id, currentStatus, startedAt }: Props) {
  const router = useRouter();
  const [acting, setActing] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState({ rating: 5, comment: "" });
  const [error, setError] = useState<string | null>(null);

  const transitions = STATUS_TRANSITIONS[currentStatus] ?? [];

  async function updateStatus(nextStatus: string) {
    if (nextStatus === "completed_by_technician") {
      setShowFeedback(true);
      return;
    }
    await doUpdate(nextStatus);
  }

  async function doUpdate(nextStatus: string, residentFeedback?: { rating: number; comment: string }) {
    setActing(true);
    setError(null);
    const supabase = createClient();

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { status: nextStatus, updated_at: now };

    if (nextStatus === "in_progress" && !startedAt) {
      update.started_at = now;
    }
    if (nextStatus === "completed_by_technician") {
      update.completed_at = now;
      if (startedAt) {
        const hours = (Date.now() - new Date(startedAt).getTime()) / 3_600_000;
        update.hours_worked = Math.round(hours * 100) / 100;
      }
    }

    const { error: err } = await supabase
      .from("work_orders")
      .update(update)
      .eq("id", id);

    if (err) {
      setActing(false);
      return setError(err.message);
    }

    if (residentFeedback && residentFeedback.comment) {
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("tenant_id")
        .eq("id", userData.user?.id ?? "")
        .single();

      await supabase.from("activity_log").insert({
        tenant_id: profile?.tenant_id,
        user_id: userData.user?.id,
        user_name: null,
        action: "completed",
        entity_type: "work_order",
        entity_id: id,
        entity_label: null,
        details: {
          resident_rating: residentFeedback.rating,
          resident_feedback: residentFeedback.comment,
          status_from: currentStatus,
          status_to: nextStatus,
        },
      });
    }

    setActing(false);
    setShowFeedback(false);
    router.refresh();
  }

  async function handleCompleteWithFeedback() {
    await doUpdate("completed_by_technician", feedback);
  }

  const input = "w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2 text-sm text-[#f0ece4]";

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${STATUS_STYLE[currentStatus] ?? ""}`}>
          {STATUS_LABEL[currentStatus] ?? currentStatus.replace(/_/g, " ")}
        </span>

        {transitions.map((t) => (
          <button
            key={t.next}
            onClick={() => updateStatus(t.next)}
            disabled={acting}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 ${t.style}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

      {showFeedback && (
        <div className="mt-4 border border-[rgba(184,144,47,0.15)] rounded-xl p-4 bg-[#0f1626]">
          <h3 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
            Job Completion — Resident Feedback
          </h3>
          <p className="text-xs text-[#a0977e] mb-3">
            Capture feedback from the resident before closing the job card. Skip if resident is unavailable.
          </p>

          <div className="mb-3">
            <label className="text-xs text-[#a0977e] mb-1 block">Resident Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFeedback({ ...feedback, rating: star })}
                  className={`w-8 h-8 rounded-lg text-sm font-bold ${
                    star <= feedback.rating
                      ? "bg-[#b8902f] text-[#0f1626]"
                      : "bg-[#213052] text-[#6b6454]"
                  }`}
                >
                  {star}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <label className="text-xs text-[#a0977e] mb-1 block">Resident Comments (optional)</label>
            <textarea
              className={input}
              rows={2}
              placeholder="Any feedback from the resident…"
              value={feedback.comment}
              onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCompleteWithFeedback}
              disabled={acting}
              className="bg-green-800 text-green-200 text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {acting ? "Saving…" : "Complete with Feedback"}
            </button>
            <button
              onClick={() => doUpdate("completed_by_technician")}
              disabled={acting}
              className="bg-[#213052] text-[#a0977e] text-xs font-medium px-4 py-2 rounded-lg disabled:opacity-50"
            >
              Skip — Resident Unavailable
            </button>
            <button
              onClick={() => setShowFeedback(false)}
              className="text-xs text-[#6b6454] px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 text-[10px] text-[#6b6454]">
        <span className="font-bold">Flow:</span>{" "}
        Draft → Assigned → In Progress → Completed → Supervisor Verify → Resident Confirm → Closed
      </div>
    </div>
  );
}
