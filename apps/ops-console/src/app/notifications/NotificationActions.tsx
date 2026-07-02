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
        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#213052] text-[#d4af5a] hover:bg-[rgba(184,144,47,0.15)] disabled:opacity-50"
      >
        {acting ? "Marking…" : "Mark All Read"}
      </button>
    );
  }

  return (
    <button
      onClick={handleMarkRead}
      disabled={acting}
      className="text-[10px] font-medium px-2 py-1 rounded-lg bg-[#213052] text-[#a0977e] hover:text-[#d4af5a] disabled:opacity-50"
    >
      {acting ? "…" : "Mark Read"}
    </button>
  );
}
