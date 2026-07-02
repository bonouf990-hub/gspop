import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { requireManagementRole } from "@/lib/check-permission";
import ExportCsv from "@/components/ExportCsv";

type WORow = {
  id: string;
  title: string;
  type: string;
  status: string;
  property_id: string;
  unit_id: string | null;
  assigned_technician_id: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  hours_worked: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  properties: { name: string } | null;
  units: { label: string } | null;
  technician: { full_name: string; hourly_rate: number | null; monthly_salary: number | null } | null;
};

type PartsCostRow = {
  work_order_id: string;
  total_cost: number | null;
  quantity: number;
  unit_cost: number | null;
  work_order: { property_id: string; unit_id: string | null } | null;
};

type BuildingSummary = {
  propertyId: string;
  propertyName: string;
  totalWorkOrders: number;
  partsCost: number;
  laborCost: number;
  externalCost: number;
  totalCost: number;
  totalHours: number;
  apartments: Map<string, ApartmentSummary>;
  byType: Map<string, TypeSummary>;
};

type ApartmentSummary = {
  unitLabel: string;
  totalWorkOrders: number;
  partsCost: number;
  laborCost: number;
  externalCost: number;
  totalCost: number;
  totalHours: number;
};

type TypeSummary = {
  type: string;
  count: number;
  partsCost: number;
  laborCost: number;
  externalCost: number;
  totalCost: number;
};

type TechSummary = {
  id: string;
  name: string;
  trade: string | null;
  monthlySalary: number;
  hourlyRate: number;
  totalHours: number;
  totalJobs: number;
  laborCost: number;
};

