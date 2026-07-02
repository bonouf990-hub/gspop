"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, IdCard } from "lucide-react";
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
  const [emiratesId, setEmiratesId] = useState("");
  const [idPhotoCaptured, setIdPhotoCaptured] = useState(false);
  const [windowStart, setWindowStart] = useState(nowLocalInputValue());
  const [windowEnd, setWindowEnd] = useState(nowLocalInputValue(8 * 60));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    const ctx = await getResidentContext();

    const { data: visitor } = await supabase
      .from("visitors")
      .insert({
        tenant_id: ctx.tenantId,
        property_id: ctx.propertyId,
        unit_id: ctx.unitId,
        full_name: guestName,
        purpose: "guest",
        host_resident_id: ctx.residentId,
        hosted_by_approved: true,
        emirates_id_number: emiratesId || null,
        expected_window_start: new Date(windowStart).toISOString(),
        expected_window_end: new Date(windowEnd).toISOString(),
        status: "invited",
      })
      .select("id")
      .single();

    // Alert every security guard on this tenant so the pre-authorized guest
    // shows up on their landing page before arrival.
    if (visitor) {
      const { data: guards } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("tenant_id", ctx.tenantId)
        .eq("role", "security");
      if (guards && guards.length > 0) {
        await supabase.from("notifications").insert(
          guards.map((g) => ({
            recipient_id: g.id,
            type: "visitor_invited",
            entity_type: "visitor",
            entity_id: visitor.id,
            message: `${guestName} pre-authorized for unit visit`,
          }))
        );
      }
    }

    setSubmitting(false);
    router.push("/gate");
  }

  return (
    <main className="min-h-screen pb-10">
      <div className="px-6 pt-10 pb-6">
        <Link href="/gate" className="inline-flex items-center text-[var(--muted)] text-sm mb-4">
          <ChevronLeft size={16} /> Gate
        </Link>
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1.5">
          Pre-Authorize
        </p>
        <h1 className="font-display text-3xl text-[#16233c] font-semibold">Invite Guest</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Security will let them in within this window.</p>
      </div>

      <form onSubmit={handleSubmit} className="px-5 space-y-5">
        <div className="elevated-card rounded-2xl p-5 space-y-4">
          <div>
            <label className="text-xs text-[var(--muted)] mb-1.5 block">Guest name</label>
            <input
              className="w-full bg-[#f4f6fa] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[#16233c]"
              placeholder="Full name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1.5 block">Emirates ID (optional)</label>
            <input
              className="w-full bg-[#f4f6fa] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[#16233c]"
              placeholder="784-XXXX-XXXXXXX-X"
              value={emiratesId}
              onChange={(e) => setEmiratesId(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setIdPhotoCaptured(true)}
            className={`w-full flex items-center justify-center gap-2 rounded-xl p-3 text-sm font-medium border ${
              idPhotoCaptured
                ? "bg-[var(--gold-pale)] border-[var(--gold)] text-[#d9647f]"
                : "bg-[#f4f6fa] border-[var(--hairline)] text-[#16233c]"
            }`}
          >
            <IdCard size={16} /> {idPhotoCaptured ? "ID photo captured" : "Capture ID photo"}
          </button>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1.5 block">Arrives after</label>
            <input
              type="datetime-local"
              className="w-full bg-[#f4f6fa] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[#16233c]"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1.5 block">Until</label>
            <input
              type="datetime-local"
              className="w-full bg-[#f4f6fa] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[#16233c]"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !guestName}
          className="btn-gold w-full p-3.5 text-sm disabled:opacity-40"
        >
          {submitting ? "Inviting..." : "Invite Guest"}
        </button>
      </form>
    </main>
  );
}
