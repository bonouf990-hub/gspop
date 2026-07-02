"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Snowflake,
  Lightbulb,
  Droplets,
  Wrench,
  Paintbrush,
  Wind,
  Bug,
  Zap,
  Flame,
  CalendarDays,
  Clock,
  CheckCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import BottomNav from "@/components/BottomNav";

const JOB_TYPES = [
  { value: "ac_hvac", label: "AC / HVAC", Icon: Snowflake },
  { value: "plumbing", label: "Plumbing", Icon: Droplets },
  { value: "electrical", label: "Electrical", Icon: Zap },
  { value: "carpentry", label: "Carpentry", Icon: Wrench },
  { value: "painting", label: "Painting", Icon: Paintbrush },
  { value: "general", label: "General Maintenance", Icon: Wind },
  { value: "pest_control", label: "Pest Control", Icon: Bug },
  { value: "fire_safety", label: "Fire Safety", Icon: Flame },
  { value: "cleaning", label: "Cleaning", Icon: Lightbulb },
];

const TIME_SLOTS = [
  { value: "morning", label: "Morning", detail: "8:00 AM – 12:00 PM" },
  { value: "afternoon", label: "Afternoon", detail: "12:00 PM – 5:00 PM" },
  { value: "evening", label: "Evening", detail: "5:00 PM – 8:00 PM" },
];

