"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CalendarDays, Clock, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import BottomNav from "@/components/BottomNav";

type Visit = {
  id: string;
  title: string;
  type: string;
  status: string;
  description: string;
  preferred_visit_date: string | null;
  preferred_visit_time: string | null;
  created_at: string;
  technician: { full_name: string } | null;
};

const STATUS_STYLE: Record<string, { bg: string; label: string }> = {
  draft: { bg: "bg-amber-100 text-amber-700", label: "Pending Review" },
  assigned: { bg: "bg-blue-100 text-blue-700", label: "Technician Assigned" },
  in_progress: { bg: "bg-yellow-100 text-yellow-700", label: "In Progress" },
  completed_by_technician: { bg: "bg-green-100 text-green-700", label: "Completed" },
  verified_by_supervisor: { bg: "bg-green-100 text-green-700", label: "Verified" },
  confirmed_by_resident: { bg: "bg-green-100 text-green-700", label: "Confirmed" },
  closed: { bg: "bg-gray-100 text-gray-600", label: "Closed" },
  cancelled: { bg: "bg-red-100 text-red-600", label: "Cancelled" },
};

const TIME_LABELS: Record<string, string> = {
  morning: "Morning (8 AM – 12 PM)",
  afternoon: "Afternoon (12 PM – 5 PM)",
  evening: "Evening (5 PM – 8 PM)",
};

export default function MyVisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("work_orders")
        .select(
          "id, title, type, status, description, preferred_visit_date, preferred_visit_time, created_at, technician:user_profiles!work_orders_assigned_technician_id_fkey(full_name)"
        )
        .eq("resident_id", userData.user?.id ?? "")
        .eq("visit_source", "resident_booking")
        .order("created_at", { ascending: false })
        .limit(50);

      setVisits((data ?? []) as unknown as Visit[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--foreground)] pb-28">
      <header className="sticky top-0 z-20 bg-[var(--bg)]/80 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-[#9A9486]">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="font-bold text-lg">My Visit Requests</h1>
      </header>

      <div className="max-w-md mx-auto px-4">
        <Link
          href="/book-visit"
          className="block w-full text-center py-3 rounded-2xl bg-[var(--gold)] text-[var(--navy)] font-bold mb-4"
        >
          + Book New Visit
        </Link>

        {loading ? (
          <p className="text-center text-[#9A9486] py-8">Loading…</p>
        ) : visits.length === 0 ? (
          <div className="text-center py-12">
            <Wrench size={40} className="text-[#9A9486] mx-auto mb-3" />
            <p className="text-[#9A9486]">No visit requests yet.</p>
            <p className="text-xs text-[#9A9486] mt-1">Book a technician visit for non-emergency maintenance.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visits.map((v) => {
              const st = STATUS_STYLE[v.status] ?? STATUS_STYLE.draft;
              const tech = v.technician as { full_name: string } | null;
              return (
                <div key={v.id} className="elevated-card rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-bold text-sm">{v.title}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.bg}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="text-xs text-[#9A9486] line-clamp-2 mb-2">{v.description}</p>
                  <div className="flex items-center gap-4 text-xs text-[#9A9486]">
                    {v.preferred_visit_date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays size={12} />
                        {new Date(v.preferred_visit_date).toLocaleDateString()}
                      </span>
                    )}
                    {v.preferred_visit_time && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {TIME_LABELS[v.preferred_visit_time] ?? v.preferred_visit_time}
                      </span>
                    )}
                  </div>
                  {tech && (
                    <p className="text-xs text-[var(--gold)] mt-2 font-medium">
                      Technician: {tech.full_name}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
