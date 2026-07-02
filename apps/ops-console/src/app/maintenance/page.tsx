import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CreateSchedule from "./CreateSchedule";
import ScheduleActions from "./ScheduleActions";

type ScheduleRow = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  frequency: string;
  trade: string | null;
  priority: string;
  next_due_date: string;
  last_generated_at: string | null;
  is_active: boolean;
  estimated_duration_hours: number | null;
  checklist: unknown;
  created_at: string;
  property: { name: string } | null;
  unit: { label: string } | null;
  asset: { name: string } | null;
  technician: { full_name: string } | null;
  vendor: { name: string } | null;
};

type Property = { id: string; name: string };
type Unit = { id: string; label: string; property_id: string };
type Asset = { id: string; name: string; property_id: string };
type Vendor = { id: string; name: string };
type Tech = { id: string; full_name: string; trade: string | null };

async function getPageData() {
  const supabase = await createClient();
  const [
    { data: schedules },
    { data: properties },
    { data: units },
    { data: assets },
    { data: vendors },
    { data: technicians },
    { data: recentWOs },
  ] = await Promise.all([
    supabase
      .from("maintenance_schedules")
      .select(
        `id, title, description, type, frequency, trade, priority, next_due_date,
         last_generated_at, is_active, estimated_duration_hours, checklist, created_at,
         property:properties(name), unit:units(label),
         asset:assets(name),
         technician:user_profiles!maintenance_schedules_assigned_technician_id_fkey(full_name),
         vendor:vendors(name)`
      )
      .order("next_due_date", { ascending: true }),
    supabase.from("properties").select("id, name").order("name"),
    supabase.from("units").select("id, label, property_id").order("label"),
    supabase.from("assets").select("id, name, property_id").order("name"),
    supabase.from("vendors").select("id, name").order("name"),
    supabase.from("user_profiles").select("id, full_name, trade").eq("role", "technician"),
    supabase
      .from("work_orders")
      .select("id, title, status, created_at, maintenance_schedule_id")
      .not("maintenance_schedule_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    schedules: (schedules ?? []) as unknown as ScheduleRow[],
    properties: (properties ?? []) as Property[],
    units: (units ?? []) as Unit[],
    assets: (assets ?? []) as Asset[],
    vendors: (vendors ?? []) as Vendor[],
    technicians: (technicians ?? []) as Tech[],
    recentWOs: (recentWOs ?? []) as { id: string; title: string; status: string; created_at: string; maintenance_schedule_id: string }[],
  };
}

const FREQ_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  biannual: "Bi-annual",
  annual: "Annual",
};

const PRIORITY_STYLE: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-[rgba(176,27,66,0.12)] text-[#d9647f]",
  low: "bg-[#e9eef6] text-[#5b6b85]",
};

const TYPE_STYLE: Record<string, string> = {
  preventive: "bg-green-50 text-green-700",
  inspection: "bg-blue-50 text-blue-700",
  certification: "bg-purple-900/40 text-purple-300",
};

export default async function MaintenancePage() {
  const { schedules, properties, units, assets, vendors, technicians, recentWOs } = await getPageData();

  const active = schedules.filter((s) => s.is_active);
  const paused = schedules.filter((s) => !s.is_active);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = active.filter((s) => s.next_due_date <= today);
  const upcoming7 = active.filter((s) => {
    const d = new Date(s.next_due_date);
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);
    return d > now && d <= in7;
  });

  const woBySchedule = new Map<string, number>();
  for (const wo of recentWOs) {
    woBySchedule.set(wo.maintenance_schedule_id, (woBySchedule.get(wo.maintenance_schedule_id) ?? 0) + 1);
  }

  const kpis = [
    { label: "Active Schedules", value: active.length, color: "text-green-700" },
    { label: "Paused", value: paused.length, color: "text-[#8b97ab]" },
    { label: "Overdue", value: overdue.length, color: "text-red-600" },
    { label: "Due in 7 Days", value: upcoming7.length, color: "text-amber-700" },
    { label: "WOs Generated", value: recentWOs.length, color: "text-[#d9647f]" },
  ];

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="mt-1">Preventive Maintenance</h1>
          <p className="text-[#5b6b85] text-sm mt-1">
            Recurring schedules that auto-generate work orders on a set cadence.
          </p>
        </div>
        <CreateSchedule
          properties={properties}
          units={units}
          assets={assets}
          vendors={vendors}
          technicians={technicians}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="lux-card p-4 text-center">
            <p className={`text-2xl font-extrabold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-[#5b6b85] uppercase tracking-wider mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {overdue.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold text-red-600 tracking-[0.15em] uppercase mb-3">
            Overdue ({overdue.length})
          </h2>
          <div className="space-y-2">
            {overdue.map((s) => (
              <ScheduleCard key={s.id} s={s} woCount={woBySchedule.get(s.id) ?? 0} overdue />
            ))}
          </div>
        </section>
      )}

      {upcoming7.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold text-amber-700 tracking-[0.15em] uppercase mb-3">
            Due This Week ({upcoming7.length})
          </h2>
          <div className="space-y-2">
            {upcoming7.map((s) => (
              <ScheduleCard key={s.id} s={s} woCount={woBySchedule.get(s.id) ?? 0} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="eyebrow mb-3">
          All Schedules ({schedules.length})
        </h2>
        <div className="lux-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[900px]">
            <thead>
              <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#5b6b85] bg-[rgba(176,27,66,0.04)]">
                <th className="px-5 py-3.5 font-medium">Title</th>
                <th className="px-5 py-3.5 font-medium">Type</th>
                <th className="px-5 py-3.5 font-medium">Frequency</th>
                <th className="px-5 py-3.5 font-medium">Property</th>
                <th className="px-5 py-3.5 font-medium">Priority</th>
                <th className="px-5 py-3.5 font-medium">Next Due</th>
                <th className="px-5 py-3.5 font-medium">Assigned To</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
                <th className="px-5 py-3.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => {
                const prop = s.property as { name: string } | null;
                const unit = s.unit as { label: string } | null;
                const tech = s.technician as { full_name: string } | null;
                const vendor = s.vendor as { name: string } | null;
                const isOverdue = s.is_active && s.next_due_date <= today;
                return (
                  <tr
                    key={s.id}
                    className={`border-b border-[rgba(176,27,66,0.08)] hover:bg-[#f0f4f9] ${!s.is_active ? "opacity-50" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{s.title}</p>
                      {s.description && <p className="text-[10px] text-[#8b97ab]">{s.description}</p>}
                      {s.trade && <p className="text-[10px] text-[#5b6b85]">Trade: {s.trade}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TYPE_STYLE[s.type] ?? ""}`}>
                        {s.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">{FREQ_LABEL[s.frequency] ?? s.frequency}</td>
                    <td className="px-5 py-3.5 text-[#5b6b85]">
                      {[prop?.name, unit?.label].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${PRIORITY_STYLE[s.priority] ?? ""}`}>
                        {s.priority}
                      </span>
                    </td>
                    <td className={`px-5 py-3.5 ${isOverdue ? "text-red-600 font-bold" : "text-[#5b6b85]"}`}>
                      {new Date(s.next_due_date).toLocaleDateString()}
                      {isOverdue && <span className="text-[10px] block">OVERDUE</span>}
                    </td>
                    <td className="px-5 py-3.5 text-[#5b6b85]">
                      {tech?.full_name ?? vendor?.name ?? "Unassigned"}
                    </td>
                    <td className="px-5 py-3.5">
                      {s.is_active ? (
                        <span className="text-green-700 text-xs font-medium">Active</span>
                      ) : (
                        <span className="text-[#8b97ab] text-xs font-medium">Paused</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <ScheduleActions scheduleId={s.id} isActive={s.is_active} />
                    </td>
                  </tr>
                );
              })}
              {schedules.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-[#8b97ab] text-center" colSpan={9}>
                    No maintenance schedules yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </section>
    </main>
  );
}

