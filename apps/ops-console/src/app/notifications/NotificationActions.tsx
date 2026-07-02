"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function NotificationActions({
  mode,
  ids,
}: {
  mode: "mark-read" | "mark-all-read";
  ids: string[];
}) {
  const router = useRouter();
  const [acting, setActing] = useState(false);

  async function handleMarkRead() {
    setActing(true);
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    setActing(false);
    router.refresh();
  }

  if (mode === "mark-all-read") {
    return (
      <button
        onClick={handleMarkRead}
        disabled={acting}
        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#e9eef6] text-[#d9647f] hover:bg-[rgba(176,27,66,0.15)] disabled:opacity-50"
      >
        {acting ? "Marking…" : "Mark All Read"}
      </button>
    );
  }

  return (
    <button
      onClick={handleMarkRead}
      disabled={acting}
      className="text-[10px] font-medium px-2 py-1 rounded-lg bg-[#e9eef6] text-[#5b6b85] hover:text-[#d9647f] disabled:opacity-50"
    >
      {acting ? "…" : "Mark Read"}
    </button>
  );
}
