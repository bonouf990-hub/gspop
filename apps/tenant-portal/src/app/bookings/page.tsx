"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Calendar, Clock, MapPin, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import BottomNav from "@/components/BottomNav";

type CommonArea = { id: string; name: string; category: string; property_id: string };
type Booking = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  common_areas: { name: string; category: string } | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  pool: "Swimming Pool",
  gym: "Fitness Center",
  rooftop: "Rooftop Terrace",
  garden: "Garden",
  lobby: "Lobby",
  other: "Facility",
};

export default function BookingsPage() {
  const router = useRouter();
  const [commonAreas, setCommonAreas] = useState<CommonArea[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const residentId = userData.user?.id;

      const { data: lease } = await supabase
        .from("leases")
        .select("units(property_id)")
        .eq("primary_resident_id", residentId)
        .eq("status", "active")
        .single();

      const propertyId = (lease?.units as unknown as { property_id: string } | null)?.property_id;

      const [{ data: areas }, { data: myBookings }] = await Promise.all([
        propertyId
          ? supabase
              .from("common_areas")
              .select("id, name, category, property_id")
              .eq("property_id", propertyId)
              .in("category", ["pool", "gym", "rooftop", "garden", "lobby", "other"])
              .order("name")
          : { data: [] },
        supabase
          .from("common_area_bookings")
          .select("id, start_time, end_time, status, common_areas(name, category)")
          .eq("resident_id", residentId)
          .order("start_time", { ascending: false })
          .limit(20),
      ]);

      setCommonAreas((areas ?? []) as CommonArea[]);
      setBookings((myBookings ?? []) as unknown as Booking[]);
      setLoaded(true);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedArea || !date) return;
    setSubmitting(true);
    setError(null);

    const startDt = new Date(`${date}T${startTime}`);
    const endDt = new Date(`${date}T${endTime}`);

    if (endDt <= startDt) {
      setError("End time must be after start time");
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    const { error: insErr } = await supabase.from("common_area_bookings").insert({
      common_area_id: selectedArea,
      resident_id: userData.user?.id,
      start_time: startDt.toISOString(),
      end_time: endDt.toISOString(),
      status: "confirmed",
    });

    setSubmitting(false);
    if (insErr) return setError(insErr.message);

    setShowForm(false);
    setSelectedArea("");
    setDate("");
    setStartTime("09:00");
    setEndTime("10:00");
    router.refresh();

    const { data: refreshed } = await supabase
      .from("common_area_bookings")
      .select("id, start_time, end_time, status, common_areas(name, category)")
      .eq("resident_id", userData.user?.id)
      .order("start_time", { ascending: false })
      .limit(20);
    setBookings((refreshed ?? []) as unknown as Booking[]);
  }

  async function cancelBooking(id: string) {
    const supabase = createClient();
    await supabase.from("common_area_bookings").update({ status: "cancelled" }).eq("id", id);
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b))
    );
  }

  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && new Date(b.start_time) >= new Date()
  );
  const past = bookings.filter(
    (b) => b.status !== "confirmed" || new Date(b.start_time) < new Date()
  );

  return (
    <main className="min-h-screen bg-[var(--background)] pb-32">
      <div className="px-6 pt-10 pb-6">
        <Link href="/" className="inline-flex items-center text-[var(--muted)] text-sm mb-4">
          <ChevronLeft size={16} /> Home
        </Link>
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1.5">
          Amenities
        </p>
        <h1 className="font-display text-3xl text-[#f0ece4] font-semibold">Book a Facility</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Reserve the gym, pool, or other common areas.
        </p>
      </div>

      <div className="px-5 space-y-5">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full elevated-card rounded-2xl p-4 flex items-center gap-3 text-left"
          >
            <span className="w-10 h-10 rounded-full bg-[var(--gold-pale)] flex items-center justify-center text-[var(--gold)]">
              <Plus size={20} strokeWidth={1.8} />
            </span>
            <span className="text-sm font-medium text-[#f0ece4]">New Booking</span>
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="elevated-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold">
                New Booking
              </p>
              <button type="button" onClick={() => setShowForm(false)}>
                <X size={16} className="text-[var(--muted)]" />
              </button>
            </div>

            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Facility</label>
              <select
                className="w-full bg-[#141d33] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[#f0ece4]"
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                required
              >
                <option value="">Select a facility…</option>
                {commonAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({CATEGORY_LABELS[a.category] ?? a.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Date</label>
              <input
                className="w-full bg-[#141d33] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[#f0ece4]"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--muted)] mb-1 block">Start</label>
                <input
                  className="w-full bg-[#141d33] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[#f0ece4]"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)] mb-1 block">End</label>
                <input
                  className="w-full bg-[#141d33] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[#f0ece4]"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && <p className="text-[#e08a8a] text-xs">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !selectedArea || !date}
              className="w-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-soft)] text-[#0f1626] rounded-xl p-3.5 font-semibold text-sm disabled:opacity-40"
            >
              {submitting ? "Booking…" : "Confirm Booking"}
            </button>
          </form>
        )}

        {upcoming.length > 0 && (
          <section className="elevated-card rounded-2xl p-5">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold mb-4">
              Upcoming
            </p>
            <div className="space-y-3">
              {upcoming.map((b) => {
                const area = b.common_areas as { name: string; category: string } | null;
                const start = new Date(b.start_time);
                const end = new Date(b.end_time);
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between bg-[#141d33] rounded-xl p-3.5 border border-[var(--hairline)]"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-[#f0ece4] flex items-center gap-1.5">
                        <MapPin size={13} className="text-[var(--gold)]" />
                        {area?.name ?? "Facility"}
                      </p>
                      <p className="text-xs text-[var(--muted)] flex items-center gap-1.5">
                        <Calendar size={12} />
                        {start.toLocaleDateString()}
                      </p>
                      <p className="text-xs text-[var(--muted)] flex items-center gap-1.5">
                        <Clock size={12} />
                        {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                        {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <button
                      onClick={() => cancelBooking(b.id)}
                      className="text-xs text-[#e08a8a] font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section className="elevated-card rounded-2xl p-5">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold mb-4">
              Past & Cancelled
            </p>
            <div className="space-y-2">
              {past.map((b) => {
                const area = b.common_areas as { name: string; category: string } | null;
                const start = new Date(b.start_time);
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between bg-[#141d33] rounded-xl p-3 border border-[var(--hairline)] opacity-60"
                  >
                    <div>
                      <p className="text-sm text-[#f0ece4]">{area?.name ?? "Facility"}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {start.toLocaleDateString()} · {b.status}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {loaded && bookings.length === 0 && !showForm && (
          <div className="elevated-card rounded-2xl p-6 text-center">
            <Calendar size={32} className="mx-auto text-[var(--gold)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No bookings yet. Tap above to reserve a facility.</p>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
