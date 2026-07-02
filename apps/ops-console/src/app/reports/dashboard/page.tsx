import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { requireManagementRole } from "@/lib/check-permission";
import ExportCsv from "@/components/ExportCsv";
import PageHeader from "@/components/PageHeader";
import StatTile from "@/components/StatTile";

type WORow = {
  id: string;
  status: string;
  type: string;
  priority: string;
  property_id: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  hours_worked: number | null;
  actual_cost: number | null;
  estimated_cost: number | null;
  technician: { hourly_rate: number | null } | null;
};

async function getDashboardData() {
  const supabase = await createClient();

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();

  const [
    { data: properties },
    { data: units },
    { data: leases },
    { data: invoices },
    { data: workOrders },
    { data: complaints },
    { count: totalUnits },
  ] = await Promise.all([
    supabase.from("properties").select("id, name"),
    supabase.from("units").select("id, property_id"),
    supabase.from("leases").select("id, unit_id, status, start_date, end_date, rent_amount"),
    supabase
      .from("rent_invoices")
      .select("id, amount, status, due_date, lease_id")
      .gte("due_date", threeMonthsAgo)
      .order("due_date", { ascending: false })
      .limit(5000),
    supabase
      .from("work_orders")
      .select(
        `id, status, type, priority, property_id, created_at, started_at, completed_at, hours_worked, actual_cost, estimated_cost,
         technician:user_profiles!work_orders_assigned_technician_id_fkey(hourly_rate)`
      )
      .gte("created_at", threeMonthsAgo)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("complaints")
      .select("id, status, priority, submitted_at, resolved_at, property_id")
      .gte("submitted_at", threeMonthsAgo)
      .limit(5000),
    supabase.from("units").select("id", { count: "exact", head: true }),
  ]);

  const propList = (properties ?? []) as { id: string; name: string }[];
  const unitList = (units ?? []) as { id: string; property_id: string }[];
  const leaseList = (leases ?? []) as {
    id: string; unit_id: string; status: string;
    start_date: string; end_date: string | null; rent_amount: number | null;
  }[];
  const invoiceList = (invoices ?? []) as {
    id: string; amount: number; status: string; due_date: string; lease_id: string;
  }[];
  const woList = (workOrders ?? []) as unknown as WORow[];
  const complaintList = (complaints ?? []) as {
    id: string; status: string; priority: string;
    submitted_at: string; resolved_at: string | null; property_id: string;
  }[];

  // --- Occupancy ---
  const activeLeases = leaseList.filter((l) => l.status === "active");
  const occupiedUnitIds = new Set(activeLeases.map((l) => l.unit_id));
  const totalUnitCount = totalUnits ?? unitList.length;
  const occupancyRate = totalUnitCount > 0 ? Math.round((occupiedUnitIds.size / totalUnitCount) * 100) : 0;

  // --- Rent Collection ---
  const thisMonthInvoices = invoiceList.filter(
    (inv) => inv.due_date >= thisMonthStart.slice(0, 10)
  );
  const lastMonthInvoices = invoiceList.filter(
    (inv) => inv.due_date >= lastMonthStart.slice(0, 10) && inv.due_date <= lastMonthEnd.slice(0, 10)
  );
  const paidStatuses = ["paid", "cleared"];
  const thisMonthPaid = thisMonthInvoices.filter((i) => paidStatuses.includes(i.status));
  const lastMonthPaid = lastMonthInvoices.filter((i) => paidStatuses.includes(i.status));
  const thisMonthCollectionRate =
    thisMonthInvoices.length > 0
      ? Math.round((thisMonthPaid.reduce((s, i) => s + Number(i.amount), 0) /
          thisMonthInvoices.reduce((s, i) => s + Number(i.amount), 0)) * 100)
      : 0;
  const lastMonthCollectionRate =
    lastMonthInvoices.length > 0
      ? Math.round((lastMonthPaid.reduce((s, i) => s + Number(i.amount), 0) /
          lastMonthInvoices.reduce((s, i) => s + Number(i.amount), 0)) * 100)
      : 0;
  const overdueInvoices = invoiceList.filter((i) => i.status === "overdue");
  const totalOverdueAmount = overdueInvoices.reduce((s, i) => s + Number(i.amount), 0);

  // --- Work Orders ---
  const closedStatuses = ["completed_by_technician", "verified_by_supervisor", "confirmed_by_resident", "closed"];
  const openStatuses = ["draft", "assigned", "in_progress", "paused"];
  const openWOs = woList.filter((wo) => openStatuses.includes(wo.status));
  const completedWOs = woList.filter((wo) => closedStatuses.includes(wo.status));
  const emergencyWOs = woList.filter((wo) => wo.priority === "emergency");

  const turnaroundTimes = completedWOs
    .filter((wo) => wo.completed_at && wo.created_at)
    .map((wo) => {
      const created = new Date(wo.created_at).getTime();
      const completed = new Date(wo.completed_at!).getTime();
      return (completed - created) / (1000 * 60 * 60);
    })
    .filter((h) => h > 0 && h < 720);
  const avgTurnaround = turnaroundTimes.length > 0
    ? turnaroundTimes.reduce((s, h) => s + h, 0) / turnaroundTimes.length
    : 0;

  // WO by type
  const woByType = new Map<string, number>();
  for (const wo of woList) {
    woByType.set(wo.type, (woByType.get(wo.type) ?? 0) + 1);
  }

  // WO by property
  const woByProperty = new Map<string, { open: number; completed: number; total: number }>();
  for (const wo of woList) {
    const entry = woByProperty.get(wo.property_id) ?? { open: 0, completed: 0, total: 0 };
    entry.total++;
    if (openStatuses.includes(wo.status)) entry.open++;
    if (closedStatuses.includes(wo.status)) entry.completed++;
    woByProperty.set(wo.property_id, entry);
  }

  // Monthly WO trend (last 3 months)
  const monthlyWO: { month: string; created: number; completed: number }[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = d.toLocaleString("default", { month: "short", year: "2-digit" });
    const monthStart = d.toISOString();
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const created = woList.filter((wo) => wo.created_at >= monthStart && wo.created_at <= monthEnd).length;
    const completed = completedWOs.filter(
      (wo) => wo.completed_at && wo.completed_at >= monthStart && wo.completed_at <= monthEnd
    ).length;
    monthlyWO.push({ month: monthStr, created, completed });
  }

  // --- Complaints ---
  const openComplaints = complaintList.filter(
    (c) => !["resolved", "closed", "rejected"].includes(c.status)
  );
  const resolvedComplaints = complaintList.filter(
    (c) => c.resolved_at
  );
  const complaintResolutionTimes = resolvedComplaints
    .map((c) => {
      const submitted = new Date(c.submitted_at).getTime();
      const resolved = new Date(c.resolved_at!).getTime();
      return (resolved - submitted) / (1000 * 60 * 60);
    })
    .filter((h) => h > 0 && h < 720);
  const avgComplaintResolution = complaintResolutionTimes.length > 0
    ? complaintResolutionTimes.reduce((s, h) => s + h, 0) / complaintResolutionTimes.length
    : 0;

  // --- Cost per unit ---
  const totalMaintenanceCost = completedWOs.reduce((s, wo) => {
    const hours = Number(wo.hours_worked ?? 0);
    const tech = wo.technician as { hourly_rate: number | null } | null;
    const rate = Number(tech?.hourly_rate ?? 0);
    const labor = hours * rate;
    const external = Number(wo.actual_cost ?? wo.estimated_cost ?? 0);
    return s + labor + external;
  }, 0);
  const costPerUnit = totalUnitCount > 0 ? Math.round(totalMaintenanceCost / totalUnitCount) : 0;

  // --- Lease Expiry ---
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const expiringLeases = activeLeases.filter(
    (l) => l.end_date && l.end_date <= sixtyDaysFromNow
  );
  const urgentExpiringLeases = activeLeases.filter(
    (l) => l.end_date && l.end_date <= thirtyDaysFromNow
  );

  // Per-building stats
  const propMap = new Map(propList.map((p) => [p.id, p.name]));
  const unitsPerProperty = new Map<string, number>();
  for (const u of unitList) {
    unitsPerProperty.set(u.property_id, (unitsPerProperty.get(u.property_id) ?? 0) + 1);
  }
  const occupiedPerProperty = new Map<string, number>();
  for (const l of activeLeases) {
    const u = unitList.find((u) => u.id === l.unit_id);
    if (u) {
      occupiedPerProperty.set(u.property_id, (occupiedPerProperty.get(u.property_id) ?? 0) + 1);
    }
  }

  const buildingStats = propList.map((p) => {
    const total = unitsPerProperty.get(p.id) ?? 0;
    const occupied = occupiedPerProperty.get(p.id) ?? 0;
    const wos = woByProperty.get(p.id) ?? { open: 0, completed: 0, total: 0 };
    const bComplaints = complaintList.filter((c) => c.property_id === p.id);
    const bOpen = bComplaints.filter((c) => !["resolved", "closed", "rejected"].includes(c.status)).length;
    return {
      id: p.id,
      name: p.name,
      totalUnits: total,
      occupied,
      occupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0,
      openWOs: wos.open,
      completedWOs: wos.completed,
      totalWOs: wos.total,
      openComplaints: bOpen,
      totalComplaints: bComplaints.length,
    };
  }).sort((a, b) => b.totalUnits - a.totalUnits);

  return {
    occupancyRate,
    occupiedUnits: occupiedUnitIds.size,
    totalUnitCount,
    thisMonthCollectionRate,
    lastMonthCollectionRate,
    totalOverdueAmount,
    overdueCount: overdueInvoices.length,
    openWOs: openWOs.length,
    completedWOs: completedWOs.length,
    emergencyWOs: emergencyWOs.length,
    avgTurnaround,
    woByType: [...woByType.entries()].sort((a, b) => b[1] - a[1]),
    monthlyWO,
    openComplaints: openComplaints.length,
    totalComplaints: complaintList.length,
    avgComplaintResolution,
    costPerUnit,
    totalMaintenanceCost,
    expiringLeases: expiringLeases.length,
    urgentExpiringLeases: urgentExpiringLeases.length,
    activeLeaseCount: activeLeases.length,
    buildingStats,
  };
}

