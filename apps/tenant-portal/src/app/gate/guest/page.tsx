"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { getResidentContext } from "@/lib/residentContext";

function nowLocalInputValue(offsetMinutes = 0) {
  const d = new Date(Date.now() + offsetMinutes * 60000);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function InviteGuestPage() {
  const router = useRouter();
  const [guestName, setGuestName] = useState("");
  const [windowStart, setWindowStart] = useState(nowLocalInputValue());
  const [windowEnd, setWindowEnd] = useState(nowLocalInputValue(8 * 60));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    const ctx = await getResidentContext();

    await supabase.from("visitors").insert({
      tenant_id: ctx.tenantId,
      property_id: ctx.propertyId,
      unit_id: ctx.unitId,
      full_name: guestName,
      purpose: "guest",
      host_resident_id: ctx.residentId,
      hosted_by_approved: true,
      expected_window_start: new Date(windowStart).toISOString(),
      expected_window_end: new Date(windowEnd).toISOString(),
      status: "invited",
    });

    setSubmitting(false);
    router.push("/gate");
  }

  return (
    <main className="min-h-screen bg-[#0B1320] text-white p-6">
      <h1 className="text-xl font-bold mb-1">Invite Guest</h1>
      <p className="text-sm text-gray-400 mb-6">Security will let them in within this window.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full bg-[#162335] rounded-lg p-3"
          placeholder="Guest name"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          required
        />

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Arrives after</label>
          <input
            type="datetime-local"
            className="w-full bg-[#162335] rounded-lg p-3"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Until</label>
          <input
            type="datetime-local"
            className="w-full bg-[#162335] rounded-lg p-3"
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !guestName}
          className="w-full bg-amber-600 rounded-lg p-3 font-semibold disabled:opacity-40"
        >
          {submitting ? "Inviting..." : "Invite Guest"}
        </button>
      </form>
    </main>
  );
}
