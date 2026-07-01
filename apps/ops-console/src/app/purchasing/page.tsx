import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CreatePurchaseOrder from "./CreatePurchaseOrder";
import PurchaseOrderActions from "./PurchaseOrderActions";

type PORow = {
  id: string;
  description: string | null;
  amount: number;
  status: string;
  created_at: string;
  property: { name: string } | null;
  vendor: { name: string } | null;
  requester: { full_name: string } | null;
  work_order: { title: string } | null;
};

type Property = { id: string; name: string };
type Vendor = { id: string; name: string; category: string | null };

async function getPageData() {
  const supabase = await createClient();
  const [{ data: orders }, { data: properties }, { data: vendors }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(
        "id, description, amount, status, created_at, property:properties(name), vendor:vendors(name), requester:user_profiles!purchase_orders_requested_by_fkey(full_name), work_order:work_orders(title)"
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("properties").select("id, name").order("name"),
    supabase.from("vendors").select("id, name, category").order("name"),
  ]);

  return {
    orders: (orders ?? []) as unknown as PORow[],
    properties: (properties ?? []) as Property[],
    vendors: (vendors ?? []) as Vendor[],
  };
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-900 text-amber-300",
  approved: "bg-green-900 text-green-300",
  rejected: "bg-red-900 text-red-300",
  escalated: "bg-[rgba(184,144,47,0.12)] text-[#d4af5a]",
  fulfilled: "bg-[#213052] text-[#a0977e]",
};

export default async function PurchasingPage() {
  const { orders, properties, vendors } = await getPageData();

  const pending = orders.filter((o) => o.status === "pending");
  const rest = orders.filter((o) => o.status !== "pending");

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
              return (
                <div key={o.id} className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {o.description ?? "Purchase Order"}
                      <span className="text-[#d4af5a] ml-2 font-bold">
                        AED {Number(o.amount).toLocaleString()}
                      </span>
                    </p>
                    <p className="text-sm text-[#a0977e]">
                      {[vendor?.name, property?.name].filter(Boolean).join(" · ")}
                      {requester && ` · Requested by ${requester.full_name}`}
                    </p>
                    {wo && (
                      <p className="text-xs text-[#6b6454]">Work order: {wo.title}</p>
                    )}
                  </div>
                  <PurchaseOrderActions orderId={o.id} currentStatus={o.status} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
          All Orders
        </h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 font-medium">Vendor</th>
              <th className="py-2 font-medium">Property</th>
              <th className="py-2 font-medium text-right">Amount</th>
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
              return (
                <tr key={o.id} className="border-b border-[rgba(184,144,47,0.08)] hover:bg-[#213052]">
                  <td className="py-2 font-medium">{o.description ?? "—"}</td>
                  <td className="py-2 text-[#a0977e]">{vendor?.name ?? "—"}</td>
                  <td className="py-2 text-[#a0977e]">{property?.name ?? "—"}</td>
                  <td className="py-2 text-right text-[#d4af5a] font-medium">
                    {Number(o.amount).toLocaleString()}
                  </td>
                  <td className="py-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status] ?? ""}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="py-2">{requester?.full_name ?? "—"}</td>
                  <td className="py-2 text-[#6b6454]">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2">
                    <PurchaseOrderActions orderId={o.id} currentStatus={o.status} />
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td className="py-4 text-[#6b6454]" colSpan={8}>
                  No purchase orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
