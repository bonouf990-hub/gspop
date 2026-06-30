"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function VisitorActions({
  visitorId,
  hostResidentId,
  guestName,
  status,
}: {
  visitorId: string;
  hostResidentId: string | null;
  guestName: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function notifyResident(type: "visitor_arrived" | "visitor_declined", message: string) {
    if (!hostResidentId) return;
    const supabase = createClient();
    await supabase.from("notifications").insert({
      recipient_id: hostResidentId,
      type,
      entity_type: "visitor",
      entity_id: visitorId,
      message,
    });
  }

  async function handleCheckIn() {
    setBusy(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    await supabase
      .from("visitors")
      .update({
        status: "checked_in",
        checked_in_at: new Date().toISOString(),
        checked_in_by: userData.user?.id,
      })
      .eq("id", visitorId);
    await notifyResident("visitor_arrived", `${guestName} has arrived at the gate`);
    setBusy(false);
    router.refresh();
  }

  async function handleCheckOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("visitors")
      .update({ status: "checked_out", checked_out_at: new Date().toISOString() })
      .eq("id", visitorId);
    setBusy(false);
    router.refresh();
  }

  async function handleDecline() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("visitors").update({ status: "declined" }).eq("id", visitorId);
    await notifyResident("visitor_declined", `${guestName} was declined entry by security`);
    setBusy(false);
    router.refresh();
  }

  if (status === "invited") {
    return (
      <div className="flex gap-2">
        <button
          onClick={handleCheckIn}
          disabled={busy}
          className="bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          Check In
        </button>
        <button
          onClick={handleDecline}
          disabled={busy}
          className="bg-red-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    );
  }

  if (status === "checked_in") {
    return (
      <button
        onClick={handleCheckOut}
        disabled={busy}
        className="bg-gray-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
      >
        Check Out
      </button>
    );
  }

  return null;
}
