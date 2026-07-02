"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function BookingActions({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  async function updateStatus(status: "cancelled" | "no_show") {
    setUpdating(true);
    const supabase = createClient();
    await supabase
      .from("common_area_bookings")
      .update({ status })
      .eq("id", bookingId);
    setUpdating(false);
    router.refresh();
  }

  return (
    <div className="flex gap-1">
      <button
        onClick={() => updateStatus("cancelled")}
        disabled={updating}
        className="text-xs text-[#5b6b85] hover:text-red-600 disabled:opacity-50"
      >
        Cancel
      </button>
      <span className="text-[#8b97ab]">·</span>
      <button
        onClick={() => updateStatus("no_show")}
        disabled={updating}
        className="text-xs text-[#5b6b85] hover:text-amber-700 disabled:opacity-50"
      >
        No-show
      </button>
    </div>
  );
}
