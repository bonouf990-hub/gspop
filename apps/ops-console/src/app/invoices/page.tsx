import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { requireManagementRole } from "@/lib/check-permission";
import CreateInvoice from "./CreateInvoice";
import InvoiceActions from "./InvoiceActions";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  amount: number;
  vat_amount: number;
  total_amount: number;
  status: string;
  payment_method: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  notes: string | null;
  verified_at: string | null;
  created_at: string;
  vendor: { name: string } | null;
  purchase_order: { id: string; description: string | null; amount: number } | null;
  verified_by_user: { full_name: string } | null;
};

type Vendor = { id: string; name: string };
type PO = { id: string; description: string | null; amount: number; vendor: { name: string } | null };

async function getPageData() {
  const supabase = await createClient();
  const [{ data: invoices }, { data: vendors }, { data: openPOs }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        `id, invoice_number, invoice_date, due_date, amount, vat_amount, total_amount,
         status, payment_method, payment_reference, paid_at, notes, verified_at, created_at,
         vendor:vendors(name),
         purchase_order:purchase_orders(id, description, amount),
         verified_by_user:user_profiles!invoices_verified_by_fkey(full_name)`
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("vendors").select("id, name").order("name"),
    supabase
      .from("purchase_orders")
      .select("id, description, amount, vendor:vendors(name)")
      .in("status", ["approved", "fulfilled"])
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return {
    invoices: (invoices ?? []) as unknown as InvoiceRow[],
    vendors: (vendors ?? []) as Vendor[],
    openPOs: (openPOs ?? []) as unknown as PO[],
  };
}

const STATUS_STYLE: Record<string, string> = {
  received: "bg-[#213052] text-[#a0977e]",
  verified: "bg-green-900/50 text-green-300",
  disputed: "bg-red-900/50 text-red-300",
  approved: "bg-[rgba(184,144,47,0.12)] text-[#d4af5a]",
  paid: "bg-[#213052] text-[#a0977e]",
};

export default async function InvoicesPage() {
  const auth = await requireManagementRole();
  if (!auth.allowed) {
    return <main className="p-8"><p className="text-[#6b6454]">You don&apos;t have access to Invoices.</p></main>;
  }

  const { invoices, vendors, openPOs } = await getPageData();

  const received = invoices.filter((i) => i.status === "received");
  const verified = invoices.filter((i) => i.status === "verified");
  const disputed = invoices.filter((i) => i.status === "disputed");
  const approved = invoices.filter((i) => i.status === "approved");
  const paid = invoices.filter((i) => i.status === "paid");

  const totalOutstanding = [...received, ...verified, ...approved].reduce(
    (s, i) => s + Number(i.total_amount), 0
  );
  const totalPaid = paid.reduce((s, i) => s + Number(i.total_amount), 0);

  const today = new Date().toISOString().slice(0, 10);
  const overdue = invoices.filter(
    (i) => i.due_date && i.due_date < today && !["paid", "disputed"].includes(i.status)
  );

  const kpis = [
    { label: "Received", value: received.length, color: "text-[#a0977e]" },
    { label: "Verified", value: verified.length, color: "text-green-400" },
    { label: "Disputed", value: disputed.length, color: "text-red-400" },
    { label: "Approved", value: approved.length, color: "text-[#d4af5a]" },
    { label: "Paid", value: paid.length, color: "text-[#a0977e]" },
  ];

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-extrabold mt-1">Invoices & Payments</h1>
          <p className="text-[#a0977e] text-sm mt-1">
            Track contractor invoices, verify against POs, and record payments.
          </p>
        </div>
        <CreateInvoice vendors={vendors} purchaseOrders={openPOs} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {kpis.map((k) => (
          <div key={k.label} className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 text-center">
            <p className={`text-2xl font-extrabold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <div className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 text-center">
          <p className="text-lg font-extrabold text-amber-400">
            AED {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">Outstanding</p>
        </div>
        <div className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 text-center">
          <p className="text-lg font-extrabold text-green-400">
            AED {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">Total Paid</p>
        </div>
        <div className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 text-center">
          <p className={`text-lg font-extrabold ${overdue.length > 0 ? "text-red-400" : "text-[#6b6454]"}`}>
            {overdue.length}
          </p>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">Overdue</p>
        </div>
      </div>

      {overdue.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold text-red-400 tracking-[0.15em] uppercase mb-3">
            Overdue Invoices ({overdue.length})
          </h2>
          <div className="space-y-2">
            {overdue.map((inv) => {
              const vendor = inv.vendor as { name: string } | null;
              const daysPast = Math.floor(
                (Date.now() - new Date(inv.due_date!).getTime()) / (1000 * 60 * 60 * 24)
              );
              return (
                <div
                  key={inv.id}
                  className="border border-red-500 bg-red-950/20 rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">#{inv.invoice_number}</p>
                      <span className="text-[#d4af5a] font-bold">
                        AED {Number(inv.total_amount).toLocaleString()}
                      </span>
                      <span className="text-red-400 text-xs font-bold">{daysPast}d overdue</span>
                    </div>
                    <p className="text-sm text-[#a0977e]">
                      {vendor?.name ?? "Unknown vendor"} · Due {new Date(inv.due_date!).toLocaleDateString()}
                    </p>
                  </div>
                  <InvoiceActions invoiceId={inv.id} currentStatus={inv.status} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
          All Invoices ({invoices.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[1000px]">
            <thead>
              <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
                <th className="py-2 font-medium">Invoice #</th>
                <th className="py-2 font-medium">Vendor</th>
                <th className="py-2 font-medium">PO Link</th>
                <th className="py-2 font-medium">Amount</th>
                <th className="py-2 font-medium">VAT</th>
                <th className="py-2 font-medium">Total</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Invoice Date</th>
                <th className="py-2 font-medium">Due Date</th>
                <th className="py-2 font-medium">Payment</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const vendor = inv.vendor as { name: string } | null;
                const po = inv.purchase_order as { id: string; description: string | null; amount: number } | null;
                const verifier = inv.verified_by_user as { full_name: string } | null;
                const isOverdue = inv.due_date && inv.due_date < today && !["paid", "disputed"].includes(inv.status);
                return (
                  <tr key={inv.id} className={`border-b border-[rgba(184,144,47,0.08)] hover:bg-[#213052] ${isOverdue ? "bg-red-950/10" : ""}`}>
                    <td className="py-2 font-medium">{inv.invoice_number}</td>
                    <td className="py-2 text-[#a0977e]">{vendor?.name ?? "—"}</td>
                    <td className="py-2">
                      {po ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[rgba(184,144,47,0.12)] text-[#b8902f]">
                          PO: {po.description?.slice(0, 20) ?? po.id.slice(0, 8)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#6b6454]">No PO</span>
                      )}
                    </td>
                    <td className="py-2">{Number(inv.amount).toLocaleString()}</td>
                    <td className="py-2 text-[#6b6454]">{Number(inv.vat_amount).toLocaleString()}</td>
                    <td className="py-2 text-[#d4af5a] font-medium">{Number(inv.total_amount).toLocaleString()}</td>
                    <td className="py-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[inv.status] ?? ""}`}>
                        {inv.status}
                      </span>
                      {verifier && inv.status === "verified" && (
                        <p className="text-[10px] text-[#6b6454] mt-0.5">by {verifier.full_name}</p>
                      )}
                    </td>
                    <td className="py-2 text-[#a0977e]">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                    <td className={`py-2 ${isOverdue ? "text-red-400 font-bold" : "text-[#a0977e]"}`}>
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 text-[#6b6454] text-xs">
                      {inv.paid_at ? (
                        <span>
                          {inv.payment_method?.replace(/_/g, " ") ?? ""}{inv.payment_reference ? ` · ${inv.payment_reference}` : ""}
                          <br />{new Date(inv.paid_at).toLocaleDateString()}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-2">
                      <InvoiceActions invoiceId={inv.id} currentStatus={inv.status} />
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td className="py-4 text-[#6b6454]" colSpan={11}>
                    No invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