async function getReportData() {
  const supabase = await createClient();

  const closedStatuses = [
    "completed_by_technician",
    "verified_by_supervisor",
    "confirmed_by_resident",
    "closed",
  ];

  const [{ data: workOrders }, { data: partsCosts }, { data: technicians }] =
    await Promise.all([
      supabase
        .from("work_orders")
        .select(
          `id, title, type, status, property_id, unit_id, assigned_technician_id,
           estimated_cost, actual_cost, hours_worked, started_at, completed_at, created_at,
           properties(name), units(label),
           technician:user_profiles!work_orders_assigned_technician_id_fkey(full_name, hourly_rate, monthly_salary)`
        )
        .in("status", closedStatuses)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("parts_requests")
        .select(
          `work_order_id, total_cost, quantity, unit_cost,
           work_order:work_orders(property_id, unit_id)`
        )
        .in("status", ["delivered", "collected"])
        .limit(5000),
      supabase
        .from("user_profiles")
        .select("id, full_name, trade, monthly_salary, hourly_rate")
        .eq("role", "technician")
        .order("full_name"),
    ]);

  const woList = (workOrders ?? []) as unknown as WORow[];
  const partsList = (partsCosts ?? []) as unknown as PartsCostRow[];
  const techList = (technicians ?? []) as unknown as {
    id: string;
    full_name: string;
    trade: string | null;
    monthly_salary: number | null;
    hourly_rate: number | null;
  }[];

  const partsCostByWO = new Map<string, number>();
  const partsCostByProperty = new Map<string, number>();
  const partsCostByUnit = new Map<string, number>();

  for (const p of partsList) {
    const cost = p.total_cost ? Number(p.total_cost) : Number(p.quantity) * Number(p.unit_cost ?? 0);
    if (cost <= 0) continue;

    if (p.work_order_id) {
      partsCostByWO.set(p.work_order_id, (partsCostByWO.get(p.work_order_id) ?? 0) + cost);
    }

    const wo = p.work_order as { property_id: string; unit_id: string | null } | null;
    if (wo) {
      partsCostByProperty.set(wo.property_id, (partsCostByProperty.get(wo.property_id) ?? 0) + cost);
      if (wo.unit_id) {
        const key = `${wo.property_id}||${wo.unit_id}`;
        partsCostByUnit.set(key, (partsCostByUnit.get(key) ?? 0) + cost);
      }
    }
  }

  const buildings = new Map<string, BuildingSummary>();

  const techSummaries = new Map<string, TechSummary>();
  for (const t of techList) {
    techSummaries.set(t.id, {
      id: t.id,
      name: t.full_name,
      trade: t.trade,
      monthlySalary: Number(t.monthly_salary ?? 0),
      hourlyRate: Number(t.hourly_rate ?? 0),
      totalHours: 0,
      totalJobs: 0,
      laborCost: 0,
    });
  }

  for (const wo of woList) {
    const property = wo.properties as { name: string } | null;
    const unit = wo.units as { label: string } | null;
    const tech = wo.technician as { full_name: string; hourly_rate: number | null; monthly_salary: number | null } | null;

    if (!property) continue;

    const hours = Number(wo.hours_worked ?? 0);
    const hourlyRate = Number(tech?.hourly_rate ?? 0);
    const laborCost = hours * hourlyRate;
    const partsCost = partsCostByWO.get(wo.id) ?? 0;
    const externalCost = Number(wo.actual_cost ?? wo.estimated_cost ?? 0);

    if (!buildings.has(wo.property_id)) {
      buildings.set(wo.property_id, {
        propertyId: wo.property_id,
        propertyName: property.name,
        totalWorkOrders: 0,
        partsCost: 0,
        laborCost: 0,
        externalCost: 0,
        totalCost: 0,
        totalHours: 0,
        apartments: new Map(),
        byType: new Map(),
      });
    }

    const bldg = buildings.get(wo.property_id)!;
    bldg.totalWorkOrders++;
    bldg.partsCost += partsCost;
    bldg.laborCost += laborCost;
    bldg.externalCost += externalCost;
    bldg.totalCost += partsCost + laborCost + externalCost;
    bldg.totalHours += hours;

    const unitKey = wo.unit_id ?? "__common__";
    const unitLabel = unit?.label ?? "Common Area";
    if (!bldg.apartments.has(unitKey)) {
      bldg.apartments.set(unitKey, {
        unitLabel,
        totalWorkOrders: 0,
        partsCost: 0,
        laborCost: 0,
        externalCost: 0,
        totalCost: 0,
        totalHours: 0,
      });
    }
    const apt = bldg.apartments.get(unitKey)!;
    apt.totalWorkOrders++;
    apt.partsCost += partsCost;
    apt.laborCost += laborCost;
    apt.externalCost += externalCost;
    apt.totalCost += partsCost + laborCost + externalCost;
    apt.totalHours += hours;

    if (!bldg.byType.has(wo.type)) {
      bldg.byType.set(wo.type, { type: wo.type, count: 0, partsCost: 0, laborCost: 0, externalCost: 0, totalCost: 0 });
    }
    const typeSummary = bldg.byType.get(wo.type)!;
    typeSummary.count++;
    typeSummary.partsCost += partsCost;
    typeSummary.laborCost += laborCost;
    typeSummary.externalCost += externalCost;
    typeSummary.totalCost += partsCost + laborCost + externalCost;

    if (wo.assigned_technician_id && techSummaries.has(wo.assigned_technician_id)) {
      const ts = techSummaries.get(wo.assigned_technician_id)!;
      ts.totalHours += hours;
      ts.totalJobs++;
      ts.laborCost += laborCost;
    }
  }

  const buildingList = [...buildings.values()].sort((a, b) => b.totalCost - a.totalCost);
  const techData = [...techSummaries.values()].filter((t) => t.totalJobs > 0).sort((a, b) => b.totalJobs - a.totalJobs);

  const grandTotals = {
    workOrders: woList.length,
    partsCost: buildingList.reduce((s, b) => s + b.partsCost, 0),
    laborCost: buildingList.reduce((s, b) => s + b.laborCost, 0),
    externalCost: buildingList.reduce((s, b) => s + b.externalCost, 0),
    totalCost: buildingList.reduce((s, b) => s + b.totalCost, 0),
    totalHours: buildingList.reduce((s, b) => s + b.totalHours, 0),
  };

  return { buildingList, techData, grandTotals };
}

