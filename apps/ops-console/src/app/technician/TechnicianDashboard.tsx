"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

type WO = {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  description: string | null;
  created_at: string;
  started_at: string | null;
  hours_worked: number | null;
  preferred_visit_date: string | null;
  preferred_visit_time: string | null;
  visit_source: string | null;
  properties: { name: string } | null;
  units: { label: string } | null;
};

type CheckinRecord = {
  id: string;
  work_order_id: string;
  type: string;
  timestamp: string;
};

const PRIORITY_COLORS: Record<string, string> = {
  emergency: "bg-red-900/60 text-red-300 border-red-500",
  high: "bg-amber-900/50 text-amber-300 border-amber-500",
  medium: "bg-[rgba(184,144,47,0.12)] text-[#d4af5a] border-[#b8902f]",
  low: "bg-[#213052] text-[#a0977e] border-[#213052]",
};

const STATUS_LABELS: Record<string, string> = {
  assigned: "Ready to Start",
  in_progress: "In Progress",
  draft: "Pending Review",
  paused: "Paused",
  completed_by_technician: "Completed",
  verified_by_supervisor: "Verified",
};

const TIME_LABELS: Record<string, string> = {
  morning: "8 AM – 12 PM",
  afternoon: "12 PM – 5 PM",
  evening: "5 PM – 8 PM",
};

