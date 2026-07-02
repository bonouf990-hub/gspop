"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { getResidentContext } from "@/lib/residentContext";

const DELIVERY_BRANDS = [
  "Amazon", "Aramex", "Careem", "Carrefour", "DHL", "Deliveroo", "Talabat", "FedEx", "Noon", "Other",
];

function nowLocalInputValue(offsetMinutes = 0) {
  const d = new Date(Date.now() + offsetMinutes * 60000);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function AllowDeliveryPage() {
  const router = useRouter();
  const [brand, setBrand] = useState<string | null>(null);
  const [leaveWithSecurity, setLeaveWithSecurity] = useState(false);
  const [windowStart, setWindowStart] = useState(nowLocalInputValue());
  const [windowEnd, setWindowEnd] = useState(nowLocalInputValue(8 * 60));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brand) return;
    setSubmitting(true);
    const supabase = createClient();
    const ctx = await getResidentContext();

    await supabase.from("visitors").insert({
      tenant_id: ctx.tenantId,
      property_id: ctx.propertyId,
      unit_id: ctx.unitId,
      full_name: `${brand} Delivery`,
      purpose: "delivery",
      brand_name: brand,
      host_resident_id: ctx.residentId,
      hosted_by_approved: true,
      leave_with_security: leaveWithSecurity,
      expected_window_start: new Date(windowStart).toISOString(),
      expected_window_end: new Date(windowEnd).toISOString(),
      status: "invited",
    });

    setSubmitting(false);
    router.push("/gate");
  }

  return (
    <main className="min-h-screen bg-[var(--background)] pb-10">
      <div className="px-6 pt-10 pb-6">
        <Link href="/gate" className="inline-flex items-center text-[var(--muted)] text-sm mb-4">
          <ChevronLeft size={16} /> Gate
        </Link>
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1.5">
          Pre-Authorize
        </p>
        <h1 className="font-display text-3xl text-[#f0ece4] font-semibold">Allow Delivery</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Select the courier and a delivery window.</p>
      </div>

      <form onSubmit={handleSubmit} className="px-5 space-y-5">
        <div className="elevated-card rounded-2xl p-5">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold mb-4">
            Courier
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {DELIVERY_BRANDS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBrand(b)}
                className={`flex items-center gap-2.5 rounded-xl p-3 text-sm font-medium border transition-colors ${
                  brand === b
                    ? "bg-[var(--gold-pale)] border-[var(--gold)] text-[#d4af5a]"
                    : "bg-[#141d33] border-[var(--hairline)] text-[#f0ece4]"
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                    brand === b ? "bg-[var(--gold)] text-[#0f1626]" : "bg-[rgba(184,144,47,0.12)] text-[var(--muted)]"
                  }`}
                >
                  {b[0]}
                </span>
                {b}
              </button>
            ))}
          </div>
        </div>

        <div className="elevated-card rounded-2xl p-5 space-y-4">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold">
            Delivery Window
          </p>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1.5 block">Expected after</label>
            <input
              type="datetime-local"
              className="w-full bg-[#141d33] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[#f0ece4]"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1.5 block">Until</label>
            <input
              type="datetime-local"
              className="w-full bg-[#141d33] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[#f0ece4]"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              required
            />
          </div>
          <label className="flex items-center justify-between pt-1 cursor-pointer">
            <span className="text-sm text-[#f0ece4]">Leave with security if I'm not home</span>
            <button
              type="button"
              role="switch"
              aria-checked={leaveWithSecurity}
              onClick={() => setLeaveWithSecurity((v) => !v)}
              className={`w-11 h-6 rounded-full relative transition-colors ${
                leaveWithSecurity ? "bg-[var(--gold)]" : "bg-[#213052]"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow shadow-black/40 transition-transform ${
                  leaveWithSecurity ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting || !brand}
          className="w-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-soft)] text-[#0f1626] rounded-xl p-3.5 font-semibold text-sm disabled:opacity-40"
        >
          {submitting ? "Submitting..." : "Allow Delivery"}
        </button>
      </form>
    </main>
  );
}
