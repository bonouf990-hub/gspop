import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { requireManagementRole } from "@/lib/check-permission";
import CreatePurchaseOrder from "./CreatePurchaseOrder";
import PurchaseOrderActions from "./PurchaseOrderActions";

type PORow = {
  id: string;
  description: string | null;
  amount: number;
  status: string;
  urgency: string | null;
  created_at: string;
  approved_at: string | null;
  notes: string | null;
  tender_id: string | null;
  property: { name: string } | null;
  vendor: { name: string } | null;
  requester: { full_name: string } | null;
  approver: { full_name: string } | null;
  work_order: { title: string } | null;
  tender: { title: string } | null;
};

type Property = { id: string; name: string };
type Vendor = { id: string; name: string; category: string | null };

type DecidedTender = {
  id: string;
  title: string;
  currency: string;
  decided_at: string;
  decided_vendor: { id: string; name: string } | null;
  property: { id: string; name: string } | null;
  winning_amount: number | null;
};

async function getPageData() {
  const supabase = await createClient();
  const [{ data: orders }, { data: properties }, { data: vendors }, { data: decidedTenders }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(
        "id, description, amount, status, urgency, created_at, approved_at, notes, tender_id, property:properties(name), vendor:vendors(name), requester:user_profiles!purchase_orders_requested_by_fkey(full_name), approver:user_profiles!purchase_orders_approved_by_fkey(full_name), work_order:work_orders(title), tender:tenders(title)"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("properties").select("id, name").order("name"),
    supabase.from("vendors").select("id, name, category").order("name"),
    supabase
      .from("tenders")
      .select(
        `id, title, currency, decided_at,
         decided_vendor:vendors!tenders_decided_vendor_id_fkey(id, name),
         property:properties(id, name)`
      )
      .eq("status", "decided"),
  ]);

  const ordersList = (orders ?? []) as unknown as PORow[];
  const tenderIdsWithPO = new Set(ordersList.filter((o) => o.tender_id).map((o) => o.tender_id));

  const tendersNeedingPO = ((decidedTenders ?? []) as unknown as DecidedTender[]).filter(
    (t) => !tenderIdsWithPO.has(t.id)
  );

  // fetch winning amounts
  for (const t of tendersNeedingPO) {
    const { data: winnerSub } = await supabase
      .from("tender_submissions")
      .select("proposed_amount")
      .eq("tender_id", t.id)
      .eq("status", "winner")
      .limit(1)
      .single();
    t.winning_amount = winnerSub ? Number(winnerSub.proposed_amount) : null;
  }

  return {
    orders: ordersList,
    properties: (properties ?? []) as Property[],
    vendors: (vendors ?? []) as Vendor[],
    tendersNeedingPO,
  };
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-900 text-amber-300",
  approved: "bg-green-900 text-green-300",
  rejected: "bg-red-900 text-red-300",
  escalated: "bg-[rgba(184,144,47,0.12)] text-[#d4af5a]",
  fulfilled: "bg-[#213052] text-[#a0977e]",
};

const URGENCY_STYLE: Record<string, string> = {
  urgent: "bg-amber-900 text-amber-300",
  critical: "bg-red-900 text-red-300",
};

