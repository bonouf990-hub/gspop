import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import PageHeader from "@/components/PageHeader";
import { Wallet } from "lucide-react";
import { requireManagementRole } from "@/lib/check-permission";
import SetBudget from "./SetBudget";
import ExportCsv from "@/components/ExportCsv";

type BudgetRow = {
  id: string;
  property_id: string;
  fiscal_year: number;
  total_budget: number;
  notes: string | null;
};

type PropertyRow = { id: string; name: string };

type WOCostRow = {
  property_id: string;
  actual_cost: number | null;
  estimated_cost: number | null;
  hours_worked: number | null;
  technician: { hourly_rate: number | null } | null;
};

type PartsCostRow = {
  total_cost: number | null;
  quantity: number;
  unit_cost: number | null;
  work_order: { property_id: string } | null;
};

type BuildingBudgetView = {
  propertyId: string;
  propertyName: string;
  budgetId: string | null;
  totalBudget: number;
  partsCost: number;
  laborCost: number;
  externalCost: number;
  totalSpent: number;
  remaining: number;
  pctUsed: number;
  notes: string | null;
};

async function getBudgetData(year: number) {
  const supabase = await createClient();

  const yearStart = `${year}-01-01T00:00:00Z`;
  const yearEnd = `${year}-12-31T23:59:59Z`;

  const closedStatuses = [
    "completed_by_technician",
    "verified_by_supervisor",
    "confirmed_by_resident",
    "closed",
  ];

  const [{ data: properties }, { data: budgets }, { data: workOrders }, { data: partsCosts }] =
    await Promise.all([
      supabase.from("properties").select("id, name").order("name"),
      supabase
        .from("building_budgets")
        .select("id, property_id, fiscal_year, total_budget, notes")
        .eq("fiscal_year", year),
      supabase
        .from("work_orders")
        .select(
          `property_id, actual_cost, estimated_cost, hours_worked,
           technician:user_profiles!work_orders_assigned_technician_id_fkey(hourly_rate)`
        )
        .in("status", closedStatuses)
        .gte("created_at", yearStart)
        .lte("created_at", yearEnd)
        .limit(5000),
      supabase
        .from("parts_requests")
        .select(
          `total_cost, quantity, unit_cost,
           work_order:work_orders(property_id)`
        )
        .in("status", ["delivered", "collected"])
        .limit(10000),
    ]);

  const propList = (properties ?? []) as PropertyRow[];
  const budgetList = (budgets ?? []) as BudgetRow[];
  const woList = (workOrders ?? []) as unknown as WOCostRow[];
  const partsList = (partsCosts ?? []) as unknown as PartsCostRow[];

  const budgetByProperty = new Map(budgetList.map((b) => [b.property_id, b]));

  const partsCostByProp = new Map<string, number>();
  for (const p of partsList) {
    const wo = p.work_order as { property_id: string } | null;
    if (!wo) continue;
    const cost = p.total_cost ? Number(p.total_cost) : Number(p.quantity) * Number(p.unit_cost ?? 0);
    if (cost > 0) {
      partsCostByProp.set(wo.property_id, (partsCostByProp.get(wo.property_id) ?? 0) + cost);
    }
  }

  const laborCostByProp = new Map<string, number>();
  const externalCostByProp = new Map<string, number>();
  for (const wo of woList) {
    const hours = Number(wo.hours_worked ?? 0);
    const tech = wo.technician as { hourly_rate: number | null } | null;
    const rate = Number(tech?.hourly_rate ?? 0);
    const labor = hours * rate;
    const ext = Number(wo.actual_cost ?? wo.estimated_cost ?? 0);

    if (labor > 0) {
      laborCostByProp.set(wo.property_id, (laborCostByProp.get(wo.property_id) ?? 0) + labor);
    }
    if (ext > 0) {
      externalCostByProp.set(wo.property_id, (externalCostByProp.get(wo.property_id) ?? 0) + ext);
    }
  }

  const views: BuildingBudgetView[] = propList.map((p) => {
    const budget = budgetByProperty.get(p.id);
    const totalBudget = budget ? Number(budget.total_budget) : 0;
    const partsCost = partsCostByProp.get(p.id) ?? 0;
    const laborCost = laborCostByProp.get(p.id) ?? 0;
    const externalCost = externalCostByProp.get(p.id) ?? 0;
    const totalSpent = partsCost + laborCost + externalCost;
    const remaining = totalBudget - totalSpent;
    const pctUsed = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    return {
      propertyId: p.id,
      propertyName: p.name,
      budgetId: budget?.id ?? null,
      totalBudget,
      partsCost,
      laborCost,
      externalCost,
      totalSpent,
      remaining,
      pctUsed,
      notes: budget?.notes ?? null,
    };
  });

  const grandBudget = views.reduce((s, v) => s + v.totalBudget, 0);
  const grandSpent = views.reduce((s, v) => s + v.totalSpent, 0);
  const grandRemaining = grandBudget - grandSpent;
  const grandPct = grandBudget > 0 ? Math.round((grandSpent / grandBudget) * 100) : 0;

  return { views, year, grandBudget, grandSpent, grandRemaining, grandPct };
}

