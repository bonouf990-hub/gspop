"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { getResidentContext } from "@/lib/residentContext";

const SERVICE_PROVIDERS = ["DEWA", "Etisalat", "du", "Urban Company", "AC Maintenance", "Other"];

function nowLocalInputValue(offsetMinutes = 0) {
  const d = new Date(Date.now() + offsetMinutes * 60000);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function NotifyServicePage() {
  const router = useRouter();
  const [provider, setProvider] = useState<string | null>(null);
  const [windowStart, setWindowStart] = useState(nowLocalInputValue());
  const [windowEnd, setWindowEnd] = useState(nowLocalInputValue(4 * 60));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!provider) return;
    setSubmitting(true);
    const supabase = createClient();
    const ctx = await getResidentContext();

    await supabase.from("visitors").insert({
      tenant_id: ctx.tenantId,
      property_id: ctx.propertyId,
      unit_id: ctx.unitId,
      full_name: `${provider} Service`,
      purpose: "vendor",
      brand_name: provider,
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
    <main className="min-h-screen bg-[var(--background)] text-[var(--navy)] p-6">
      <h1 className="text-xl font-bold mb-1">Notify Service</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Let security know a provider is expected.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {SERVICE_PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={`rounded-xl p-3 text-sm font-medium border ${
                provider === p ? "bg-gradient-to-r from-[var(--gold)] to-[var(--gold-soft)] text-white border-[var(--gold)]" : "bg-white border border-[var(--hairline)] border-transparent"
              }`}
            >
              {p}
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

        <button
          type="submit"
          disabled={submitting || !provider}
          className="w-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-soft)] text-white rounded-lg p-3 font-semibold disabled:opacity-40"
        >
          {submitting ? "Submitting..." : "Notify Service"}
        </button>
      </form>
    </main>
  );
}
