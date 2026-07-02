import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

type AssignmentRow = {
  id: string;
  project_name: string;
  scope: string | null;
  start_date: string;
  expected_end_date: string | null;
  actual_end_date: string | null;
  status: string;
  sla_days: number | null;
  properties: { name: string } | null;
};

type ContractRow = {
  id: string;
  title: string;
  sla_hours: number | null;
  start_date: string | null;
  end_date: string | null;
  value: number | null;
};

type TenderRow = {
  id: string;
  title: string;
  status: string;
  submission_deadline: string;
  budget_estimate: number | null;
  currency: string;
};

type PORow = {
  id: string;
  description: string | null;
  amount: number;
  status: string;
  created_at: string;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  amount: number;
  total_amount: number;
  status: string;
  invoice_date: string;
  due_date: string | null;
};

async function getVendorData() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, full_name, tenant_id")
    .eq("id", userId ?? "")
    .single();

  if (!profile || profile.role !== "vendor") {
    return null;
  }

  const { data: vendorRecord } = await supabase
    .from("vendors")
    .select("id, name, category, rating")
    .eq("tenant_id", profile.tenant_id)
    .limit(1)
    .single();

  const vendorId = vendorRecord?.id;
  if (!vendorId) return { profile, vendor: null, assignments: [], contracts: [], tenders: [], pos: [], invoices: [] };

  const [
    { data: assignments },
    { data: contracts },
    { data: tenders },
    { data: pos },
    { data: invoices },
  ] = await Promise.all([
    supabase
      .from("vendor_assignments")
      .select("id, project_name, scope, start_date, expected_end_date, actual_end_date, status, sla_days, properties(name)")
      .eq("vendor_id", vendorId)
      .order("start_date", { ascending: false }),
    supabase
      .from("contracts")
      .select("id, title, sla_hours, start_date, end_date, value")
      .eq("vendor_id", vendorId)
      .order("end_date", { ascending: false }),
    supabase
      .from("tenders")
      .select("id, title, status, submission_deadline, budget_estimate, currency")
      .eq("decided_vendor_id", vendorId)
      .order("decided_at", { ascending: false }),
    supabase
      .from("purchase_orders")
      .select("id, description, amount, status, created_at")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("invoices")
      .select("id, invoice_number, amount, total_amount, status, invoice_date, due_date")
      .eq("vendor_id", vendorId)
      .order("invoice_date", { ascending: false })
      .limit(50),
  ]);

  return {
    profile,
    vendor: vendorRecord as { id: string; name: string; category: string | null; rating: number | null },
    assignments: (assignments ?? []) as unknown as AssignmentRow[],
    contracts: (contracts ?? []) as ContractRow[],
    tenders: (tenders ?? []) as TenderRow[],
    pos: (pos ?? []) as PORow[],
    invoices: (invoices ?? []) as InvoiceRow[],
  };
}