export default function TechnicianDashboard({
  profile,
  userId,
  workOrders,
  todayCheckins,
}: {
  profile: { name: string; role: string; trade: string | null };
  userId: string;
  workOrders: WO[];
  todayCheckins: CheckinRecord[];
}) {
  const router = useRouter();
  const [activeWO, setActiveWO] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoStage, setPhotoStage] = useState<"before" | "after">("before");

  const inProgressWOs = workOrders.filter((wo) => wo.status === "in_progress");
  const assignedWOs = workOrders.filter((wo) => wo.status === "assigned");
  const otherWOs = workOrders.filter((wo) => !["in_progress", "assigned"].includes(wo.status));

  const checkedInWOs = new Set(
    todayCheckins.filter((c) => c.type === "check_in").map((c) => c.work_order_id)
  );
  const checkedOutWOs = new Set(
    todayCheckins.filter((c) => c.type === "check_out").map((c) => c.work_order_id)
  );

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const fmtTimer = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, []);

  async function getLocation(): Promise<{ lat: number; lng: number; accuracy: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  async function checkIn(woId: string) {
    setBusy(true);
    setError(null);
    try {
      const loc = await getLocation();
      const supabase = createClient();
      await supabase.from("work_order_checkins").insert({
        work_order_id: woId,
        technician_id: userId,
        type: "check_in",
        latitude: loc.lat,
        longitude: loc.lng,
        accuracy_meters: loc.accuracy,
      });
      setActiveWO(woId);
      setTimer(0);
      setTimerRunning(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get location");
    }
    setBusy(false);
  }

  async function checkOut(woId: string) {
    setBusy(true);
    setError(null);
    try {
      const loc = await getLocation();
      const supabase = createClient();
      await supabase.from("work_order_checkins").insert({
        work_order_id: woId,
        technician_id: userId,
        type: "check_out",
        latitude: loc.lat,
        longitude: loc.lng,
        accuracy_meters: loc.accuracy,
      });
      const hours = timer / 3600;
      if (hours > 0) {
        const { data: wo } = await supabase
          .from("work_orders")
          .select("hours_worked")
          .eq("id", woId)
          .single();
        const totalHours = (Number(wo?.hours_worked ?? 0) + hours);
        await supabase.from("work_orders").update({
          hours_worked: Math.round(totalHours * 100) / 100,
        }).eq("id", woId);
      }
      setTimerRunning(false);
      setActiveWO(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get location");
    }
    setBusy(false);
  }

  async function startJob(woId: string) {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("work_orders").update({
      status: "in_progress",
      started_at: new Date().toISOString(),
    }).eq("id", woId);
    setBusy(false);
    router.refresh();
  }

  async function completeJob(woId: string) {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("work_orders").update({
      status: "completed_by_technician",
      completed_at: new Date().toISOString(),
    }).eq("id", woId);
    setBusy(false);
    router.refresh();
  }

  async function uploadPhoto(woId: string) {
    if (!photoFile) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const ext = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${woId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("work-order-photos")
      .upload(path, photoFile, { contentType: photoFile.type });
    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }
    await supabase.from("work_order_photos").insert({
      work_order_id: woId,
      stage: photoStage,
      storage_path: path,
      taken_by: userId,
    });
    setPhotoFile(null);
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-[#0f1626] text-[#f0ece4] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0f1626]/95 backdrop-blur-lg px-4 py-3 border-b border-[rgba(184,144,47,0.15)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#b8902f] font-bold tracking-[0.2em] uppercase">GSPOP</p>
            <p className="font-bold">{profile.name}</p>
            <p className="text-xs text-[#a0977e] capitalize">{profile.trade ?? profile.role}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#a0977e]">{new Date().toLocaleDateString("en-AE", { weekday: "long", day: "numeric", month: "short" })}</p>
            <p className="text-lg font-bold text-[#d4af5a]">{workOrders.length} jobs</p>
          </div>
        </div>
      </header>

      <div className="px-4 pt-4">
        {error && (
          <div className="bg-red-950/50 border border-red-500/50 rounded-xl p-3 mb-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Active Timer */}
        {activeWO && timerRunning && (
          <div className="bg-[#1a2640] border border-[#b8902f] rounded-2xl p-4 mb-4 text-center">
            <p className="text-xs text-[#b8902f] uppercase tracking-wider mb-1">Job Timer</p>
            <p className="text-3xl font-mono font-bold text-[#d4af5a]">{fmtTimer(timer)}</p>
            <button
              onClick={() => checkOut(activeWO)}
              disabled={busy}
              className="mt-3 w-full py-2.5 rounded-lg bg-red-950/50 text-red-300 border border-red-500/30 font-bold text-sm disabled:opacity-50"
            >
              {busy ? "Checking out…" : "Check Out & Stop Timer"}
            </button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[#1a2640] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-amber-400">{inProgressWOs.length}</p>
            <p className="text-[9px] text-[#a0977e] uppercase">In Progress</p>
          </div>
          <div className="bg-[#1a2640] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-[#d4af5a]">{assignedWOs.length}</p>
            <p className="text-[9px] text-[#a0977e] uppercase">Assigned</p>
          </div>
          <div className="bg-[#1a2640] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-green-400">
              {todayCheckins.filter((c) => c.type === "check_in").length}
            </p>
            <p className="text-[9px] text-[#a0977e] uppercase">Check-ins Today</p>
          </div>
        </div>

        {/* In Progress */}
        {inProgressWOs.length > 0 && (
          <Section title="In Progress" count={inProgressWOs.length} color="text-amber-400">
            {inProgressWOs.map((wo) => (
              <JobCard key={wo.id} wo={wo} expanded={activeWO === wo.id}>
                <div className="flex flex-wrap gap-2 mt-3">
                  {!checkedInWOs.has(wo.id) || checkedOutWOs.has(wo.id) ? (
                    <ActionBtn onClick={() => checkIn(wo.id)} disabled={busy} color="bg-[#b8902f] text-[#0f1626] hover:bg-[#d4af5a]">
                      GPS Check In
                    </ActionBtn>
                  ) : (
                    <ActionBtn onClick={() => checkOut(wo.id)} disabled={busy} color="bg-red-950/50 text-red-300 border border-red-500/30">
                      GPS Check Out
                    </ActionBtn>
                  )}
                  <ActionBtn onClick={() => completeJob(wo.id)} disabled={busy} color="bg-green-900/50 text-green-300 border border-green-500/30">
                    Mark Complete
                  </ActionBtn>
                  <div className="w-full flex flex-wrap items-center gap-2 mt-1">
                    <select
                      value={photoStage}
                      onChange={(e) => setPhotoStage(e.target.value as "before" | "after")}
                      className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="before">Before</option>
                      <option value="after">After</option>
                    </select>
                    <label className="cursor-pointer bg-[#213052] text-[#d4af5a] px-4 py-2.5 text-sm font-bold rounded-lg">
                      Choose File
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                        className="hidden"
                      />
                    </label>
                    {photoFile && (
                      <span className="text-[#a0977e] text-xs flex-1 truncate">{photoFile.name}</span>
                    )}
                    {photoFile && (
                      <button
                        onClick={() => uploadPhoto(wo.id)}
                        disabled={busy}
                        className="px-4 py-2.5 text-sm font-bold rounded-lg bg-[#b8902f] text-[#0f1626] hover:bg-[#d4af5a] disabled:opacity-50"
                      >
                        Upload
                      </button>
                    )}
                  </div>
                </div>
              </JobCard>
            ))}
          </Section>
        )}

        {/* Assigned */}
        {assignedWOs.length > 0 && (
          <Section title="Assigned to You" count={assignedWOs.length} color="text-[#d4af5a]">
            {assignedWOs.map((wo) => (
              <JobCard key={wo.id} wo={wo}>
                <div className="flex flex-wrap gap-2 mt-3">
                  <ActionBtn onClick={() => startJob(wo.id)} disabled={busy} color="bg-[#b8902f] text-[#0f1626] hover:bg-[#d4af5a]">
                    Start Job
                  </ActionBtn>
                  <ActionBtn onClick={() => checkIn(wo.id)} disabled={busy} color="bg-[#b8902f] text-[#0f1626] hover:bg-[#d4af5a]">
                    GPS Check In & Start
                  </ActionBtn>
                </div>
              </JobCard>
            ))}
          </Section>
        )}

        {/* Other */}
        {otherWOs.length > 0 && (
          <Section title="Other" count={otherWOs.length} color="text-[#a0977e]">
            {otherWOs.map((wo) => (
              <JobCard key={wo.id} wo={wo} />
            ))}
          </Section>
        )}

        {workOrders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#6b6454] text-lg">No active jobs assigned.</p>
            <p className="text-xs text-[#6b6454] mt-1">Check back later or contact your supervisor.</p>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f1626]/95 backdrop-blur-lg border-t border-[rgba(184,144,47,0.15)] px-4 py-3 flex justify-around">
        <Link href="/technician" className="text-center">
          <p className="text-xs text-[#d4af5a] font-bold">Jobs</p>
        </Link>
        <Link href="/work-orders" className="text-center">
          <p className="text-xs text-[#a0977e]">All Orders</p>
        </Link>
        <Link href="/store" className="text-center">
          <p className="text-xs text-[#a0977e]">Parts</p>
        </Link>
        <Link href="/notifications" className="text-center">
          <p className="text-xs text-[#a0977e]">Alerts</p>
        </Link>
      </nav>
    </div>
  );
}

function Section({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className={`text-xs font-bold ${color} tracking-[0.15em] uppercase mb-2`}>
        {title} ({count})
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function JobCard({ wo, expanded, children }: { wo: WO; expanded?: boolean; children?: React.ReactNode }) {
  const [open, setOpen] = useState(expanded ?? false);
  const prop = wo.properties as { name: string } | null;
  const unit = wo.units as { label: string } | null;

  return (
    <div
      className={`border rounded-xl p-3 bg-[#1a2640] transition-all ${
        wo.priority === "emergency"
          ? "border-red-500/50"
          : wo.priority === "high"
          ? "border-amber-500/30"
          : "border-[rgba(184,144,47,0.15)]"
      }`}
    >
      <div className="flex items-start justify-between" onClick={() => setOpen(!open)}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
              PRIORITY_COLORS[wo.priority]?.split(" ").slice(0, 2).join(" ") ?? ""
            }`}>
              {wo.priority}
            </span>
            <span className="text-[10px] text-[#a0977e] capitalize">{wo.type.replace(/_/g, " ")}</span>
            {wo.visit_source === "resident_booking" && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300">
                VISIT
              </span>
            )}
          </div>
          <p className="font-bold text-sm">{wo.title}</p>
          <p className="text-xs text-[#a0977e]">
            {[prop?.name, unit?.label].filter(Boolean).join(" · ") || "—"}
          </p>
          {wo.preferred_visit_date && (
            <p className="text-[10px] text-[#6b6454] mt-0.5">
              Preferred: {new Date(wo.preferred_visit_date).toLocaleDateString()}
              {wo.preferred_visit_time && ` · ${TIME_LABELS[wo.preferred_visit_time] ?? wo.preferred_visit_time}`}
            </p>
          )}
        </div>
        <div className="text-right ml-2">
          <p className="text-[10px] text-[#a0977e]">{STATUS_LABELS[wo.status] ?? wo.status}</p>
          <p className="text-lg">{open ? "▾" : "▸"}</p>
        </div>
      </div>

      {open && (
        <div className="mt-2 pt-2 border-t border-[rgba(184,144,47,0.1)]">
          {wo.description && (
            <p className="text-xs text-[#a0977e] mb-2">{wo.description}</p>
          )}
          <div className="flex gap-3 text-[10px] text-[#6b6454]">
            <span>Created: {new Date(wo.created_at).toLocaleDateString()}</span>
            {wo.started_at && <span>Started: {new Date(wo.started_at).toLocaleDateString()}</span>}
            {wo.hours_worked && <span>Hours: {Number(wo.hours_worked).toFixed(1)}h</span>}
          </div>
          {children}
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  onClick,
  disabled,
  color,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2.5 text-sm font-bold rounded-lg disabled:opacity-50 ${color}`}
    >
      {children}
    </button>
  );
}
