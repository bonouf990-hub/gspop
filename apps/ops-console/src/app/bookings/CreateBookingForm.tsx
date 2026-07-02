"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Modal from "@/components/Modal";

type CommonArea = { id: string; name: string; category: string; property_id: string };
type Property = { id: string; name: string };
type Resident = { id: string; full_name: string };

export default function CreateBookingForm({
  commonAreas,
  properties,
  residents,
}: {
  commonAreas: CommonArea[];
  properties: Property[];
  residents: Resident[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [commonAreaId, setCommonAreaId] = useState("");
  const [residentId, setResidentId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredAreas = propertyId
    ? commonAreas.filter((a) => a.property_id === propertyId)
    : [];

  useEffect(() => {
    setCommonAreaId("");
  }, [propertyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!date || !startTime || !endTime) {
      setError("Date and time are required");
      setSubmitting(false);
      return;
    }

    const startDt = new Date(`${date}T${startTime}`);
    const endDt = new Date(`${date}T${endTime}`);

    if (endDt <= startDt) {
      setError("End time must be after start time");
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { error: insErr } = await supabase.from("common_area_bookings").insert({
      common_area_id: commonAreaId,
      resident_id: residentId,
      start_time: startDt.toISOString(),
      end_time: endDt.toISOString(),
      status: "confirmed",
    });

    setSubmitting(false);
    if (insErr) return setError(insErr.message);

    setOpen(false);
    setPropertyId("");
    setCommonAreaId("");
    setResidentId("");
    setDate("");
    setStartTime("09:00");
    setEndTime("10:00");
    router.refresh();
  }

  const input =
    "w-full bg-[#0f1626] border border-[rgba(176,27,66,0.15)] rounded-lg p-2.5 text-sm text-[#eef1f6]";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-gold text-sm px-5 py-2.5"
      >
        + New Booking
      </button>

      {open && (
        <Modal title="New Booking" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs text-[#9aa5bd] mb-1 block">Property *</label>
        <select
          className={input}
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          required
        >
          <option value="">Select property…</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-[#9aa5bd] mb-1 block">Facility *</label>
        <select
          className={input}
          value={commonAreaId}
          onChange={(e) => setCommonAreaId(e.target.value)}
          required
        >
          <option value="">Select facility…</option>
          {filteredAreas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.category.replace(/_/g, " ")})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-[#9aa5bd] mb-1 block">Resident *</label>
        <select
          className={input}
          value={residentId}
          onChange={(e) => setResidentId(e.target.value)}
          required
        >
          <option value="">Select resident…</option>
          {residents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-[#9aa5bd] mb-1 block">Date *</label>
        <input
          className={input}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#9aa5bd] mb-1 block">Start Time *</label>
          <input
            className={input}
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-xs text-[#9aa5bd] mb-1 block">End Time *</label>
          <input
            className={input}
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="btn-gold text-sm px-4 py-2 disabled:opacity-50"
        >
          {submitting ? "Booking…" : "Confirm Booking"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="bg-[#213052] text-sm font-medium px-4 py-2 rounded-lg text-[#9aa5bd]"
        >
          Cancel
        </button>
      </div>
          </form>
        </Modal>
      )}
    </>
  );
}