function fmtAED(n: number) {
  if (n === 0) return "—";
  const abs = Math.abs(n);
  const formatted = `AED ${abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return n < 0 ? `-${formatted}` : formatted;
}

function statusColor(pct: number, hasBudget: boolean) {
  if (!hasBudget) return "text-[#8b97ab]";
  if (pct >= 100) return "text-red-600";
  if (pct >= 80) return "text-amber-700";
  return "text-green-700";
}

function barColor(pct: number) {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-green-500";
}

export default async function BudgetTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const auth = await requireManagementRole();
  if (!auth.allowed) {
    return <main className="p-6 sm:p-8"><p className="text-[#8b97ab]">You don&apos;t have access to this report.</p></main>;
  }

  const sp = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = sp.year ? parseInt(sp.year, 10) : currentYear;

  const { views, grandBudget, grandSpent, grandRemaining, grandPct } = await getBudgetData(year);

  const buildingsWithBudget = views.filter((v) => v.totalBudget > 0);
  const overBudget = views.filter((v) => v.totalBudget > 0 && v.totalSpent > v.totalBudget);

  const csvRows = views.map((v) => ({
    Building: v.propertyName,
    "Fiscal Year": year,
    "Total Budget (AED)": Math.round(v.totalBudget),
    "Parts (AED)": Math.round(v.partsCost),
    "Labor (AED)": Math.round(v.laborCost),
    "External (AED)": Math.round(v.externalCost),
    "Total Spent (AED)": Math.round(v.totalSpent),
    "Remaining (AED)": Math.round(v.remaining),
  }));

  const kpis = [
    { label: "Total Budget", value: fmtAED(grandBudget), color: "text-[#d9647f]" },
    { label: "Total Spent", value: fmtAED(grandSpent), color: grandPct >= 80 ? "text-amber-700" : "text-[#d9647f]" },
    { label: "Remaining", value: fmtAED(grandRemaining), color: grandRemaining < 0 ? "text-red-600" : "text-green-700" },
    { label: "Used", value: grandBudget > 0 ? `${grandPct}%` : "—", color: statusColor(grandPct, grandBudget > 0) },
    { label: "Buildings", value: buildingsWithBudget.length, color: "text-[#5b6b85]" },
    { label: "Over Budget", value: overBudget.length, color: overBudget.length > 0 ? "text-red-600" : "text-green-700" },
  ];

  return (
    <main className="p-6 sm:p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <p className="eyebrow mb-1.5 flex items-center gap-2"><Wallet size={12} /> Insight &amp; Reporting</p>
          <h1 className="mt-1">Building Budget Tracker</h1>
          <p className="text-[#5b6b85] text-sm mt-1">
            Annual maintenance budget per building — set budgets and track consumption in real time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportCsv rows={csvRows} filename="building-budgets" />
          <div className="flex gap-1">
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <Link
                key={y}
                href={`/reports/budgets?year=${y}`}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                  y === year
                    ? "bg-[#b01b42] text-[#f4f6fa]"
                    : "bg-[#e9eef6] text-[#5b6b85] hover:bg-[rgba(176,27,66,0.12)]"
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="lux-card p-4 text-center">
            <p className={`text-xl font-extrabold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-[#5b6b85] uppercase tracking-wider mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Grand Progress Bar */}
      {grandBudget > 0 && (
        <div className="lux-card p-5 mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="eyebrow">
              Overall Budget Utilization — {year}
            </h2>
            <span className={`text-sm font-bold ${statusColor(grandPct, true)}`}>{grandPct}%</span>
          </div>
          <div className="h-4 bg-[#f4f6fa] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor(grandPct)}`}
              style={{ width: `${Math.min(grandPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-2 text-[#8b97ab]">
            <span>Spent: {fmtAED(grandSpent)}</span>
            <span>Budget: {fmtAED(grandBudget)}</span>
          </div>
        </div>
      )}

      {/* Over-budget alerts */}
      {overBudget.length > 0 && (
        <div className="bg-gradient-to-br from-red-50 to-white border border-red-200 rounded-xl p-4 mb-6 shadow-[var(--shadow-sm)]">
          <h2 className="text-xs font-bold text-red-600 tracking-[0.15em] uppercase mb-2">
            Over Budget Alert ({overBudget.length})
          </h2>
          <ul className="space-y-1">
            {overBudget.map((v) => (
              <li key={v.propertyId} className="text-sm text-red-700">
                <span className="font-medium">{v.propertyName}</span> — exceeded by{" "}
                <span className="font-bold">AED {Math.abs(v.remaining).toLocaleString()}</span>{" "}
                ({v.pctUsed}% of budget used)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-Building Budget Table */}
      <section className="mb-8">
        <h2 className="eyebrow mb-3">
          Budget by Building — {year}
        </h2>
        <div className="space-y-4">
          {views.map((v) => (
            <div key={v.propertyId} className="lux-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold">{v.propertyName}</h3>
                    {v.totalBudget > 0 && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        v.pctUsed >= 100
                          ? "bg-red-50 text-red-700"
                          : v.pctUsed >= 80
                          ? "bg-amber-50 text-amber-700"
                          : "bg-green-50 text-green-700"
                      }`}>
                        {v.pctUsed}% used
                      </span>
                    )}
                  </div>
                  {v.notes && (
                    <p className="text-xs text-[#8b97ab] mb-2">{v.notes}</p>
                  )}
                </div>
                <SetBudget
                  propertyId={v.propertyId}
                  propertyName={v.propertyName}
                  year={year}
                  currentBudget={v.totalBudget}
                  currentNotes={v.notes}
                  budgetId={v.budgetId}
                />
              </div>

              {/* Progress bar */}
              {v.totalBudget > 0 && (
                <div className="mb-4">
                  <div className="h-3 bg-[#f4f6fa] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor(v.pctUsed)}`}
                      style={{ width: `${Math.min(v.pctUsed, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] mt-1 text-[#8b97ab]">
                    <span>Spent: {fmtAED(v.totalSpent)}</span>
                    <span>Remaining: <span className={v.remaining < 0 ? "text-red-600 font-bold" : "text-green-700"}>{fmtAED(v.remaining)}</span></span>
                    <span>Budget: {fmtAED(v.totalBudget)}</span>
                  </div>
                </div>
              )}

              {/* Cost breakdown */}
              <div className="grid grid-cols-5 gap-3 text-center">
                <div className="bg-[#f4f6fa] rounded-lg p-2.5">
                  <p className="text-xs font-bold text-[#d9647f]">{fmtAED(v.totalBudget)}</p>
                  <p className="text-[10px] text-[#8b97ab] uppercase">Budget</p>
                </div>
                <div className="bg-[#f4f6fa] rounded-lg p-2.5">
                  <p className="text-xs font-bold text-[#d9647f]">{fmtAED(v.partsCost)}</p>
                  <p className="text-[10px] text-[#8b97ab] uppercase">Parts</p>
                </div>
                <div className="bg-[#f4f6fa] rounded-lg p-2.5">
                  <p className="text-xs font-bold text-[#3d6cb3]">{fmtAED(v.laborCost)}</p>
                  <p className="text-[10px] text-[#8b97ab] uppercase">Labor</p>
                </div>
                <div className="bg-[#f4f6fa] rounded-lg p-2.5">
                  <p className="text-xs font-bold text-[#5b6b85]">{fmtAED(v.externalCost)}</p>
                  <p className="text-[10px] text-[#8b97ab] uppercase">External</p>
                </div>
                <div className="bg-[#f4f6fa] rounded-lg p-2.5">
                  <p className={`text-xs font-bold ${v.remaining < 0 ? "text-red-600" : "text-green-700"}`}>
                    {fmtAED(v.remaining)}
                  </p>
                  <p className="text-[10px] text-[#8b97ab] uppercase">Balance</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Summary Table */}
      <section className="border border-[#b01b42] bg-[#ffffff] rounded-xl p-5">
        <h2 className="eyebrow mb-3">
          Summary — All Buildings {year}
        </h2>
        <div className="overflow-x-auto">
          <table className="lux-table w-full text-sm border-collapse min-w-[800px]">
            <thead>
              <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#5b6b85] bg-[rgba(176,27,66,0.04)]">
                <th className="px-5 py-3.5 font-medium">Building</th>
                <th className="px-5 py-3.5 font-medium">Budget</th>
                <th className="px-5 py-3.5 font-medium">Parts</th>
                <th className="px-5 py-3.5 font-medium">Labor</th>
                <th className="px-5 py-3.5 font-medium">External</th>
                <th className="px-5 py-3.5 font-medium">Total Spent</th>
                <th className="px-5 py-3.5 font-medium">Balance</th>
                <th className="px-5 py-3.5 font-medium">Used</th>
              </tr>
            </thead>
            <tbody>
              {views.map((v) => (
                <tr key={v.propertyId} className="border-b border-[rgba(176,27,66,0.08)] hover:bg-[#f0f4f9]">
                  <td className="px-5 py-3.5 font-medium">{v.propertyName}</td>
                  <td className="px-5 py-3.5 text-[#d9647f]">{fmtAED(v.totalBudget)}</td>
                  <td className="px-5 py-3.5 text-[#d9647f]">{fmtAED(v.partsCost)}</td>
                  <td className="px-5 py-3.5 text-[#3d6cb3]">{fmtAED(v.laborCost)}</td>
                  <td className="px-5 py-3.5 text-[#5b6b85]">{fmtAED(v.externalCost)}</td>
                  <td className="px-5 py-3.5 font-bold">{fmtAED(v.totalSpent)}</td>
                  <td className={`px-5 py-3.5 font-bold ${v.remaining < 0 ? "text-red-600" : "text-green-700"}`}>
                    {fmtAED(v.remaining)}
                  </td>
                  <td className="px-5 py-3.5">
                    {v.totalBudget > 0 ? (
                      <span className={`font-bold ${statusColor(v.pctUsed, true)}`}>{v.pctUsed}%</span>
                    ) : (
                      <span className="text-[#8b97ab]">—</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#b01b42]">
                <td className="px-5 py-3.5 font-extrabold text-[#b01b42]">TOTAL</td>
                <td className="px-5 py-3.5 font-extrabold text-[#d9647f]">{fmtAED(grandBudget)}</td>
                <td className="px-5 py-3.5 font-extrabold text-[#d9647f]">
                  {fmtAED(views.reduce((s, v) => s + v.partsCost, 0))}
                </td>
                <td className="px-5 py-3.5 font-extrabold text-[#3d6cb3]">
                  {fmtAED(views.reduce((s, v) => s + v.laborCost, 0))}
                </td>
                <td className="px-5 py-3.5 font-extrabold text-[#5b6b85]">
                  {fmtAED(views.reduce((s, v) => s + v.externalCost, 0))}
                </td>
                <td className="px-5 py-3.5 font-extrabold">{fmtAED(grandSpent)}</td>
                <td className={`px-5 py-3.5 font-extrabold ${grandRemaining < 0 ? "text-red-600" : "text-green-700"}`}>
                  {fmtAED(grandRemaining)}
                </td>
                <td className="px-5 py-3.5">
                  {grandBudget > 0 ? (
                    <span className={`font-extrabold ${statusColor(grandPct, true)}`}>{grandPct}%</span>
                  ) : (
                    <span className="text-[#8b97ab]">—</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
