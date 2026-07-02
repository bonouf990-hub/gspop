import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import type { TechnicianJobStats } from "@gspop/shared";
import ExportCsv from "@/components/ExportCsv";

async function getTechnicianStats(): Promise<TechnicianJobStats[]> {
  const supabase = await createClient();
  const [{ data: jobStats }, { data: hours }] = await Promise.all([
    supabase.from("technician_job_stats").select("*"),
    supabase.from("technician_hours_summary").select("*"),
  ]);

  const hoursByTechnician = new Map<string, number>(
    (hours ?? []).map((h: { technician_id: string; total_hours_logged: number }) => [
      h.technician_id,
      h.total_hours_logged,
    ])
  );

  return (jobStats ?? []).map(
    (s: {
      technician_id: string;
      full_name: string;
      department: string | null;
      reports_to_id: string | null;
      jobs_in_progress: number;
      jobs_completed: number;
      jobs_total: number;
      total_spend: number;
      avg_supervisor_rating: number;
      avg_resident_rating: number;
    }) => ({
      technicianId: s.technician_id,
      fullName: s.full_name,
      department: s.department,
      reportsToId: s.reports_to_id,
      jobsInProgress: s.jobs_in_progress,
      jobsCompleted: s.jobs_completed,
      jobsTotal: s.jobs_total,
      totalSpend: s.total_spend,
      avgSupervisorRating: s.avg_supervisor_rating,
      avgResidentRating: s.avg_resident_rating,
      totalHoursLogged: hoursByTechnician.get(s.technician_id) ?? 0,
    })
  );
}

export default async function StaffDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>;
}) {
  const { department } = await searchParams;
  const allStats = await getTechnicianStats();
  const departments = Array.from(new Set(allStats.map((s) => s.department).filter(Boolean)));
  const stats = department ? allStats.filter((s) => s.department === department) : allStats;

  const csvRows = stats.map((s) => ({
    Technician: s.fullName,
    Department: s.department ?? "",
    "Jobs In Progress": s.jobsInProgress,
    "Jobs Completed": s.jobsCompleted,
    "Total Jobs": s.jobsTotal,
    "Hours Logged": Number(s.totalHoursLogged.toFixed(1)),
    "Spend (AED)": Number(s.totalSpend.toFixed(2)),
    "Supervisor Rating": Number(s.avgSupervisorRating.toFixed(1)),
    "Resident Rating": Number(s.avgResidentRating.toFixed(1)),
  }));

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="mt-1">Staff KPI Dashboard</h1>
          <p className="text-[#5b6b85] mt-1">
            Job load, hours on-site, spend, and quality ratings per technician — the same data feeds
            KPI scoring up through supervisor and head-of-department review.
          </p>
        </div>
        <ExportCsv rows={csvRows} filename="staff-kpis" />
      </div>

      <div className="flex gap-2 mb-6">
        <a
          href="/staff-dashboard"
          className={`px-3 py-1 rounded-full text-sm font-medium ${!department ? "bg-[#b01b42] text-[#f4f6fa]" : "bg-[#ffffff] text-[#5b6b85] border border-[rgba(176,27,66,0.15)]"}`}
        >
          All departments
        </a>
        {departments.map((d) => (
          <a
            key={d}
            href={`/staff-dashboard?department=${encodeURIComponent(d!)}`}
            className={`px-3 py-1 rounded-full text-sm font-medium ${department === d ? "bg-[#b01b42] text-[#f4f6fa]" : "bg-[#ffffff] text-[#5b6b85] border border-[rgba(176,27,66,0.15)]"}`}
          >
            {d}
          </a>
        ))}
      </div>

      <div className="lux-card overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[900px]">
        <thead>
          <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#5b6b85] bg-[rgba(176,27,66,0.04)]">
            <th className="px-5 py-3.5">Technician</th>
            <th className="px-5 py-3.5">Department</th>
            <th className="px-5 py-3.5">In Progress</th>
            <th className="px-5 py-3.5">Completed</th>
            <th className="px-5 py-3.5">Total Jobs</th>
            <th className="px-5 py-3.5">Hours Logged</th>
            <th className="px-5 py-3.5">Spend</th>
            <th className="px-5 py-3.5">Supervisor Rating</th>
            <th className="px-5 py-3.5">Resident Rating</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.technicianId} className="border-b border-[rgba(176,27,66,0.08)]">
              <td className="px-5 py-3.5">{s.fullName}</td>
              <td className="px-5 py-3.5">{s.department ?? "—"}</td>
              <td className="px-5 py-3.5">{s.jobsInProgress}</td>
              <td className="px-5 py-3.5">{s.jobsCompleted}</td>
              <td className="px-5 py-3.5">{s.jobsTotal}</td>
              <td className="px-5 py-3.5">{s.totalHoursLogged.toFixed(1)}</td>
              <td className="px-5 py-3.5">{s.totalSpend.toFixed(2)}</td>
              <td className="px-5 py-3.5">{s.avgSupervisorRating.toFixed(1)} / 5</td>
              <td className="px-5 py-3.5">{s.avgResidentRating.toFixed(1)} / 5</td>
            </tr>
          ))}
          {stats.length === 0 && (
            <tr>
              <td className="px-5 py-10 text-[#8b97ab] text-center" colSpan={9}>
                No technician activity yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      </div>
    </main>
  );
}