function fmtAED(n: number) {
  if (n === 0) return "—";
  return `AED ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtHours(h: number) {
  if (h === 0) return "—";
  if (h < 24) return `${h.toFixed(1)}h`;
  const days = h / 24;
  return `${days.toFixed(1)}d`;
}

function trendArrow(current: number, previous: number) {
  if (previous === 0) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 1) return null;
  return diff > 0
    ? { arrow: "↑", color: "text-green-700", value: `+${Math.abs(diff)}%` }
    : { arrow: "↓", color: "text-red-600", value: `${Math.abs(diff)}%` };
}

function barWidth(value: number, max: number) {
  if (max === 0) return "0%";
  return `${Math.min(Math.round((value / max) * 100), 100)}%`;
}

export default async function AnalyticsDashboard() {
  const auth = await requireManagementRole();
  if (!auth.allowed) {
    return <main className="p-6 sm:p-8"><p className="text-[#8b97ab]">You don&apos;t have access to this dashboard.</p></main>;
  }

  const data = await getDashboardData();
  const collectionTrend = trendArrow(data.thisMonthCollectionRate, data.lastMonthCollectionRate);
  const maxWOByType = data.woByType.length > 0 ? data.woByType[0][1] : 1;

  const csvRows = data.buildingStats.map((b) => ({
    Building: b.name,
    Units: b.totalUnits,
    Occupied: b.occupied,
    "Occupancy (%)": b.occupancyRate,
    "Open Work Orders": b.openWOs,
    "Completed Work Orders": b.completedWOs,
    "Open Complaints": b.openComplaints,
    "Total Complaints": b.totalComplaints,
  }));

  return (
    <main className="p-6 sm:p-8 max-w-6xl mx-auto">
      <div className="rise-in">
        <PageHeader
          eyebrow="Insight & Reporting"
          title="Analytics Dashboard"
          icon={BarChart3}
          description="Real-time KPIs across occupancy, revenue, maintenance, and operations."
          actions={
            <>
              <ExportCsv rows={csvRows} filename="building-performance" />
              <Link href="/reports/maintenance-costs" className="btn-ghost text-xs px-3 py-2">Cost Report</Link>
              <Link href="/reports/budgets" className="btn-ghost text-xs px-3 py-2">Budgets</Link>
            </>
          }
        />
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 rise-in rise-in-1">
        <KpiTile
          label="Occupancy Rate"
          value={`${data.occupancyRate}%`}
          detail={`${data.occupiedUnits} / ${data.totalUnitCount} units`}
          color={data.occupancyRate >= 90 ? "text-green-700" : data.occupancyRate >= 70 ? "text-amber-700" : "text-red-600"}
        />
        <KpiTile
          label="Rent Collection"
          value={`${data.thisMonthCollectionRate}%`}
          detail={collectionTrend ? `${collectionTrend.arrow} ${collectionTrend.value} vs last month` : "this month"}
          color={data.thisMonthCollectionRate >= 90 ? "text-green-700" : data.thisMonthCollectionRate >= 70 ? "text-amber-700" : "text-red-600"}
          detailColor={collectionTrend?.color}
        />
        <KpiTile
          label="Avg Turnaround"
          value={fmtHours(data.avgTurnaround)}
          detail={`${data.completedWOs} jobs completed`}
          color="text-[#d9647f]"
        />
        <KpiTile
          label="Open Work Orders"
          value={String(data.openWOs)}
          detail={`${data.emergencyWOs} emergency`}
          color={data.emergencyWOs > 0 ? "text-red-600" : "text-[#d9647f]"}
          detailColor={data.emergencyWOs > 0 ? "text-red-600" : undefined}
        />
        <KpiTile
          label="Open Complaints"
          value={String(data.openComplaints)}
          detail={`avg ${fmtHours(data.avgComplaintResolution)} to resolve`}
          color={data.openComplaints > 10 ? "text-red-600" : "text-[#d9647f]"}
        />
        <KpiTile
          label="Cost / Unit"
          value={fmtAED(data.costPerUnit)}
          detail={`${fmtAED(data.totalMaintenanceCost)} total (3mo)`}
          color="text-[#d9647f]"
        />
      </div>

      {/* Alerts Row */}
      {(data.overdueCount > 0 || data.urgentExpiringLeases > 0 || data.emergencyWOs > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 rise-in rise-in-2">
          {data.overdueCount > 0 && (
            <div className="rounded-xl p-4 border border-red-200 bg-gradient-to-br from-red-50 to-white shadow-[var(--shadow-sm)]">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Overdue Rent</p>
              <p className="text-lg font-extrabold text-red-700 tabular-nums">{fmtAED(data.totalOverdueAmount)}</p>
              <p className="text-[10px] text-red-600/70">{data.overdueCount} invoices overdue</p>
            </div>
          )}
          {data.urgentExpiringLeases > 0 && (
            <div className="rounded-xl p-4 border border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-[var(--shadow-sm)]">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Leases Expiring</p>
              <p className="text-lg font-extrabold text-amber-700 tabular-nums">{data.urgentExpiringLeases}</p>
              <p className="text-[10px] text-amber-700/70">within 30 days · {data.expiringLeases} within 60 days</p>
            </div>
          )}
          {data.emergencyWOs > 0 && (
            <div className="rounded-xl p-4 border border-red-200 bg-gradient-to-br from-red-50 to-white shadow-[var(--shadow-sm)]">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Emergency Jobs</p>
              <p className="text-lg font-extrabold text-red-700 tabular-nums">{data.emergencyWOs}</p>
              <p className="text-[10px] text-red-600/70">active emergency work orders</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Trend */}
        <div className="lux-card p-5">
          <h2 className="eyebrow mb-4">
            Work Order Trend (3 Months)
          </h2>
          <div className="space-y-3">
            {data.monthlyWO.map((m) => {
              const max = Math.max(...data.monthlyWO.map((x) => Math.max(x.created, x.completed)), 1);
              return (
                <div key={m.month}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{m.month}</span>
                    <span className="text-xs text-[#5b6b85]">
                      {m.created} created · {m.completed} completed
                    </span>
                  </div>
                  <div className="flex gap-1 h-3">
                    <div
                      className="bg-[#d9647f] rounded-full"
                      style={{ width: barWidth(m.created, max) }}
                      title={`${m.created} created`}
                    />
                  </div>
                  <div className="flex gap-1 h-3 mt-0.5">
                    <div
                      className="bg-green-500 rounded-full"
                      style={{ width: barWidth(m.completed, max) }}
                      title={`${m.completed} completed`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-[10px] text-[#5b6b85]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#d9647f]" /> Created</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Completed</span>
          </div>
        </div>

        {/* WO by Type */}
        <div className="lux-card p-5">
          <h2 className="eyebrow mb-4">
            Work Orders by Type
          </h2>
          <div className="space-y-2">
            {data.woByType.map(([type, count]) => (
              <div key={type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm capitalize">{type.replace(/_/g, " ")}</span>
                  <span className="text-xs font-bold text-[#d9647f]">{count}</span>
                </div>
                <div className="h-2 bg-[#f4f6fa] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#b01b42] rounded-full"
                    style={{ width: barWidth(count, maxWOByType) }}
                  />
                </div>
              </div>
            ))}
            {data.woByType.length === 0 && (
              <p className="text-[#8b97ab] text-sm">No work order data available.</p>
            )}
          </div>
        </div>
      </div>

      {/* Occupancy Ring + Lease Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="lux-card p-5">
          <h2 className="eyebrow mb-4">
            Occupancy Overview
          </h2>
          <div className="flex items-center gap-6">
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <path
                  d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#f4f6fa"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={data.occupancyRate >= 90 ? "#22c55e" : data.occupancyRate >= 70 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="3"
                  strokeDasharray={`${data.occupancyRate}, 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold">{data.occupancyRate}%</span>
                <span className="text-[9px] text-[#5b6b85] uppercase">Occupied</span>
              </div>
            </div>
            <div className="space-y-2 text-sm flex-1">
              <div className="flex justify-between">
                <span className="text-[#5b6b85]">Total Units</span>
                <span className="font-medium">{data.totalUnitCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5b6b85]">Occupied</span>
                <span className="font-medium text-green-700">{data.occupiedUnits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5b6b85]">Vacant</span>
                <span className="font-medium text-amber-700">{data.totalUnitCount - data.occupiedUnits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5b6b85]">Active Leases</span>
                <span className="font-medium">{data.activeLeaseCount}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lux-card p-5">
          <h2 className="eyebrow mb-4">
            Lease Health
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#f4f6fa] rounded-lg p-3 text-center">
              <p className="text-xl font-extrabold text-green-700">{data.activeLeaseCount}</p>
              <p className="text-[10px] text-[#8b97ab] uppercase">Active Leases</p>
            </div>
            <div className="bg-[#f4f6fa] rounded-lg p-3 text-center">
              <p className={`text-xl font-extrabold ${data.expiringLeases > 0 ? "text-amber-700" : "text-green-700"}`}>
                {data.expiringLeases}
              </p>
              <p className="text-[10px] text-[#8b97ab] uppercase">Expiring (60d)</p>
            </div>
            <div className="bg-[#f4f6fa] rounded-lg p-3 text-center">
              <p className={`text-xl font-extrabold ${data.thisMonthCollectionRate >= 90 ? "text-green-700" : "text-amber-700"}`}>
                {data.thisMonthCollectionRate}%
              </p>
              <p className="text-[10px] text-[#8b97ab] uppercase">Collection Rate</p>
            </div>
            <div className="bg-[#f4f6fa] rounded-lg p-3 text-center">
              <p className={`text-xl font-extrabold ${data.overdueCount > 0 ? "text-red-600" : "text-green-700"}`}>
                {data.overdueCount}
              </p>
              <p className="text-[10px] text-[#8b97ab] uppercase">Overdue Invoices</p>
            </div>
          </div>
        </div>
      </div>

      {/* Per-Building Breakdown */}
      <section>
        <h2 className="eyebrow mb-3">
          Performance by Building
        </h2>
        <div className="lux-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="lux-table w-full text-sm border-collapse min-w-[800px]">
            <thead>
              <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#5b6b85] bg-[rgba(176,27,66,0.04)]">
                <th className="px-5 py-3.5 font-medium">Building</th>
                <th className="px-5 py-3.5 font-medium">Units</th>
                <th className="px-5 py-3.5 font-medium">Occupied</th>
                <th className="px-5 py-3.5 font-medium">Occupancy</th>
                <th className="px-5 py-3.5 font-medium">Open WOs</th>
                <th className="px-5 py-3.5 font-medium">Completed WOs</th>
                <th className="px-5 py-3.5 font-medium">Complaints</th>
                <th className="px-5 py-3.5 font-medium">Health</th>
              </tr>
            </thead>
            <tbody>
              {data.buildingStats.map((b) => {
                const health =
                  b.occupancyRate >= 90 && b.openComplaints <= 2 && b.openWOs <= 5
                    ? { label: "Excellent", color: "text-green-700" }
                    : b.occupancyRate >= 70 && b.openComplaints <= 5
                    ? { label: "Good", color: "text-[#d9647f]" }
                    : { label: "Needs Attention", color: "text-red-600" };

                return (
                  <tr key={b.id} className="border-b border-[rgba(176,27,66,0.08)] hover:bg-[#f0f4f9]">
                    <td className="px-5 py-3.5 font-medium">{b.name}</td>
                    <td className="px-5 py-3.5">{b.totalUnits}</td>
                    <td className="px-5 py-3.5 text-green-700">{b.occupied}</td>
                    <td className="px-5 py-3.5">
                      <span className={b.occupancyRate >= 90 ? "text-green-700" : b.occupancyRate >= 70 ? "text-amber-700" : "text-red-600"}>
                        {b.occupancyRate}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={b.openWOs > 5 ? "text-amber-700 font-bold" : ""}>{b.openWOs}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[#5b6b85]">{b.completedWOs}</td>
                    <td className="px-5 py-3.5">
                      <span className={b.openComplaints > 3 ? "text-red-600 font-bold" : "text-[#5b6b85]"}>
                        {b.openComplaints} open
                      </span>
                      <span className="text-[#8b97ab]"> / {b.totalComplaints}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-bold ${health.color}`}>{health.label}</span>
                    </td>
                  </tr>
                );
              })}
              {data.buildingStats.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-[#8b97ab] text-center" colSpan={8}>No building data available.</td>
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

function KpiTile({
  label,
  value,
  detail,
  color,
  detailColor,
}: {
  label: string;
  value: string;
  detail: string;
  color: string;
  detailColor?: string;
}) {
  // Map the semantic value color to the tile's accent-bar tone.
  const tone = color.includes("green")
    ? "green"
    : color.includes("amber")
    ? "amber"
    : color.includes("red")
    ? "red"
    : "gold";
  return (
    <StatTile
      label={label}
      value={value}
      detail={detail}
      detailColor={detailColor}
      tone={tone}
      valueClassName={`${color} !text-[1.5rem]`}
    />
  );
}