export default async function PurchasingPage() {
  const auth = await requireManagementRole();
  if (!auth.allowed) {
    return <main className="p-8"><p className="text-[#6b6454]">You don&apos;t have access to Purchasing.</p></main>;
  }

  const { orders, properties, vendors, tendersNeedingPO } = await getPageData();

  const pending = orders.filter((o) => o.status === "pending");
  const approved = orders.filter((o) => o.status === "approved");
  const fulfilled = orders.filter((o) => o.status === "fulfilled");
  const rejected = orders.filter((o) => o.status === "rejected");
  const tenderSourced = orders.filter((o) => o.tender_id);

  const totalPending = pending.reduce((s, o) => s + Number(o.amount), 0);
  const totalApproved = approved.reduce((s, o) => s + Number(o.amount), 0);
  const totalFulfilled = fulfilled.reduce((s, o) => s + Number(o.amount), 0);

  const kpis = [
    { label: "Pending", value: pending.length, amount: totalPending, color: "text-amber-400" },
    { label: "Approved", value: approved.length, amount: totalApproved, color: "text-green-400" },
    { label: "Fulfilled", value: fulfilled.length, amount: totalFulfilled, color: "text-[#d4af5a]" },
    { label: "Rejected", value: rejected.length, amount: null, color: "text-red-400" },
    { label: "From Tenders", value: tenderSourced.length, amount: null, color: "text-[#b8902f]" },
  ];

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-extrabold mt-1">Purchasing</h1>
          <p className="text-[#a0977e] text-sm mt-1">
            Create purchase orders, track approval status, and mark fulfilled orders.
          </p>
        </div>
        <CreatePurchaseOrder properties={properties} vendors={vendors} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 text-center">
            <p className={`text-2xl font-extrabold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">{k.label}</p>
            {k.amount !== null && (
              <p className="text-xs text-[#6b6454] mt-0.5">
                AED {k.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            )}
          </div>
        ))}
      </div>

      {tendersNeedingPO.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
            Decided Tenders — PO Required ({tendersNeedingPO.length})
          </h2>
          <div className="space-y-2">
            {tendersNeedingPO.map((t) => {
              const vendor = t.decided_vendor as { id: string; name: string } | null;
              const prop = t.property as { id: string; name: string } | null;
              return (
                <div
                  key={t.id}
                  className="border border-[#b8902f] bg-[rgba(184,144,47,0.08)] rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {t.title}
                      {t.winning_amount !== null && (
                        <span className="text-[#d4af5a] ml-2 font-bold">
                          {t.currency} {t.winning_amount.toLocaleString()}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-[#a0977e]">
                      Winner: {vendor?.name ?? "—"}
                      {prop && ` · ${prop.name}`}
                      {t.decided_at && ` · Decided ${new Date(t.decided_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/tenders/${t.id}`}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#213052] text-[#d4af5a] hover:bg-[rgba(184,144,47,0.15)]"
                    >
                      View Tender
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
            Pending Approval ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((o) => {
              const vendor = o.vendor as { name: string } | null;
              const property = o.property as { name: string } | null;
              const requester = o.requester as { full_name: string } | null;
              const wo = o.work_order as { title: string } | null;
              const tender = o.tender as { title: string } | null;
              const daysPending = Math.floor(
                (Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24)
              );
              return (
                <div
                  key={o.id}
                  className={`border rounded-xl p-4 flex items-center justify-between ${
                    o.urgency === "critical"
                      ? "border-red-500 bg-red-950/20"
                      : o.urgency === "urgent"
                        ? "border-amber-500 bg-amber-950/20"
                        : "border-[rgba(184,144,47,0.15)] bg-[#1a2640]"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/purchasing/${o.id}`} className="font-medium hover:text-[#d4af5a]">
                        {o.description ?? "Purchase Order"}
                      </Link>
                      <span className="text-[#d4af5a] font-bold">
                        AED {Number(o.amount).toLocaleString()}
                      </span>
                      {o.urgency && o.urgency !== "normal" && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${URGENCY_STYLE[o.urgency] ?? ""}`}>
                          {o.urgency.toUpperCase()}
                        </span>
                      )}
                      {tender && (
                        <Link
                          href={`/tenders/${o.tender_id}`}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[rgba(184,144,47,0.12)] text-[#b8902f] hover:bg-[rgba(184,144,47,0.2)]"
                        >
                          Tender: {tender.title}
                        </Link>
                      )}
                    </div>
                    <p className="text-sm text-[#a0977e] mt-0.5">
                      {[vendor?.name, property?.name].filter(Boolean).join(" · ")}
                      {requester && ` · Requested by ${requester.full_name}`}
                    </p>
                    {wo && (
                      <p className="text-xs text-[#6b6454]">Work order: {wo.title}</p>
                    )}
                    {daysPending > 3 && (
                      <p className="text-xs text-amber-400 mt-0.5">
                        Pending for {daysPending} days
                      </p>
                    )}
                  </div>
                  <PurchaseOrderActions orderId={o.id} currentStatus={o.status} amount={Number(o.amount)} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
          All Orders ({orders.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[800px]">
            <thead>
              <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 font-medium">Source</th>
                <th className="py-2 font-medium">Vendor</th>
                <th className="py-2 font-medium">Property</th>
                <th className="py-2 font-medium">Amount</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Requested By</th>
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const vendor = o.vendor as { name: string } | null;
                const property = o.property as { name: string } | null;
                const requester = o.requester as { full_name: string } | null;
                const approver = o.approver as { full_name: string } | null;
                const tender = o.tender as { title: string } | null;
                return (
                  <tr key={o.id} className="border-b border-[rgba(184,144,47,0.08)] hover:bg-[#213052]">
                    <td className="py-2">
                      <Link href={`/purchasing/${o.id}`} className="font-medium hover:text-[#d4af5a]">
                        {o.description ?? "—"}
                      </Link>
                      {o.notes && <p className="text-[10px] text-[#6b6454]">{o.notes}</p>}
                    </td>
                    <td className="py-2">
                      {tender ? (
                        <Link
                          href={`/tenders/${o.tender_id}`}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[rgba(184,144,47,0.12)] text-[#b8902f] hover:bg-[rgba(184,144,47,0.2)] whitespace-nowrap"
                        >
                          Tender
                        </Link>
                      ) : o.work_order ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#213052] text-[#a0977e]">
                          Work Order
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#6b6454]">Manual</span>
                      )}
                    </td>
                    <td className="py-2 text-[#a0977e]">{vendor?.name ?? "—"}</td>
                    <td className="py-2 text-[#a0977e]">{property?.name ?? "—"}</td>
                    <td className="py-2 text-[#d4af5a] font-medium">
                      {Number(o.amount).toLocaleString()}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status] ?? ""}`}>
                        {o.status}
                      </span>
                      {approver && o.status === "approved" && (
                        <p className="text-[10px] text-[#6b6454] mt-0.5">
                          by {approver.full_name}
                        </p>
                      )}
                    </td>
                    <td className="py-2">{requester?.full_name ?? "—"}</td>
                    <td className="py-2 text-[#6b6454]">
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <PurchaseOrderActions orderId={o.id} currentStatus={o.status} amount={Number(o.amount)} />
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td className="py-4 text-[#6b6454]" colSpan={9}>
                    No purchase orders yet.
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
