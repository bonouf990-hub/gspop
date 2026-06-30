"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <main className="min-h-screen bg-[var(--background)] text-[var(--navy)] p-6">
      <h1 className="text-xl font-bold mb-1">Allow Delivery</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Select the courier and a delivery window.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {DELIVERY_BRANDS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrand(b)}
              className={`rounded-xl p-3 text-sm font-medium border ${
                brand === b ? "bg-gradient-to-r from-[var(--gold)] to-[var(--gold-soft)] text-white border-[var(--gold)]" : "bg-white border border-[var(--hairline)] border-transparent"
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs text-[var(--muted)] mb-1 block">Expected after</label>
          <input
            type="datetime-local"
            className="w-full bg-white border border-[var(--hairline)] rounded-lg p-3"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-xs text-[var(--muted)] mb-1 block">Until</label>
          <input
            type="datetime-local"
            className="w-full bg-white border border-[var(--hairline)] rounded-lg p-3"
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
            required
          />
        </div>

        <label className="flex items-center justify-between bg-white border border-[var(--hairline)] rounded-lg p-3">
          <span className="text-sm">Leave with security if I'm not home</span>
          <input
            type="checkbox"
            checked={leaveWithSecurity}
            onChange={(e) => setLeaveWithSecurity(e.target.checked)}
            className="w-5 h-5"
          />
        </label>

        <button
          type="submit"
          disabled={submitting || !brand}
          className="w-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-soft)] text-white rounded-lg p-3 font-semibold disabled:opacity-40"
        >
          {submitting ? "Submitting..." : "Allow Delivery"}
        </button>
      </form>
    </main>
  );
}