function ScheduleCard({ s, woCount, overdue }: { s: ScheduleRow; woCount: number; overdue?: boolean }) {
  const prop = s.property as { name: string } | null;
  const tech = s.technician as { full_name: string } | null;
  const vendor = s.vendor as { name: string } | null;

  return (
    <div
      className={`border rounded-xl p-4 flex items-center justify-between ${
        overdue
          ? "border-red-500 bg-red-950/20"
          : "border-amber-500/50 bg-amber-50"
      }`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium">{s.title}</p>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TYPE_STYLE[s.type] ?? ""}`}>
            {s.type}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${PRIORITY_STYLE[s.priority] ?? ""}`}>
            {s.priority}
          </span>
          <span className="text-[10px] text-[#5b6b85]">{FREQ_LABEL[s.frequency] ?? s.frequency}</span>
        </div>
        <p className="text-sm text-[#5b6b85] mt-0.5">
          {[prop?.name, tech?.full_name ?? vendor?.name].filter(Boolean).join(" · ")}
          {` · Due ${new Date(s.next_due_date).toLocaleDateString()}`}
        </p>
        {woCount > 0 && (
          <p className="text-[10px] text-[#8b97ab]">{woCount} work orders generated</p>
        )}
      </div>
      <ScheduleActions scheduleId={s.id} isActive={s.is_active} />
    </div>
  );
}