function fmtAED(n: number) {
  return `AED ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-900 text-green-300",
  completed: "bg-[#213052] text-[#a0977e]",
  overdue: "bg-red-900 text-red-300",
  cancelled: "bg-[#213052] text-[#6b6454]",
  pending: "bg-amber-900/50 text-amber-300",
  approved: "bg-green-900 text-green-300",
  fulfilled: "bg-blue-900/50 text-blue-300",
  rejected: "bg-red-900 text-red-300",
  received: "bg-blue-900/50 text-blue-300",
  verified: "bg-green-900 text-green-300",
  disputed: "bg-red-900 text-red-300",
  paid: "bg-green-900 text-green-300",
};

export default async function VendorPortalPage() {
  const data = await getVendorData();

  if (!data) {
    return (
      <main className="p-8">
        <p className="text-[#6b6454]">This portal is only accessible to vendor accounts.</p>
      </main>
    );
  }

  if (!data.vendor) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-extrabold mb-2">Vendor Portal</h1>
        <p className="text-[#a0977e]">Welcome, {data.profile.full_name}. Your vendor account is being set up.</p>
      </main>
    );
  }

  const { vendor, assignments, contracts, pos, invoices, tenders } = data;
  const now = new Date();
  const activeAssignments = assignments.filter((a) => a.status === "active");
  const activeContracts = contracts.filter((c) => !c.end_date || new Date(c.end_date) >= now);
  const pendingPOs = pos.filter((p) => p.status === "pending" || p.status === "approved");
  const unpaidInvoices = invoices.filter((i) => i.status !== "paid");
  const totalRevenue = pos
    .filter((p) => ["approved", "fulfilled"].includes(p.status))
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="text-xs text-[#b8902f] font-bold tracking-[0.2em] uppercase mb-1">
          GSPOP — Vendor Portal
        </p>
        <h1 className="text-2xl font-extrabold mb-1">{vendor.name}</h1>
        <p className="text-[#a0977e]">
          {vendor.category ?? "General Contractor"}
          {vendor.rating != null && (
            <span className="ml-2 text-[#d4af5a]">
              {"★".repeat(Math.round(Number(vendor.rating)))}
              <span className="text-[#6b6454]">{"★".repeat(5 - Math.round(Number(vendor.rating)))}</span>
            </span>
          )}
        </p>
        <div className="w-10 h-0.5 bg-[#b8902f] mt-3 rounded-full" />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 text-center">
          <p className="text-xl font-extrabold text-[#d4af5a]">{activeAssignments.length}</p>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">Active Projects</p>
        </div>
        <div className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 text-center">
          <p className="text-xl font-extrabold text-blue-400">{activeContracts.length}</p>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">Active Contracts</p>
        </div>
        <div className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 text-center">
          <p className="text-xl font-extrabold text-amber-400">{pendingPOs.length}</p>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">Open POs</p>
        </div>
        <div className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 text-center">
          <p className="text-xl font-extrabold text-green-400">{fmtAED(totalRevenue)}</p>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">Total PO Value</p>
        </div>
      </div>

      {/* Active Projects */}
      <section className="mb-6">
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
          Project Assignments ({assignments.length})
        </h2>
        {assignments.length === 0 ? (
          <p className="text-[#6b6454] text-sm">No project assignments yet.</p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => {
              const prop = a.properties as { name: string } | null;
              const daysLeft = a.expected_end_date
                ? Math.floor((new Date(a.expected_end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                : null;
              const isOverdue = daysLeft !== null && daysLeft < 0 && !a.actual_end_date;

              return (
                <div
                  key={a.id}
                  className={`border rounded-xl p-4 bg-[#1a2640] ${
                    isOverdue ? "border-red-500" : "border-[rgba(184,144,47,0.15)]"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold">{a.project_name}</p>
                      <p className="text-xs text-[#a0977e]">{prop?.name ?? "—"}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_COLORS[a.status] ?? STATUS_COLORS.active}`}>
                      {a.status}
                    </span>
                  </div>
                  {a.scope && <p className="text-sm text-[#a0977e] mb-2">{a.scope}</p>}
                  <div className="flex gap-4 text-xs text-[#6b6454]">
                    <span>Start: {a.start_date}</span>
                    {a.expected_end_date && (
                      <span className={isOverdue ? "text-red-400 font-bold" : ""}>
                        Due: {a.expected_end_date}
                        {daysLeft !== null && a.status === "active" && (
                          <span className="ml-1">
                            ({isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`})
                          </span>
                        )}
                      </span>
                    )}
                    {a.sla_days && <span>SLA: {a.sla_days}d</span>}
                    {a.actual_end_date && <span className="text-green-400">Completed: {a.actual_end_date}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Contracts */}
        <section>
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
            Contracts ({contracts.length})
          </h2>
          {contracts.length === 0 ? (
            <p className="text-[#6b6454] text-sm">No contracts on file.</p>
          ) : (
            <div className="space-y-2">
              {contracts.map((c) => {
                const isExpired = c.end_date && new Date(c.end_date) < now;
                return (
                  <div key={c.id} className={`border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 ${isExpired ? "opacity-60" : ""}`}>
                    <p className="font-medium text-sm">{c.title}</p>
                    <div className="flex justify-between mt-1 text-xs text-[#a0977e]">
                      <span>{c.start_date} → {c.end_date ?? "Ongoing"}</span>
                      {c.value && <span className="text-[#d4af5a] font-bold">{fmtAED(Number(c.value))}</span>}
                    </div>
                    {c.sla_hours && <p className="text-[10px] text-[#6b6454] mt-1">SLA: {c.sla_hours}h response</p>}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Tender Wins */}
        <section>
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
            Won Tenders ({tenders.length})
          </h2>
          {tenders.length === 0 ? (
            <p className="text-[#6b6454] text-sm">No tenders won yet.</p>
          ) : (
            <div className="space-y-2">
              {tenders.map((t) => (
                <div key={t.id} className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4">
                  <p className="font-medium text-sm">{t.title}</p>
                  <div className="flex justify-between mt-1 text-xs text-[#a0977e]">
                    <span>Deadline: {t.submission_deadline}</span>
                    {t.budget_estimate && (
                      <span className="text-[#d4af5a] font-bold">
                        {fmtAED(Number(t.budget_estimate))} {t.currency}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Purchase Orders */}
      <section className="mb-6">
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
          Purchase Orders ({pos.length})
        </h2>
        {pos.length === 0 ? (
          <p className="text-[#6b6454] text-sm">No purchase orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 font-medium text-right">Amount</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => (
                  <tr key={po.id} className="border-b border-[rgba(184,144,47,0.08)] hover:bg-[#213052]">
                    <td className="py-2">{po.description ?? "—"}</td>
                    <td className="py-2 text-right text-[#d4af5a] font-bold">{fmtAED(Number(po.amount))}</td>
                    <td className="py-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_COLORS[po.status] ?? ""}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="py-2 text-[#6b6454]">{new Date(po.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Invoices */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase">
            Invoices ({invoices.length})
          </h2>
          <Link
            href="/vendor-portal/submit-invoice"
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#b8902f] text-[#0f1626] hover:bg-[#d4af5a]"
          >
            + Submit Invoice
          </Link>
        </div>
        {invoices.length === 0 ? (
          <p className="text-[#6b6454] text-sm">No invoices submitted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
                  <th className="py-2 font-medium">Invoice #</th>
                  <th className="py-2 font-medium text-right">Amount</th>
                  <th className="py-2 font-medium text-right">Total (VAT)</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-[rgba(184,144,47,0.08)] hover:bg-[#213052]">
                    <td className="py-2 font-medium">{inv.invoice_number}</td>
                    <td className="py-2 text-right">{fmtAED(Number(inv.amount))}</td>
                    <td className="py-2 text-right text-[#d4af5a] font-bold">{fmtAED(Number(inv.total_amount))}</td>
                    <td className="py-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_COLORS[inv.status] ?? ""}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-2 text-[#6b6454]">{inv.invoice_date}</td>
                    <td className="py-2 text-[#6b6454]">{inv.due_date ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {unpaidInvoices.length > 0 && (
        <div className="border border-amber-500/30 bg-amber-950/20 rounded-xl p-4">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
            Outstanding Payments
          </p>
          <p className="text-lg font-extrabold text-amber-300">
            {fmtAED(unpaidInvoices.reduce((s, i) => s + Number(i.total_amount), 0))}
          </p>
          <p className="text-[10px] text-amber-400/70">{unpaidInvoices.length} invoices awaiting payment</p>
        </div>
      )}
    </main>
  );
}
