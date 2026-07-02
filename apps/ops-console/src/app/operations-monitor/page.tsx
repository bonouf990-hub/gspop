import Link from "next/link";
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
  hvac: "AC",
  plumbing: "PL",
  carpentry: "CA",
  electrical: "EL",
  general: "GN",
};

type BudgetActual = {
  budget_id: string;
  property_id: string;
  category: string;
  fiscal_year: number;
  fiscal_month: number;
  budgeted_amount: number;
  actual_amount: number;
};

async function getMonitorData() {
  const supabase = await createClient();
  const now = new Date();
  const [{ data: caseCounts }, { data: utilization }, { data: technicians }, { data: budgets }, { data: properties }] =
    await Promise.all([
      supabase.from("trade_case_counts").select("*"),
      supabase.from("trade_technician_utilization").select("*"),
      supabase.from("technician_current_status").select("*").order("trade"),
      supabase
        .from("budget_actuals")
        .select("*")
        .eq("fiscal_year", now.getFullYear())
        .eq("fiscal_month", now.getMonth() + 1),
      supabase.from("properties").select("id, name"),
    ]);

  const propertiesById = new Map(
    ((properties ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name])
  );

  return {
    caseCounts: camelCaseKeys<TradeCaseCounts[]>(caseCounts ?? []),
    utilization: camelCaseKeys<TradeTechnicianUtilization[]>(utilization ?? []),
    technicians: camelCaseKeys<TechnicianCurrentStatus[]>(technicians ?? []),
    budgets: (budgets ?? []) as BudgetActual[],
    propertiesById,
  };
}

export default async function OperationsMonitorPage() {
  const { caseCounts, utilization, technicians, budgets, propertiesById } = await getMonitorData();

  const trades = Array.from(
    new Set([...caseCounts.map((c) => c.trade), ...utilization.map((u) => u.trade)])
  );

  return (
    <main className="p-8">
      <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">← Dashboard</Link>
      <h1 className="text-2xl font-extrabold mt-1 mb-1">Operations Monitor</h1>
      <p className="text-[#a0977e] mb-8">
        Open cases and technician utilization by trade — who's busy, who's idle, right now.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {trades.map((trade) => {
          const cases = caseCounts.find((c) => c.trade === trade);
          const util = utilization.find((u) => u.trade === trade);
          const utilPct = util?.utilizationPct ?? 0;

          return (
            <div key={trade} className="lux-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-[rgba(184,144,47,0.12)] text-[#d4af5a] text-xs font-bold flex items-center justify-center">
                    {TRADE_ICONS[trade] ?? "GN"}
                  </span>
                  {TRADE_LABELS[trade] ?? trade}
                </h2>
                <span className="text-2xl font-extrabold">{cases?.openCases ?? 0}</span>
              </div>
              <p className="text-xs text-[#6b6454] mb-3">open cases</p>

              <div className="flex justify-between text-sm mb-1">
                <span className="text-[#a0977e]">Technicians busy</span>
                <span>
                  {util?.busyTechnicians ?? 0} / {util?.totalTechnicians ?? 0}
                </span>
              </div>
              <div className="w-full bg-[#213052] rounded-full h-2 mb-1">
                <div
                  className={`h-2 rounded-full ${
                    utilPct >= 80 ? "bg-red-500" : utilPct >= 50 ? "bg-amber-500" : "bg-green-500"
                  }`}
                  style={{ width: `${utilPct}%` }}
                />
              </div>
              <p className="text-xs text-[#6b6454] mb-4">{utilPct}% utilization</p>

              <div className="flex justify-between text-xs text-[#a0977e]">
                <span>Idle: {util?.idleTechnicians ?? 0}</span>
                <span>Active jobs: {cases?.activeCases ?? 0}</span>
                <span>Pending approval: {cases?.pendingApproval ?? 0}</span>
              </div>
            </div>
          );
        })}
        {trades.length === 0 && <p className="text-[#6b6454]">No technicians or work orders yet.</p>}
      </div>

      {budgets.length > 0 && (
        <>
          <h2 className="text-lg font-bold mb-3">Budget vs Actual — This Month</h2>
          <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse mb-10 min-w-[700px]">
            <thead>
              <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
                <th className="py-2">Property</th>
                <th className="py-2">Category</th>
                <th className="py-2">Budget (AED)</th>
                <th className="py-2">Actual (AED)</th>
                <th className="py-2">Remaining</th>
                <th className="py-2">Usage</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => {
                const budgeted = Number(b.budgeted_amount);
                const actual = Number(b.actual_amount);
                const remaining = budgeted - actual;
                const pct = budgeted > 0 ? Math.round((actual / budgeted) * 100) : 0;
                return (
                  <tr key={b.budget_id} className="border-b border-[rgba(184,144,47,0.08)]">
                    <td className="py-2">{propertiesById.get(b.property_id) ?? "—"}</td>
                    <td className="py-2 capitalize">{b.category}</td>
                    <td className="py-2 text-[#a0977e]">{budgeted.toLocaleString()}</td>
                    <td className="py-2 font-medium">{actual.toLocaleString()}</td>
                    <td className={`py-2 font-medium ${remaining < 0 ? "text-red-400" : "text-green-400"}`}>
                      {remaining.toLocaleString()}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-[#213052] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${pct > 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#6b6454]">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}

      <h2 className="text-lg font-bold mb-3">Technician Status</h2>
      <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[600px]">
        <thead>
          <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
            <th className="py-2">Name</th>
            <th className="py-2">Trade</th>
            <th className="py-2">Status</th>
            <th className="py-2">Current Job</th>
          </tr>
        </thead>
        <tbody>
          {technicians.map((t) => (
            <tr key={t.technicianId} className="border-b border-[rgba(184,144,47,0.08)]">
              <td className="py-2">{t.fullName}</td>
              <td className="py-2">{TRADE_LABELS[t.trade] ?? t.trade}</td>
              <td className="py-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    t.status === "busy" ? "bg-[rgba(184,144,47,0.12)] text-[#d4af5a]" : "bg-[#213052] text-[#a0977e]"
                  }`}
                >
                  {t.status}
                </span>
              </td>
              <td className="py-2 text-[#a0977e]">{t.currentWorkOrderTitle ?? "—"}</td>
            </tr>
          ))}
          {technicians.length === 0 && (
            <tr>
              <td className="py-4 text-[#6b6454]" colSpan={4}>
                No technicians yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </main>
  );
}
