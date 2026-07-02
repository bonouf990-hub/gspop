import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { requireManagementRole } from "@/lib/check-permission";
import PurchaseOrderActions from "../PurchaseOrderActions";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-900 text-amber-700",
  approved: "bg-green-900 text-green-700",
  rejected: "bg-red-900 text-red-700",
  escalated: "bg-[rgba(176,27,66,0.12)] text-[#d9647f]",
  fulfilled: "bg-[#e9eef6] text-[#5b6b85]",
};

async function getPurchaseOrder(id: string) {
  const supabase = await createClient();

  const { data: po } = await supabase
    .from("purchase_orders")
    .select(
      `*, property:properties(name),
       vendor:vendors(id, name, category, rating),
       requester:user_profiles!purchase_orders_requested_by_fkey(full_name),
       approver:user_profiles!purchase_orders_approved_by_fkey(full_name),
       work_order:work_orders(id, title, status, type),
       tender:tenders(id, title, status)`
    )
    .eq("id", id)
    .single();

  return po;
}

async function getLinkedInvoices(poId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_amount, status, invoice_date, due_date, vendor:vendors(name)")
    .eq("purchase_order_id", poId)
    .order("invoice_date", { ascending: false });
  return (data ?? []) as unknown as {
    id: string;
    invoice_number: string;
    total_amount: number;
    status: string;
    invoice_date: string;
    due_date: string | null;
    vendor: { name: string } | null;
  }[];
}

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireManagementRole();
  if (!auth.allowed) {
    return <main className="p-8"><p className="text-[#8b97ab]">You don&apos;t have access to Purchasing.</p></main>;
  }

  const { id } = await params;
  const [po, invoices] = await Promise.all([
    getPurchaseOrder(id),
    getLinkedInvoices(id),
  ]);

  if (!po) {
    return (
      <main className="p-8">
        <p className="text-[#8b97ab]">Purchase order not found.</p>
      </main>
    );
  }

  const property = po.property as unknown as { name: string } | null;
  const vendor = po.vendor as unknown as { id: string; name: string; category: string | null; rating: number | null } | null;
  const requester = po.requester as unknown as { full_name: string } | null;
  const approver = po.approver as unknown as { full_name: string } | null;
  const workOrder = po.work_order as unknown as { id: string; title: string; status: string; type: string } | null;
  const tender = po.tender as unknown as { id: string; title: string; status: string } | null;

  const invoiceTotal = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const invoicesPaid = invoices.filter((i) => i.status === "paid");
  const paidTotal = invoicesPaid.reduce((s, i) => s + Number(i.total_amount), 0);

  const INV_STATUS: Record<string, string> = {
    received: "bg-amber-900 text-amber-700",
    verified: "bg-[rgba(176,27,66,0.12)] text-[#d9647f]",
    disputed: "bg-red-900 text-red-700",
    approved: "bg-green-900 text-green-700",
    paid: "bg-[#e9eef6] text-[#5b6b85]",
  };

  return (
    <main className="p-8 max-w-3xl">
      <Link href="/purchasing" className="text-sm text-[#5b6b85] hover:text-[#b01b42]">
        ← Purchase Orders
      </Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-1">
        {po.description ?? "Purchase Order"}
      </h1>
      <p className="text-[#5b6b85] mb-6">PO #{(po.id as string).slice(0, 8).toUpperCase()}</p>

      {/* Status & Actions */}
      <section className="lux-card p-4 mb-4">
        <h2 className="eyebrow mb-3">Status</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${STATUS_STYLE[po.status as string] ?? ""}`}>
            {(po.status as string).charAt(0).toUpperCase() + (po.status as string).slice(1)}
          </span>
          <PurchaseOrderActions orderId={id} currentStatus={po.status as string} amount={Number(po.amount)} />
        </div>
      </section>

      {/* Details */}
      <section className="lux-card p-4 mb-4">
        <h2 className="eyebrow mb-3">Details</h2>
        <div className="grid grid-cols-2 gap-y-1 text-sm">
          <span className="text-[#5b6b85]">Amount</span>
          <span className="font-bold text-[#d9647f]">AED {Number(po.amount).toLocaleString()}</span>
          <span className="text-[#5b6b85]">Property</span>
          <span>{property?.name ?? "—"}</span>
          <span className="text-[#5b6b85]">Vendor</span>
          <span>
            {vendor ? (
              <>
                {vendor.name}
                {vendor.category && <span className="text-[#8b97ab] ml-1">({vendor.category})</span>}
                {vendor.rating && <span className="text-[#d9647f] ml-1">{"★".repeat(Math.round(Number(vendor.rating)))}</span>}
              </>
            ) : "—"}
          </span>
          <span className="text-[#5b6b85]">Requested by</span>
          <span>{requester?.full_name ?? "—"}</span>
          <span className="text-[#5b6b85]">Approved by</span>
          <span>{approver?.full_name ?? "—"}</span>
          {po.urgency && (
            <>
              <span className="text-[#5b6b85]">Urgency</span>
              <span className="capitalize font-medium text-amber-700">{po.urgency as string}</span>
            </>
          )}
          <span className="text-[#5b6b85]">Created</span>
          <span>{new Date(po.created_at as string).toLocaleString()}</span>
          {po.approved_at && (
            <>
              <span className="text-[#5b6b85]">Approved at</span>
              <span>{new Date(po.approved_at as string).toLocaleString()}</span>
            </>
          )}
        </div>
        {po.notes && (
          <div className="mt-3 text-sm">
            <span className="text-[#5b6b85]">Notes: </span>
            <span className="text-[#16233c]">{po.notes as string}</span>
          </div>
        )}
      </section>

      {/* Linked Work Order */}
      {workOrder && (
        <section className="lux-card p-4 mb-4">
          <h2 className="eyebrow mb-3">Linked Work Order</h2>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium">{workOrder.title}</p>
              <p className="text-[10px] text-[#8b97ab] capitalize">
                {workOrder.type} · {workOrder.status.replace(/_/g, " ")}
              </p>
            </div>
            <Link
              href={`/work-orders/${workOrder.id}`}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#e9eef6] text-[#d9647f] hover:bg-[rgba(176,27,66,0.15)]"
            >
              View Work Order
            </Link>
          </div>
        </section>
      )}

      {/* Linked Tender */}
      {tender && (
        <section className="lux-card p-4 mb-4">
          <h2 className="eyebrow mb-3">Source Tender</h2>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium">{tender.title}</p>
              <p className="text-[10px] text-[#8b97ab] capitalize">Status: {tender.status}</p>
            </div>
            <Link
              href={`/tenders/${tender.id}`}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#e9eef6] text-[#d9647f] hover:bg-[rgba(176,27,66,0.15)]"
            >
              View Tender
            </Link>
          </div>
        </section>
      )}

      {/* Linked Invoices */}
      <section className="lux-card p-4 mb-4">
        <h2 className="eyebrow mb-3">
          Invoices ({invoices.length})
        </h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-[#8b97ab]">No invoices linked to this purchase order.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-[#f4f6fa] rounded-lg p-3 text-center">
                <p className="text-sm font-bold text-[#d9647f]">AED {Number(po.amount).toLocaleString()}</p>
                <p className="text-[10px] text-[#8b97ab] uppercase">PO Amount</p>
              </div>
              <div className="bg-[#f4f6fa] rounded-lg p-3 text-center">
                <p className="text-sm font-bold text-amber-700">AED {invoiceTotal.toLocaleString()}</p>
                <p className="text-[10px] text-[#8b97ab] uppercase">Invoiced</p>
              </div>
              <div className="bg-[#f4f6fa] rounded-lg p-3 text-center">
                <p className="text-sm font-bold text-green-700">AED {paidTotal.toLocaleString()}</p>
                <p className="text-[10px] text-[#8b97ab] uppercase">Paid</p>
              </div>
            </div>
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="bg-[#f4f6fa] rounded-lg px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {inv.invoice_number}
                      <span className="text-[#d9647f] ml-2 font-bold">
                        AED {Number(inv.total_amount).toLocaleString()}
                      </span>
                    </p>
                    <p className="text-[10px] text-[#8b97ab]">
                      {new Date(inv.invoice_date).toLocaleDateString()}
                      {inv.due_date && ` · Due: ${new Date(inv.due_date).toLocaleDateString()}`}
                    </p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${INV_STATUS[inv.status] ?? ""}`}>
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
