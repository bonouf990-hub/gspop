import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import type { TechnicianJobStats } from "@gspop/shared";

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

  return (
    <main className="p-8">
      <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">← Dashboard</Link>
      <h1 className="text-2xl font-extrabold mt-1 mb-2">Staff KPI Dashboard</h1>
      <p className="text-[#a0977e] mb-6">
        Job load, hours on-site, spend, and quality ratings per technician — the same data feeds
        KPI scoring up through supervisor and head-of-department review.
      </p>

      <div className="flex gap-2 mb-6">
        <a
          href="/staff-dashboard"
          className={`px-3 py-1 rounded-full text-sm font-medium ${!department ? "bg-[#b8902f] text-[#0f1626]" : "bg-[#1a2640] text-[#a0977e] border border-[rgba(184,144,47,0.15)]"}`}
        >
          All departments
        </a>
        {departments.map((d) => (
          <a
            key={d}
            href={`/staff-dashboard?department=${encodeURIComponent(d!)}`}
            className={`px-3 py-1 rounded-full text-sm font-medium ${department === d ? "bg-[#b8902f] text-[#0f1626]" : "bg-[#1a2640] text-[#a0977e] border border-[rgba(184,144,47,0.15)]"}`}
          >
            {d}
          </a>
        ))}
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
            <th className="py-2">Technician</th>
            <th className="py-2">Department</th>
            <th className="py-2">In Progress</th>
            <th className="py-2">Completed</th>
            <th className="py-2">Total Jobs</th>
            <th className="py-2">Hours Logged</th>
            <th className="py-2">Spend</th>
            <th className="py-2">Supervisor Rating</th>
            <th className="py-2">Resident Rating</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.technicianId} className="border-b border-[rgba(184,144,47,0.08)]">
              <td className="py-2">{s.fullName}</td>
              <td className="py-2">{s.department ?? "—"}</td>
              <td className="py-2">{s.jobsInProgress}</td>
              <td className="py-2">{s.jobsCompleted}</td>
              <td className="py-2">{s.jobsTotal}</td>
              <td className="py-2">{s.totalHoursLogged.toFixed(1)}</td>
              <td className="py-2">{s.totalSpend.toFixed(2)}</td>
              <td className="py-2">{s.avgSupervisorRating.toFixed(1)} / 5</td>
              <td className="py-2">{s.avgResidentRating.toFixed(1)} / 5</td>
            </tr>
          ))}
          {stats.length === 0 && (
            <tr>
              <td className="py-4 text-[#6b6454]" colSpan={9}>
                No technician activity yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
