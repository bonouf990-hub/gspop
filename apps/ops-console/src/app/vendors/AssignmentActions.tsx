"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function AssignmentActions({
  assignmentId,
  status,
}: {
  assignmentId: string;
  status: string;
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  if (status === "completed" || status === "cancelled") return null;

  async function updateStatus(next: string) {
    setUpdating(true);
    const supabase = createClient();
    const update: Record<string, unknown> = { status: next };
    if (next === "completed") {
      update.actual_end_date = new Date().toISOString().split("T")[0];
    }
    await supabase.from("vendor_assignments").update(update).eq("id", assignmentId);
    setUpdating(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => updateStatus("completed")}
        disabled={updating}
        className="text-xs font-bold px-3 py-1 rounded-lg bg-green-900 text-green-300 hover:bg-green-800 disabled:opacity-50"
      >
        Mark Complete
      </button>
      <button
        onClick={() => updateStatus("cancelled")}
        disabled={updating}
        className="text-xs font-bold px-3 py-1 rounded-lg bg-red-900 text-red-300 hover:bg-red-800 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