export default function BookVisitPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [jobType, setJobType] = useState("");
  const [description, setDescription] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [unitLabel, setUnitLabel] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const { data: lease } = await supabase
        .from("leases")
        .select("units(label)")
        .eq("primary_resident_id", userData.user?.id ?? "")
        .eq("status", "active")
        .single();
      const unit = lease?.units as unknown as { label: string } | null;
      setUnitLabel(unit?.label ?? "");
    })();
  }, []);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().slice(0, 10);

  const selectedJob = JOB_TYPES.find((j) => j.value === jobType);
  const selectedSlot = TIME_SLOTS.find((s) => s.value === visitTime);

  async function handleSubmit() {
    if (!jobType || !description.trim() || !visitDate || !visitTime) return;
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const residentId = userData.user?.id;

    const { data: lease } = await supabase
      .from("leases")
      .select("unit_id, units(property_id, properties(tenant_id))")
      .eq("primary_resident_id", residentId ?? "")
      .eq("status", "active")
      .single();

    const unit = lease?.units as unknown as {
      property_id: string;
      properties: { tenant_id: string };
    } | null;

    if (!lease || !unit) {
      setError("Could not find your lease. Please contact management.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("work_orders").insert({
      tenant_id: unit.properties.tenant_id,
      property_id: unit.property_id,
      unit_id: lease.unit_id,
      type: jobType,
      priority: "medium",
      title: `${selectedJob?.label ?? jobType} — Visit Request`,
      description,
      status: "draft",
      created_by: residentId,
      resident_id: residentId,
      visit_source: "resident_booking",
      preferred_visit_date: visitDate,
      preferred_visit_time: visitTime,
    });

    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--foreground)]">
        <div className="max-w-md mx-auto px-4 pt-16 text-center">
          <CheckCircle size={64} className="text-[#1f8a4d] mx-auto mb-4" />
          <h1 className="font-display text-2xl font-semibold mb-2">Visit Booked!</h1>
          <p className="text-[#5b6b85] mb-2">
            Your technician visit for <strong>{selectedJob?.label}</strong> has been submitted.
          </p>
          <div className="elevated-card rounded-2xl p-4 mt-4 text-left">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-[#5b6b85]">Job Type</span>
              <span className="font-medium">{selectedJob?.label}</span>
              <span className="text-[#5b6b85]">Unit</span>
              <span className="font-medium">{unitLabel || "—"}</span>
              <span className="text-[#5b6b85]">Preferred Date</span>
              <span className="font-medium">{new Date(visitDate).toLocaleDateString()}</span>
              <span className="text-[#5b6b85]">Time Slot</span>
              <span className="font-medium">{selectedSlot?.label} ({selectedSlot?.detail})</span>
            </div>
          </div>
          <p className="text-xs text-[#5b6b85] mt-4">
            Our team will review and assign a technician. You&apos;ll receive a notification once confirmed.
          </p>
          <button
            onClick={() => router.push("/")}
            className="btn-gold mt-6 w-full py-3"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--foreground)] pb-28">
      <header className="sticky top-0 z-20 bg-[var(--bg)]/80 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-[#5b6b85]">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="font-display font-semibold text-lg">Book Technician Visit</h1>
      </header>

      <div className="max-w-md mx-auto px-4">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-1">
              <div
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-[var(--gold)]" : "bg-[rgba(176,27,66,0.15)]"
                }`}
              />
            </div>
          ))}
          <span className="text-xs text-[#5b6b85] ml-1">Step {step}/3</span>
        </div>

        {/* Step 1: Select Job Type */}
        {step === 1 && (
          <div>
            <h2 className="font-display font-semibold text-lg mb-1">What do you need?</h2>
            <p className="text-sm text-[#5b6b85] mb-4">
              Select the type of maintenance work you need.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {JOB_TYPES.map((j) => {
                const active = jobType === j.value;
                return (
                  <button
                    key={j.value}
                    onClick={() => setJobType(j.value)}
                    className={`elevated-card rounded-2xl p-3 flex flex-col items-center gap-2 transition-all ${
                      active
                        ? "ring-2 ring-[var(--gold)] bg-[var(--gold)]/10"
                        : ""
                    }`}
                  >
                    <j.Icon
                      size={24}
                      className={active ? "text-[var(--gold)]" : "text-[#5b6b85]"}
                    />
                    <span className={`text-xs text-center ${active ? "font-bold text-[var(--gold)]" : "text-[#5b6b85]"}`}>
                      {j.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {jobType && (
              <button
                onClick={() => setStep(2)}
                className="btn-gold mt-6 w-full py-3"
              >
                Next — Describe Issue
              </button>
            )}
          </div>
        )}

        {/* Step 2: Describe the Issue */}
        {step === 2 && (
          <div>
            <h2 className="font-display font-semibold text-lg mb-1">
              Describe the issue
            </h2>
            <p className="text-sm text-[#5b6b85] mb-4">
              Help the technician understand what to expect.
              {unitLabel && <> Unit: <strong>{unitLabel}</strong></>}
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. The AC in the bedroom is making a loud noise and not cooling properly. It started two days ago."
              className="w-full min-h-[140px] rounded-2xl bg-[#f4f6fa] border border-[var(--border)] p-4 text-sm placeholder:text-[#5b6b85]/60 resize-none"
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-2xl border border-[var(--border)] font-bold text-[#5b6b85]"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!description.trim()}
                className="btn-gold flex-1 py-3 disabled:opacity-50"
              >
                Next — Pick Time
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Pick Date & Time */}
        {step === 3 && (
          <div>
            <h2 className="font-display font-semibold text-lg mb-1">When works for you?</h2>
            <p className="text-sm text-[#5b6b85] mb-4">
              Choose your preferred date and time slot.
            </p>

            <div className="elevated-card rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays size={18} className="text-[var(--gold)]" />
                <span className="text-sm font-bold">Preferred Date</span>
              </div>
              <input
                type="date"
                value={visitDate}
                min={minDateStr}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full rounded-xl bg-[#f4f6fa] border border-[var(--border)] p-3 text-sm"
              />
            </div>

            <div className="elevated-card rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={18} className="text-[var(--gold)]" />
                <span className="text-sm font-bold">Preferred Time</span>
              </div>
              <div className="space-y-2">
                {TIME_SLOTS.map((slot) => {
                  const active = visitTime === slot.value;
                  return (
                    <button
                      key={slot.value}
                      onClick={() => setVisitTime(slot.value)}
                      className={`w-full flex items-center justify-between rounded-xl p-3 border transition-all ${
                        active
                          ? "border-[var(--gold)] bg-[var(--gold)]/10"
                          : "border-[var(--border)]"
                      }`}
                    >
                      <span className={`text-sm ${active ? "font-bold text-[var(--gold)]" : ""}`}>
                        {slot.label}
                      </span>
                      <span className="text-xs text-[#5b6b85]">{slot.detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            {visitDate && visitTime && (
              <div className="elevated-card rounded-2xl p-4 mb-4">
                <p className="text-xs text-[#5b6b85] uppercase tracking-wider font-bold mb-2">
                  Visit Summary
                </p>
                <div className="grid grid-cols-2 gap-y-1 text-sm">
                  <span className="text-[#5b6b85]">Job Type</span>
                  <span className="font-medium">{selectedJob?.label}</span>
                  <span className="text-[#5b6b85]">Unit</span>
                  <span className="font-medium">{unitLabel || "—"}</span>
                  <span className="text-[#5b6b85]">Date</span>
                  <span className="font-medium">{new Date(visitDate).toLocaleDateString()}</span>
                  <span className="text-[#5b6b85]">Time</span>
                  <span className="font-medium">{selectedSlot?.label}</span>
                </div>
              </div>
            )}

            {error && (
              <p className="text-[#c0304a] text-sm mb-3">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-2xl border border-[var(--border)] font-bold text-[#5b6b85]"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !visitDate || !visitTime}
                className="btn-gold flex-1 py-3 disabled:opacity-50"
              >
                {submitting ? "Booking…" : "Confirm Booking"}
              </button>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