function fmtAED(n: number) {
  return n > 0 ? `AED ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—";
}

function fmtHrs(n: number) {
  return n > 0 ? `${n.toFixed(1)}h` : "—";
}

export default async function MaintenanceCostReport() {
  const auth = await requireManagementRole();
  if (!auth.allowed) {
    return <main className="p-8"><p className="text-[#5d6880]">You don&apos;t have access to this report.</p></main>;
  }

  const { buildingList, techData, grandTotals } = await getReportData();

  const csvRows = buildingList.flatMap((bldg) =>
    [...bldg.apartments.values()].map((apt) => ({
      Building: bldg.propertyName,
      Unit: apt.unitLabel,
      "Work Orders": apt.totalWorkOrders,
      "Parts (AED)": Math.round(apt.partsCost),
      "Labor (AED)": Math.round(apt.laborCost),
      "External (AED)": Math.round(apt.externalCost),
      "Total (AED)": Math.round(apt.totalCost),
    }))
  );

  const kpis = [
    { label: "Work Orders", value: grandTotals.workOrders, color: "text-[#d9647f]" },
    { label: "Parts Cost", value: fmtAED(grandTotals.partsCost), color: "text-[#d9647f]" },
    { label: "Labor Cost", value: fmtAED(grandTotals.laborCost), color: "text-[#8fb4e0]" },
    { label: "External Cost", value: fmtAED(grandTotals.externalCost), color: "text-[#9aa5bd]" },
    { label: "Total Cost", value: fmtAED(grandTotals.totalCost), color: "text-green-400" },
    { label: "Total Hours", value: fmtHrs(grandTotals.totalHours), color: "text-[#9aa5bd]" },
  ];

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <Link href="/" className="text-sm text-[#9aa5bd] hover:text-[#b01b42]">
            ← Dashboard
          </Link>
          <h1 className="mt-1">Maintenance Cost Report</h1>
          <p className="text-[#9aa5bd] text-sm mt-1">
            Complete cost breakdown per building and apartment — parts, labor, and external work.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportCsv rows={csvRows} filename="maintenance-costs" />
          <Link
            href="/reports/budgets"
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#b01b42] text-[#b01b42] hover:bg-[rgba(176,27,66,0.12)]"
          >
            Budget Tracker
          </Link>
          <span className="text-xs text-[#5d6880]">
            Generated: {new Date().toLocaleString()}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="lux-card p-4 text-center">
            <p className={`text-xl font-extrabold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-[#9aa5bd] uppercase tracking-wider mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Cost Distribution Bar */}
      {grandTotals.totalCost > 0 && (
        <div className="lux-card p-5 mb-8">
          <h2 className="eyebrow mb-3">
            Cost Distribution
          </h2>
          <div className="h-4 bg-[#0f1626] rounded-full overflow-hidden flex mb-2">
            {grandTotals.partsCost > 0 && (
              <div
                className="h-full bg-[#d9647f]"
                style={{ width: `${(grandTotals.partsCost / grandTotals.totalCost) * 100}%` }}
              />
            )}
            {grandTotals.laborCost > 0 && (
              <div
                className="h-full bg-[#8fb4e0]"
                style={{ width: `${(grandTotals.laborCost / grandTotals.totalCost) * 100}%` }}
              />
            )}
            {grandTotals.externalCost > 0 && (
              <div
                className="h-full bg-[#9aa5bd]"
                style={{ width: `${(grandTotals.externalCost / grandTotals.totalCost) * 100}%` }}
              />
            )}
          </div>
          <div className="flex gap-6 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#d9647f]" />
              Parts ({grandTotals.totalCost > 0 ? Math.round((grandTotals.partsCost / grandTotals.totalCost) * 100) : 0}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8fb4e0]" />
              Labor ({grandTotals.totalCost > 0 ? Math.round((grandTotals.laborCost / grandTotals.totalCost) * 100) : 0}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#9aa5bd]" />
              External ({grandTotals.totalCost > 0 ? Math.round((grandTotals.externalCost / grandTotals.totalCost) * 100) : 0}%)
            </span>
          </div>
        </div>
      )}

      {/* Per-Building Breakdown */}
      <section className="mb-8">
        <h2 className="eyebrow mb-4">
          Cost by Building
        </h2>
        {buildingList.length === 0 ? (
          <p className="text-[#5d6880] text-sm">No completed work orders to report.</p>
        ) : (
          <div className="space-y-6">
            {buildingList.map((bldg) => {
              const apartments = [...bldg.apartments.values()].sort((a, b) => b.totalCost - a.totalCost);
              const types = [...bldg.byType.values()].sort((a, b) => b.count - a.count);

              return (
                <div key={bldg.propertyId} className="lux-card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold">{bldg.propertyName}</h3>
                      <p className="text-xs text-[#9aa5bd]">
                        {bldg.totalWorkOrders} work orders · {fmtHrs(bldg.totalHours)} labor
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-extrabold text-[#d9647f]">{fmtAED(bldg.totalCost)}</p>
                      <p className="text-[10px] text-[#9aa5bd] uppercase">Total Maintenance Cost</p>
                    </div>
                  </div>

                  {/* Building cost split */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-[#0f1626] rounded-lg p-3 text-center">
                      <p className="text-sm font-bold text-[#d9647f]">{fmtAED(bldg.partsCost)}</p>
                      <p className="text-[10px] text-[#5d6880] uppercase">Parts</p>
                    </div>
                    <div className="bg-[#0f1626] rounded-lg p-3 text-center">
                      <p className="text-sm font-bold text-[#8fb4e0]">{fmtAED(bldg.laborCost)}</p>
                      <p className="text-[10px] text-[#5d6880] uppercase">Labor</p>
                    </div>
                    <div className="bg-[#0f1626] rounded-lg p-3 text-center">
                      <p className="text-sm font-bold text-[#9aa5bd]">{fmtAED(bldg.externalCost)}</p>
                      <p className="text-[10px] text-[#5d6880] uppercase">External</p>
                    </div>
                  </div>

                  {/* By Job Type */}
                  {types.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-[10px] font-bold text-[#9aa5bd] tracking-[0.15em] uppercase mb-2">
                        By Job Type
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {types.map((t) => (
                          <div key={t.type} className="bg-[#0f1626] rounded-lg px-3 py-2">
                            <p className="text-xs font-medium capitalize">{t.type}</p>
                            <p className="text-sm font-bold text-[#d9647f]">{fmtAED(t.totalCost)}</p>
                            <p className="text-[10px] text-[#5d6880]">{t.count} jobs</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Per-Apartment Table */}
                  <h4 className="text-[10px] font-bold text-[#9aa5bd] tracking-[0.15em] uppercase mb-2">
                    Cost per Apartment
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse min-w-[700px]">
                      <thead>
                        <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#9aa5bd] bg-[rgba(176,27,66,0.04)]">
                          <th className="px-5 py-3.5 font-medium">Apartment</th>
                          <th className="px-5 py-3.5 font-medium">Jobs</th>
                          <th className="px-5 py-3.5 font-medium">Hours</th>
                          <th className="px-5 py-3.5 font-medium">Parts</th>
                          <th className="px-5 py-3.5 font-medium">Labor</th>
                          <th className="px-5 py-3.5 font-medium">External</th>
                          <th className="px-5 py-3.5 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apartments.map((apt, i) => (
                          <tr key={i} className="border-b border-[rgba(176,27,66,0.08)] hover:bg-[#213052]">
                            <td className="px-5 py-3.5 font-medium">
                              {apt.unitLabel === "Common Area" ? (
                                <span className="text-[#5d6880]">Common Area</span>
                              ) : (
                                <span className="text-[#d9647f]">{apt.unitLabel}</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">{apt.totalWorkOrders}</td>
                            <td className="px-5 py-3.5 text-[#9aa5bd]">{fmtHrs(apt.totalHours)}</td>
                            <td className="px-5 py-3.5 text-[#d9647f]">{fmtAED(apt.partsCost)}</td>
                            <td className="px-5 py-3.5 text-[#8fb4e0]">{fmtAED(apt.laborCost)}</td>
                            <td className="px-5 py-3.5 text-[#9aa5bd]">{fmtAED(apt.externalCost)}</td>
                            <td className="px-5 py-3.5 font-bold text-[#d9647f]">{fmtAED(apt.totalCost)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-[rgba(176,27,66,0.3)]">
                          <td className="px-5 py-3.5 font-bold text-[#9aa5bd]">Building Total</td>
                          <td className="px-5 py-3.5 font-bold">{bldg.totalWorkOrders}</td>
                          <td className="px-5 py-3.5 font-bold text-[#9aa5bd]">{fmtHrs(bldg.totalHours)}</td>
                          <td className="px-5 py-3.5 font-bold text-[#d9647f]">{fmtAED(bldg.partsCost)}</td>
                          <td className="px-5 py-3.5 font-bold text-[#8fb4e0]">{fmtAED(bldg.laborCost)}</td>
                          <td className="px-5 py-3.5 font-bold text-[#9aa5bd]">{fmtAED(bldg.externalCost)}</td>
                          <td className="px-5 py-3.5 font-extrabold text-[#d9647f]">{fmtAED(bldg.totalCost)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Technician Labor Report */}
      <section className="mb-8">
        <h2 className="eyebrow mb-3">
          Technician Manpower Cost
        </h2>
        <p className="text-xs text-[#9aa5bd] mb-3">
          Labor cost per technician based on hourly rate and hours logged on completed work orders.
        </p>
        {techData.length === 0 ? (
          <p className="text-[#5d6880] text-sm">No technician data available.</p>
        ) : (
          <div className="lux-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#9aa5bd] bg-[rgba(176,27,66,0.04)]">
                  <th className="px-5 py-3.5 font-medium">Technician</th>
                  <th className="px-5 py-3.5 font-medium">Trade</th>
                  <th className="px-5 py-3.5 font-medium">Monthly Salary</th>
                  <th className="px-5 py-3.5 font-medium">Hourly Rate</th>
                  <th className="px-5 py-3.5 font-medium">Jobs Done</th>
                  <th className="px-5 py-3.5 font-medium">Total Hours</th>
                  <th className="px-5 py-3.5 font-medium">Labor Cost</th>
                  <th className="px-5 py-3.5 font-medium">Cost / Job</th>
                </tr>
              </thead>
              <tbody>
                {techData.map((t) => (
                  <tr key={t.id} className="border-b border-[rgba(176,27,66,0.08)] hover:bg-[#213052]">
                    <td className="px-5 py-3.5 font-medium">{t.name}</td>
                    <td className="px-5 py-3.5 text-[#9aa5bd] capitalize">{t.trade ?? "—"}</td>
                    <td className="px-5 py-3.5">{t.monthlySalary > 0 ? fmtAED(t.monthlySalary) : "—"}</td>
                    <td className="px-5 py-3.5">{t.hourlyRate > 0 ? fmtAED(t.hourlyRate) : "—"}</td>
                    <td className="px-5 py-3.5">{t.totalJobs}</td>
                    <td className="px-5 py-3.5 text-[#9aa5bd]">{fmtHrs(t.totalHours)}</td>
                    <td className="px-5 py-3.5 font-bold text-[#8fb4e0]">{fmtAED(t.laborCost)}</td>
                    <td className="px-5 py-3.5 text-[#d9647f]">
                      {t.totalJobs > 0 ? fmtAED(Math.round(t.laborCost / t.totalJobs)) : "—"}
                    </td>
                  </tr>
                ))}
                {techData.length > 1 && (
                  <tr className="border-t-2 border-[rgba(176,27,66,0.3)]">
                    <td className="px-5 py-3.5 font-bold text-[#9aa5bd]" colSpan={4}>Total</td>
                    <td className="px-5 py-3.5 font-bold">{techData.reduce((s, t) => s + t.totalJobs, 0)}</td>
                    <td className="px-5 py-3.5 font-bold text-[#9aa5bd]">
                      {fmtHrs(techData.reduce((s, t) => s + t.totalHours, 0))}
                    </td>
                    <td className="px-5 py-3.5 font-extrabold text-[#8fb4e0]">
                      {fmtAED(techData.reduce((s, t) => s + t.laborCost, 0))}
                    </td>
                    <td className="px-5 py-3.5" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </section>

      {/* Grand Total Summary */}
      <section className="border border-[#b01b42] bg-[#1a2640] rounded-xl p-5">
        <h2 className="eyebrow mb-3">
          Grand Total — All Buildings
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[700px]">
            <thead>
              <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#9aa5bd] bg-[rgba(176,27,66,0.04)]">
                <th className="px-5 py-3.5 font-medium">Building</th>
                <th className="px-5 py-3.5 font-medium">Jobs</th>
                <th className="px-5 py-3.5 font-medium">Hours</th>
                <th className="px-5 py-3.5 font-medium">Parts</th>
                <th className="px-5 py-3.5 font-medium">Labor</th>
                <th className="px-5 py-3.5 font-medium">External</th>
                <th className="px-5 py-3.5 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {buildingList.map((b) => (
                <tr key={b.propertyId} className="border-b border-[rgba(176,27,66,0.08)]">
                  <td className="px-5 py-3.5 font-medium">{b.propertyName}</td>
                  <td className="px-5 py-3.5">{b.totalWorkOrders}</td>
                  <td className="px-5 py-3.5 text-[#9aa5bd]">{fmtHrs(b.totalHours)}</td>
                  <td className="px-5 py-3.5 text-[#d9647f]">{fmtAED(b.partsCost)}</td>
                  <td className="px-5 py-3.5 text-[#8fb4e0]">{fmtAED(b.laborCost)}</td>
                  <td className="px-5 py-3.5 text-[#9aa5bd]">{fmtAED(b.externalCost)}</td>
                  <td className="px-5 py-3.5 font-bold text-[#d9647f]">{fmtAED(b.totalCost)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#b01b42]">
                <td className="px-5 py-3.5 font-extrabold text-[#b01b42]">GRAND TOTAL</td>
                <td className="px-5 py-3.5 font-extrabold">{grandTotals.workOrders}</td>
                <td className="px-5 py-3.5 font-extrabold text-[#9aa5bd]">{fmtHrs(grandTotals.totalHours)}</td>
                <td className="px-5 py-3.5 font-extrabold text-[#d9647f]">{fmtAED(grandTotals.partsCost)}</td>
                <td className="px-5 py-3.5 font-extrabold text-[#8fb4e0]">{fmtAED(grandTotals.laborCost)}</td>
                <td className="px-5 py-3.5 font-extrabold text-[#9aa5bd]">{fmtAED(grandTotals.externalCost)}</td>
                <td className="px-5 py-3.5 font-extrabold text-green-400 text-lg">{fmtAED(grandTotals.totalCost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
