import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import AddVendor from "./AddVendor";
import AddAssignment from "./AddAssignment";
import AssignmentActions from "./AssignmentActions";

type VendorRow = {
  id: string;
  name: string;
  category: string | null;
  rating: number | null;
  created_at: string;
};

type ContractRow = {
  id: string;
  vendor_id: string;
  title: string;
  sla_hours: number | null;
  start_date: string | null;
  end_date: string | null;
  value: number | null;
};

type AssignmentRow = {
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
};

async function getPageData() {
  const supabase = await createClient();
  const [{ data: vendors }, { data: contracts }, { data: assignments }, { data: properties }, { data: tenderWins }, { data: posByVendor }] = await Promise.all([
    supabase.from("vendors").select("id, name, category, rating, created_at").order("name"),
    supabase.from("contracts").select("id, vendor_id, title, sla_hours, start_date, end_date, value").order("end_date", { ascending: false }),
    supabase.from("vendor_assignments").select("id, vendor_id, property_id, project_name, scope, start_date, expected_end_date, actual_end_date, status, sla_days").order("start_date", { ascending: false }),
    supabase.from("properties").select("id, name"),
    supabase.from("tenders").select("id, title, decided_vendor_id, decided_at").not("decided_vendor_id", "is", null),
    supabase.from("purchase_orders").select("id, vendor_id, amount, status").not("vendor_id", "is", null),
  ]);

  const contractsByVendor = new Map<string, ContractRow[]>();
  ((contracts ?? []) as ContractRow[]).forEach((c) => {
    const list = contractsByVendor.get(c.vendor_id) ?? [];
    list.push(c);
    contractsByVendor.set(c.vendor_id, list);
  });

  const assignmentsByVendor = new Map<string, AssignmentRow[]>();
  ((assignments ?? []) as AssignmentRow[]).forEach((a) => {
    const list = assignmentsByVendor.get(a.vendor_id) ?? [];
    list.push(a);
    assignmentsByVendor.set(a.vendor_id, list);
  });

  const propertiesById = new Map(((properties ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  const tenderWinsByVendor = new Map<string, number>();
  ((tenderWins ?? []) as { id: string; decided_vendor_id: string }[]).forEach((t) => {
    tenderWinsByVendor.set(t.decided_vendor_id, (tenderWinsByVendor.get(t.decided_vendor_id) ?? 0) + 1);
  });

  const poSpendByVendor = new Map<string, { total: number; fulfilled: number; count: number }>();
  ((posByVendor ?? []) as { id: string; vendor_id: string; amount: number; status: string }[]).forEach((po) => {
    const current = poSpendByVendor.get(po.vendor_id) ?? { total: 0, fulfilled: 0, count: 0 };
    if (["approved", "fulfilled"].includes(po.status)) {
      current.total += Number(po.amount);
      current.count++;
    }
    if (po.status === "fulfilled") {
      current.fulfilled += Number(po.amount);
    }
    poSpendByVendor.set(po.vendor_id, current);
  });

  return {
    vendors: (vendors ?? []) as VendorRow[],
    properties: (properties ?? []) as { id: string; name: string }[],
    contractsByVendor,
    assignmentsByVendor,
    propertiesById,
    tenderWinsByVendor,
    poSpendByVendor,
  };
}

export default async function VendorsPage() {
  const { vendors, properties, contractsByVendor, assignmentsByVendor, propertiesById, tenderWinsByVendor, poSpendByVendor } = await getPageData();

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-extrabold mt-1">Vendors & Contracts</h1>
          <p className="text-[#a0977e] text-sm mt-1">
            Manage external contractors, suppliers, and their service contracts.
          </p>
        </div>
        <div className="flex gap-2">
          <AddAssignment vendors={vendors} properties={properties} />
          <AddVendor />
        </div>
      </div>

      <div className="space-y-4">
        {vendors.map((v) => {
          const contracts = contractsByVendor.get(v.id) ?? [];
          const assignments = assignmentsByVendor.get(v.id) ?? [];
          const now = new Date();
          const activeContracts = contracts.filter(
            (c) => !c.end_date || new Date(c.end_date) >= now
          );
          const expiredContracts = contracts.filter(
            (c) => c.end_date && new Date(c.end_date) < now
          );

          return (
            <div key={v.id} className="lux-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg">{v.name}</h3>
                  <p className="text-sm text-[#a0977e]">
                    {v.category ?? "General"}
                    {v.rating != null && (
                      <span className="ml-2 text-[#d4af5a]">
                        {"★".repeat(Math.round(Number(v.rating)))}
                        <span className="text-[#6b6454]">{"★".repeat(5 - Math.round(Number(v.rating)))}</span>
                        <span className="text-xs ml-1">{Number(v.rating).toFixed(1)}</span>
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-xs text-[#6b6454]">
                  {contracts.length} contract{contracts.length !== 1 ? "s" : ""}
                </span>
              </div>

              {(() => {
                const completedAssignments = assignments.filter((a) => a.status === "completed");
                const overdueCompleted = completedAssignments.filter((a) => {
                  if (!a.expected_end_date || !a.actual_end_date) return false;
                  return new Date(a.actual_end_date) > new Date(a.expected_end_date);
                });
                const tenderWins = tenderWinsByVendor.get(v.id) ?? 0;
                const poData = poSpendByVendor.get(v.id);
                const hasMetrics = completedAssignments.length > 0 || tenderWins > 0 || poData;

                if (!hasMetrics) return null;

                const onTimeRate = completedAssignments.length > 0
                  ? Math.round(((completedAssignments.length - overdueCompleted.length) / completedAssignments.length) * 100)
                  : null;

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {completedAssignments.length > 0 && (
                      <div className="bg-[#0f1626] rounded-lg px-3 py-2 text-center">
                        <p className="text-lg font-extrabold text-green-400">{completedAssignments.length}</p>
                        <p className="text-[10px] text-[#6b6454] uppercase">Completed</p>
                      </div>
                    )}
                    {onTimeRate !== null && (
                      <div className="bg-[#0f1626] rounded-lg px-3 py-2 text-center">
                        <p className={`text-lg font-extrabold ${onTimeRate >= 80 ? "text-green-400" : onTimeRate >= 60 ? "text-amber-400" : "text-red-400"}`}>
                          {onTimeRate}%
                        </p>
                        <p className="text-[10px] text-[#6b6454] uppercase">On-Time</p>
                      </div>
                    )}
                    {tenderWins > 0 && (
                      <div className="bg-[#0f1626] rounded-lg px-3 py-2 text-center">
                        <p className="text-lg font-extrabold text-[#d4af5a]">{tenderWins}</p>
                        <p className="text-[10px] text-[#6b6454] uppercase">Tender Wins</p>
                      </div>
                    )}
                    {poData && poData.total > 0 && (
                      <div className="bg-[#0f1626] rounded-lg px-3 py-2 text-center">
                        <p className="text-lg font-extrabold text-[#d4af5a]">
                          {(poData.total / 1000).toFixed(0)}K
                        </p>
                        <p className="text-[10px] text-[#6b6454] uppercase">PO Value (AED)</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {activeContracts.length > 0 && (
                <div className="space-y-1.5">
                  {activeContracts.map((c) => (
                    <div key={c.id} className="bg-[#0f1626] rounded-lg px-3 py-2 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{c.title}</span>
                        {c.sla_hours && (
                          <span className="text-xs text-[#6b6454] ml-2">SLA: {c.sla_hours}h</span>
                        )}
                      </div>
                      <div className="text-right text-xs text-[#a0977e]">
                        {c.value != null && (
                          <span className="text-[#d4af5a] font-medium mr-2">
                            AED {Number(c.value).toLocaleString()}
                          </span>
                        )}
                        {c.start_date && c.end_date
                          ? `${c.start_date} → ${c.end_date}`
                          : c.start_date ?? "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {expiredContracts.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-[#6b6454] cursor-pointer">
                    {expiredContracts.length} expired contract{expiredContracts.length !== 1 ? "s" : ""}
                  </summary>
                  <div className="space-y-1 mt-1.5 opacity-60">
                    {expiredContracts.map((c) => (
                      <div key={c.id} className="bg-[#0f1626] rounded-lg px-3 py-2 text-sm text-[#6b6454]">
                        {c.title} — expired {c.end_date}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {contracts.length === 0 && (
                <p className="text-xs text-[#6b6454]">No contracts on file.</p>
              )}

              {assignments.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] text-[#a0977e] uppercase tracking-wider font-bold mb-1.5">
                    Project Assignments
                  </p>
                  <div className="space-y-1.5">
                    {assignments.map((a) => {
                      const daysRemaining = a.expected_end_date
                        ? Math.floor((new Date(a.expected_end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                        : null;
                      const isOverdue = daysRemaining !== null && daysRemaining < 0 && !a.actual_end_date;
                      return (
                        <div
                          key={a.id}
                          className={`bg-[#0f1626] rounded-lg px-3 py-2 text-sm ${
                            isOverdue ? "border border-red-500" : "border border-transparent"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">
                                {a.project_name}
                                {isOverdue && <span className="text-red-400 text-xs ml-2 font-bold">OVERDUE</span>}
                              </span>
                              <span className="text-xs text-[#6b6454] ml-2">
                                {propertiesById.get(a.property_id) ?? "—"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              {daysRemaining !== null && a.status === "active" && (
                                <span className={`text-xs font-bold ${isOverdue ? "text-red-400" : "text-[#d4af5a]"}`}>
                                  {daysRemaining >= 0 ? `${daysRemaining}d left` : `${Math.abs(daysRemaining)}d over`}
                                </span>
                              )}
                              <span className={`text-[10px] font-bold uppercase ${
                                a.status === "active" ? "text-green-400"
                                  : a.status === "completed" ? "text-[#6b6454]"
                                  : a.status === "cancelled" ? "text-red-400"
                                  : "text-amber-400"
                              }`}>
                                {a.status}
                              </span>
                              <AssignmentActions assignmentId={a.id} status={a.status} />
                            </div>
                          </div>
                          {a.scope && <p className="text-xs text-[#6b6454] mt-1">{a.scope}</p>}
                          <div className="flex gap-3 text-[10px] text-[#6b6454] mt-1">
                            <span>Start: {a.start_date}</span>
                            {a.expected_end_date && <span>Due: {a.expected_end_date}</span>}
                            {a.actual_end_date && <span>Completed: {a.actual_end_date}</span>}
                            {a.sla_days && <span>SLA: {a.sla_days}d</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {vendors.length === 0 && (
          <p className="text-[#6b6454]">No vendors registered yet.</p>
        )}
      </div>
    </main>
  );
}
