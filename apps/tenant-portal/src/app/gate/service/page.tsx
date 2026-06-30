"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
    <main className="min-h-screen bg-[var(--background)] pb-10">
      <div className="px-6 pt-10 pb-6">
        <Link href="/gate" className="inline-flex items-center text-[var(--muted)] text-sm mb-4">
          <ChevronLeft size={16} /> Gate
        </Link>
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1.5">
          Pre-Authorize
        </p>
        <h1 className="font-display text-3xl text-[var(--navy)] font-semibold">Notify Service</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Let security know a provider is expected.</p>
      </div>

      <form onSubmit={handleSubmit} className="px-5 space-y-5">
        <div className="elevated-card rounded-2xl p-5">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold mb-4">
            Provider
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {SERVICE_PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={`flex items-center gap-2.5 rounded-xl p-3 text-sm font-medium border transition-colors ${
                  provider === p
                    ? "bg-[var(--gold-pale)] border-[var(--gold)] text-[#8a6a1f]"
                    : "bg-[var(--background)] border-[var(--hairline)] text-[var(--navy)]"
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                    provider === p ? "bg-[var(--gold)] text-white" : "bg-white text-[var(--muted)]"
                  }`}
                >
                  {p[0]}
                </span>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="elevated-card rounded-2xl p-5 space-y-4">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold">
            Expected Window
          </p>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1.5 block">Expected after</label>
            <input
              type="datetime-local"
              className="w-full bg-[var(--background)] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[var(--navy)]"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1.5 block">Until</label>
            <input
              type="datetime-local"
              className="w-full bg-[var(--background)] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[var(--navy)]"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !provider}
          className="w-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-soft)] text-white rounded-xl p-3.5 font-semibold text-sm disabled:opacity-40"
        >
          {submitting ? "Submitting..." : "Notify Service"}
        </button>
      </form>
    </main>
  );
}
