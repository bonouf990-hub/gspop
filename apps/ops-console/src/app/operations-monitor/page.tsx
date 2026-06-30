import { createClient } from "@/lib/supabase-server";
import {
  camelCaseKeys,
  type TechnicianCurrentStatus,
  type TradeCaseCounts,
  type TradeTechnicianUtilization,
} from "@gspop/shared";

const TRADE_LABELS: Record<string, string> = {
  hvac: "AC / HVAC",
  plumbing: "Plumbing",
  carpentry: "Carpentry",
  electrical: "Electrical",
  general: "General",
};

const TRADE_ICONS: Record<string, string> = {
  hvac: "❄️",
  plumbing: "🚿",
  carpentry: "🪚",
  electrical: "⚡",
  general: "🛠️",
};

async function getMonitorData() {
  const supabase = await createClient();
  const [{ data: caseCounts }, { data: utilization }, { data: technicians }] = await Promise.all([
    supabase.from("trade_case_counts").select("*"),
    supabase.from("trade_technician_utilization").select("*"),
    supabase.from("technician_current_status").select("*").order("trade"),
  ]);

  return {
    caseCounts: camelCaseKeys<TradeCaseCounts[]>(caseCounts ?? []),
    utilization: camelCaseKeys<TradeTechnicianUtilization[]>(utilization ?? []),
    technicians: camelCaseKeys<TechnicianCurrentStatus[]>(technicians ?? []),
  };
}

export default async function OperationsMonitorPage() {
  const { caseCounts, utilization, technicians } = await getMonitorData();

  const trades = Array.from(
    new Set([...caseCounts.map((c) => c.trade), ...utilization.map((u) => u.trade)])
  );

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-1">Operations Monitor</h1>
      <p className="text-gray-500 mb-8">
        Open cases and technician utilization by trade — who's busy, who's idle, right now.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {trades.map((trade) => {
          const cases = caseCounts.find((c) => c.trade === trade);
          const util = utilization.find((u) => u.trade === trade);
          const utilPct = util?.utilizationPct ?? 0;

          return (
            <div key={trade} className="border border-gray-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <span className="text-xl">{TRADE_ICONS[trade] ?? "🛠️"}</span>
                  {TRADE_LABELS[trade] ?? trade}
                </h2>
                <span className="text-2xl font-bold">{cases?.openCases ?? 0}</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">open cases</p>

              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Technicians busy</span>
                <span>
                  {util?.busyTechnicians ?? 0} / {util?.totalTechnicians ?? 0}
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2 mb-1">
                <div
                  className={`h-2 rounded-full ${
                    utilPct >= 80 ? "bg-red-500" : utilPct >= 50 ? "bg-amber-500" : "bg-green-500"
                  }`}
                  style={{ width: `${utilPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mb-4">{utilPct}% utilization</p>

              <div className="flex justify-between text-xs text-gray-400">
                <span>Idle: {util?.idleTechnicians ?? 0}</span>
                <span>Active jobs: {cases?.activeCases ?? 0}</span>
                <span>Pending approval: {cases?.pendingApproval ?? 0}</span>
              </div>
            </div>
          );
        })}
        {trades.length === 0 && <p className="text-gray-500">No technicians or work orders yet.</p>}
      </div>

      <h2 className="text-lg font-semibold mb-3">Technician Status</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-gray-700">
            <th className="py-2">Name</th>
            <th className="py-2">Trade</th>
            <th className="py-2">Status</th>
            <th className="py-2">Current Job</th>
          </tr>
        </thead>
        <tbody>
          {technicians.map((t) => (
            <tr key={t.technicianId} className="border-b border-gray-800">
              <td className="py-2">{t.fullName}</td>
              <td className="py-2">{TRADE_LABELS[t.trade] ?? t.trade}</td>
              <td className="py-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    t.status === "busy" ? "bg-blue-900 text-blue-300" : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {t.status}
                </span>
              </td>
              <td className="py-2 text-gray-400">{t.currentWorkOrderTitle ?? "—"}</td>
            </tr>
          ))}
          {technicians.length === 0 && (
            <tr>
              <td className="py-4 text-gray-500" colSpan={4}>
                No technicians yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
