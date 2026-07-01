import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

type PropertySummary = {
  id: string;
  name: string;
  openJobs: number;
  inProgress: number;
  pending: number;
  completed: number;
  avgDaysOpen: number;
};

type VendorProject = {
  id: string;
  vendor_name: string;
  property_name: string;
  project_name: string;
  scope: string | null;
  start_date: string;
  expected_end_date: string | null;
  actual_end_date: string | null;
  status: string;
  sla_days: number | null;
  days_elapsed: number;
  days_remaining: number | null;
  is_overdue: boolean;
};

type InventoryAlert = {
  name: string;
  sku: string | null;
  quantity_on_hand: number;
  reorder_threshold: number;
  property_name: string | null;
};

async function getCommandCenterData() {
  const supabase = await createClient();

  const [
    { data: properties },
    { data: workOrders },
    { data: vendorAssignments },
    { data: vendors },
    { data: inventoryItems },
    { data: propList },
    { data: partsRequests },
    { data: complaints },
    { data: tenders },
    { data: pendingPOs },
  ] = await Promise.all([
    supabase.from("properties").select("id, name"),
    supabase.from("work_orders").select("id, property_id, status, created_at, assigned_technician_id, type"),
    supabase.from("vendor_assignments").select("*"),
    supabase.from("vendors").select("id, name"),
    supabase
      .from("inventory_items")
      .select("name, sku, quantity_on_hand, reorder_threshold, property_id")
      .gt("reorder_threshold", 0),
    supabase.from("properties").select("id, name"),
    supabase.from("parts_requests").select("id, status").in("status", ["requested", "approved", "picking", "delivering"]),
    supabase.from("complaints").select("id, status").in("status", ["submitted", "acknowledged"]),
    supabase.from("tenders").select("id, title, status, submission_deadline, site_visit_date").in("status", ["published", "site_visit", "submissions_open", "closed", "evaluating"]),
    supabase.from("purchase_orders").select("id, amount, urgency").eq("status", "pending"),
  ]);

  const propertiesById = new Map(((propList ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
  const vendorsById = new Map(((vendors ?? []) as { id: string; name: string }[]).map((v) => [v.id, v.name]));
  const now = new Date();

  const propertySummaries: PropertySummary[] = ((properties ?? []) as { id: string; name: string }[]).map((p) => {
    const wos = ((workOrders ?? []) as { id: string; property_id: string; status: string; created_at: string }[]).filter(
      (w) => w.property_id === p.id
    );
    const open = wos.filter((w) =>
      ["draft", "assigned", "in_progress", "paused", "pending_approval"].includes(w.status)
    );
    const inProgress = wos.filter((w) => w.status === "in_progress");
    const pending = wos.filter((w) => ["draft", "assigned", "pending_approval"].includes(w.status));
    const completed = wos.filter((w) =>
      ["completed_by_technician", "verified_by_supervisor", "confirmed_by_resident", "closed"].includes(w.status)
    );

    const totalDays = open.reduce((sum, w) => {
      const created = new Date(w.created_at);
      return sum + Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);

    return {
      id: p.id,
      name: p.name,
      openJobs: open.length,
      inProgress: inProgress.length,
      pending: pending.length,
      completed: completed.length,
      avgDaysOpen: open.length > 0 ? Math.round(totalDays / open.length) : 0,
    };
  });

  const vendorProjects: VendorProject[] = ((vendorAssignments ?? []) as {
    id: string;
    vendor_id: string;
    property_id: string;
    project_name: string;
    scope: string | null;
    start_date: string;
    expected_end_date: string | null;
    actual_end_date: string | null;
    status: string;
    sla_days: number | null;
  }[]).map((va) => {
    const startDate = new Date(va.start_date);
    const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    let daysRemaining: number | null = null;
    let isOverdue = false;

    if (va.expected_end_date) {
      const endDate = new Date(va.expected_end_date);
      daysRemaining = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      isOverdue = daysRemaining < 0 && !va.actual_end_date;
    }

    return {
      id: va.id,
      vendor_name: vendorsById.get(va.vendor_id) ?? "—",
      property_name: propertiesById.get(va.property_id) ?? "—",
      project_name: va.project_name,
      scope: va.scope,
      start_date: va.start_date,
      expected_end_date: va.expected_end_date,
      actual_end_date: va.actual_end_date,
      status: va.status,
      sla_days: va.sla_days,
      days_elapsed: daysElapsed,
      days_remaining: daysRemaining,
      is_overdue: isOverdue,
    };
  });

  const lowStockItems: InventoryAlert[] = ((inventoryItems ?? []) as {
    name: string;
    sku: string | null;
    quantity_on_hand: number;
    reorder_threshold: number;
    property_id: string | null;
  }[])
    .filter((i) => Number(i.quantity_on_hand) <= Number(i.reorder_threshold))
    .map((i) => ({
      ...i,
      quantity_on_hand: Number(i.quantity_on_hand),
      reorder_threshold: Number(i.reorder_threshold),
      property_name: i.property_id ? propertiesById.get(i.property_id) ?? null : null,
    }));

  const totalOpenWOs = propertySummaries.reduce((s, p) => s + p.openJobs, 0);
  const totalInProgress = propertySummaries.reduce((s, p) => s + p.inProgress, 0);
  const pendingPartsRequests = (partsRequests ?? []).length;
  const openComplaints = (complaints ?? []).length;
  const activeProjects = vendorProjects.filter((v) => v.status === "active");
  const overdueProjects = vendorProjects.filter((v) => v.is_overdue);

  const pendingPOList = (pendingPOs ?? []) as { id: string; amount: number; urgency: string | null }[];
  const pendingPOCount = pendingPOList.length;
  const pendingPOTotal = pendingPOList.reduce((s, o) => s + Number(o.amount), 0);
  const criticalPOs = pendingPOList.filter((o) => o.urgency === "critical" || o.urgency === "urgent").length;

  const activeTenders = ((tenders ?? []) as {
    id: string;
    title: string;
    status: string;
    submission_deadline: string;
    site_visit_date: string | null;
  }[]).map((t) => {
    const deadline = new Date(t.submission_deadline);
    const daysToDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { ...t, daysToDeadline };
  });

  return {
    propertySummaries,
    vendorProjects,
    lowStockItems,
    totalOpenWOs,
    totalInProgress,
    pendingPartsRequests,
    openComplaints,
    activeProjects,
    overdueProjects,
    activeTenders,
    pendingPOCount,
    pendingPOTotal,
    criticalPOs,
  };
}

export default async function CommandCenterPage() {
  const {
    propertySummaries,
    vendorProjects,
    lowStockItems,
    totalOpenWOs,
    totalInProgress,
    pendingPartsRequests,
    openComplaints,
    activeProjects,
    overdueProjects,
    activeTenders,
    pendingPOCount,
    pendingPOTotal,
    criticalPOs,
  } = await getCommandCenterData();

  const kpis = [
    { label: "Open Work Orders", value: totalOpenWOs, color: totalOpenWOs > 20 ? "text-amber-400" : "text-[#d4af5a]" },
    { label: "In Progress", value: totalInProgress, color: "text-green-400" },
    { label: "Open Complaints", value: openComplaints, color: openComplaints > 10 ? "text-red-400" : "text-[#d4af5a]" },
    { label: "Parts Requests", value: pendingPartsRequests, color: "text-[#d4af5a]" },
    { label: "Active Projects", value: activeProjects.length, color: "text-[#d4af5a]" },
    { label: "Overdue Projects", value: overdueProjects.length, color: overdueProjects.length > 0 ? "text-red-400" : "text-green-400" },
    { label: "Active Tenders", value: activeTenders.length, color: activeTenders.length > 0 ? "text-[#d4af5a]" : "text-[#6b6454]" },
    { label: "Pending POs", value: pendingPOCount, color: criticalPOs > 0 ? "text-red-400" : pendingPOCount > 5 ? "text-amber-400" : "text-[#d4af5a]" },
    { label: "Low Stock Items", value: lowStockItems.length, color: lowStockItems.length > 0 ? "text-amber-400" : "text-green-400" },
  ];

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">← Dashboard</Link>
          <h1 className="text-2xl font-extrabold mt-1">GM Command Center</h1>
          <p className="text-[#a0977e] text-sm">
            Live overview of all operations across buildings, contractors, and inventory.
          </p>
        </div>
        <div className="text-xs text-[#6b6454]">
          Last refreshed: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 text-center">
            <p className={`text-3xl font-extrabold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-4">
            Buildings Overview
          </h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
                <th className="py-2 font-medium">Building</th>
                <th className="py-2 font-medium text-center">Open</th>
                <th className="py-2 font-medium text-center">Active</th>
                <th className="py-2 font-medium text-center">Done</th>
                <th className="py-2 font-medium text-center">Avg Days</th>
              </tr>
            </thead>
            <tbody>
              {propertySummaries.map((p) => (
                <tr key={p.id} className="border-b border-[rgba(184,144,47,0.08)]">
                  <td className="py-2 font-medium">{p.name}</td>
                  <td className={`py-2 text-center font-bold ${p.openJobs > 10 ? "text-amber-400" : ""}`}>
                    {p.openJobs}
                  </td>
                  <td className="py-2 text-center text-green-400">{p.inProgress}</td>
                  <td className="py-2 text-center text-[#6b6454]">{p.completed}</td>
                  <td className={`py-2 text-center ${p.avgDaysOpen > 7 ? "text-red-400 font-bold" : "text-[#a0977e]"}`}>
                    {p.avgDaysOpen}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-4">
            Contractor Projects
          </h2>
          {vendorProjects.length === 0 ? (
            <p className="text-[#6b6454] text-sm">No vendor projects tracked yet.</p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {vendorProjects
                .sort((a, b) => (a.is_overdue ? -1 : 0) - (b.is_overdue ? -1 : 0))
                .map((vp) => (
                  <div
                    key={vp.id}
                    className={`rounded-lg p-3 border ${
                      vp.is_overdue
                        ? "border-red-500 bg-red-950/30"
                        : vp.status === "completed"
                          ? "border-[rgba(184,144,47,0.08)] bg-[#0f1626] opacity-60"
                          : "border-[rgba(184,144,47,0.15)] bg-[#0f1626]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">
                          {vp.project_name}
                          {vp.is_overdue && (
                            <span className="text-red-400 text-xs ml-2 font-bold">OVERDUE</span>
                          )}
                        </p>
                        <p className="text-xs text-[#a0977e]">
                          {vp.vendor_name} · {vp.property_name}
                        </p>
                      </div>
                      <div className="text-right">
                        {vp.expected_end_date && (
                          <p className={`text-sm font-bold ${vp.is_overdue ? "text-red-400" : "text-[#d4af5a]"}`}>
                            {vp.days_remaining !== null
                              ? vp.days_remaining >= 0
                                ? `${vp.days_remaining}d left`
                                : `${Math.abs(vp.days_remaining)}d over`
                              : ""}
                          </p>
                        )}
                        <p className="text-[10px] text-[#6b6454]">
                          {vp.sla_days ? `SLA: ${vp.sla_days}d` : "No SLA"}
                        </p>
                      </div>
                    </div>
                    {vp.scope && <p className="text-xs text-[#6b6454] mt-1">{vp.scope}</p>}
                    <div className="flex gap-3 mt-2 text-[10px] text-[#6b6454]">
                      <span>Started: {vp.start_date}</span>
                      {vp.expected_end_date && <span>Due: {vp.expected_end_date}</span>}
                      <span>{vp.days_elapsed}d elapsed</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>

      {activeTenders.length > 0 && (
        <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase">
              Active Tenders ({activeTenders.length})
            </h2>
            <Link href="/tenders" className="text-xs text-[#b8902f] hover:text-[#d4af5a]">
              Manage Tenders →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {activeTenders.map((t) => {
              const statusLabel: Record<string, string> = {
                published: "Published",
                site_visit: "Site Visit",
                submissions_open: "Accepting Bids",
                closed: "Closed",
                evaluating: "Under Evaluation",
              };
              return (
                <Link
                  key={t.id}
                  href={`/tenders/${t.id}`}
                  className="bg-[#0f1626] rounded-lg px-3 py-2.5 border border-[rgba(184,144,47,0.08)] hover:border-[#b8902f] transition-colors"
                >
                  <p className="text-sm font-medium">{t.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-[#a0977e]">{statusLabel[t.status] ?? t.status}</span>
                    {t.daysToDeadline >= 0 ? (
                      <span className={`text-xs font-bold ${t.daysToDeadline <= 3 ? "text-amber-400" : "text-[#d4af5a]"}`}>
                        {t.daysToDeadline}d left
                      </span>
                    ) : (
                      <span className="text-xs text-[#6b6454]">Deadline passed</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {pendingPOCount > 0 && (
        <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase">
              Pending Purchase Orders ({pendingPOCount})
            </h2>
            <Link href="/purchasing" className="text-xs text-[#b8902f] hover:text-[#d4af5a]">
              Open Purchasing →
            </Link>
          </div>
          <p className="text-sm text-[#a0977e]">
            <span className="text-[#d4af5a] font-bold">AED {pendingPOTotal.toLocaleString()}</span> awaiting approval
            {criticalPOs > 0 && (
              <span className="text-red-400 ml-2">({criticalPOs} urgent/critical)</span>
            )}
          </p>
        </section>
      )}

      {lowStockItems.length > 0 && (
        <section className="border border-amber-700 bg-amber-950/30 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-amber-400 tracking-[0.15em] uppercase">
              Low Stock Alerts ({lowStockItems.length})
            </h2>
            <Link href="/inventory/reports" className="text-xs text-amber-400 hover:text-amber-300">
              View Monthly Report →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStockItems.map((i, idx) => (
              <div key={idx} className="bg-[#0f1626] rounded-lg px-3 py-2 flex justify-between text-sm">
                <span className="text-amber-200">
                  {i.name} {i.sku && <span className="text-amber-400">({i.sku})</span>}
                </span>
                <span className="text-amber-400 font-bold">
                  {i.quantity_on_hand} / {i.reorder_threshold}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/work-orders", label: "Work Orders" },
          { href: "/store", label: "Store & Dispatch" },
          { href: "/vendors", label: "Vendors & Contracts" },
          { href: "/inventory/reports", label: "Inventory Report" },
          { href: "/tenders", label: "Tenders" },
          { href: "/complaints", label: "Complaints" },
          { href: "/purchasing", label: "Purchase Orders" },
          { href: "/operations-monitor", label: "Operations Monitor" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-3 text-center text-sm font-medium hover:border-[#b8902f] transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </main>
  );
}
