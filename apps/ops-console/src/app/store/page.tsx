import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import StoreRequestActions from "./StoreRequestActions";

type PartsRequestRow = {
  id: string;
  work_order_id: string | null;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  status: string;
  delivery_method: string;
  delivery_location: string | null;
  notes: string | null;
  created_at: string;
  inventory_item: { id: string; name: string; sku: string | null; quantity_on_hand: number; unit_of_measure: string | null; unit_cost: number | null } | null;
  requester: { full_name: string } | null;
  work_order: { title: string; properties: { name: string } | null; units: { label: string } | null } | null;
};

type ApartmentPart = {
  property_name: string;
  unit_label: string | null;
  item_name: string;
  item_sku: string | null;
  total_qty: number;
  total_cost: number;
  last_issued: string;
  request_count: number;
};

async function getStoreData() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("parts_requests")
    .select(
      `id, work_order_id, quantity, unit_cost, total_cost, status, delivery_method, delivery_location, notes, created_at,
       inventory_item:inventory_items(id, name, sku, quantity_on_hand, unit_of_measure, unit_cost),
       requester:user_profiles!parts_requests_requested_by_fkey(full_name),
       work_order:work_orders(title, properties(name), units(label))`
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const all = (data ?? []) as unknown as PartsRequestRow[];
  const pending = all.filter((r) => ["requested", "approved", "picking", "delivering"].includes(r.status));
  const completed = all.filter((r) => ["delivered", "collected", "rejected"].includes(r.status));

  const fulfilled = all.filter((r) => ["delivered", "collected"].includes(r.status));
  const apartmentMap = new Map<string, ApartmentPart>();
  for (const r of fulfilled) {
    const wo = r.work_order as { title: string; properties: { name: string } | null; units: { label: string } | null } | null;
    const property = wo?.properties as { name: string } | null;
    const unit = wo?.units as { label: string } | null;
    const item = r.inventory_item as { name: string; sku: string | null; unit_cost: number | null } | null;
    if (!property || !item) continue;

    const lineCost = r.total_cost ? Number(r.total_cost) : Number(r.quantity) * Number(item.unit_cost ?? 0);
    const key = `${property.name}||${unit?.label ?? ""}||${item.name}`;
    const existing = apartmentMap.get(key);
    if (existing) {
      existing.total_qty += Number(r.quantity);
      existing.total_cost += lineCost;
      existing.request_count++;
      if (r.created_at > existing.last_issued) existing.last_issued = r.created_at;
    } else {
      apartmentMap.set(key, {
        property_name: property.name,
        unit_label: unit?.label ?? null,
        item_name: item.name,
        item_sku: item.sku ?? null,
        total_qty: Number(r.quantity),
        total_cost: lineCost,
        last_issued: r.created_at,
        request_count: 1,
      });
    }
  }

  const apartmentParts = [...apartmentMap.values()].sort((a, b) =>
    a.property_name.localeCompare(b.property_name) || (a.unit_label ?? "").localeCompare(b.unit_label ?? "")
  );

  return { pending, completed, apartmentParts };
}

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-900 text-amber-300",
  approved: "bg-[rgba(184,144,47,0.12)] text-[#d4af5a]",
  picking: "bg-[rgba(184,144,47,0.12)] text-[#d4af5a]",
  delivering: "bg-amber-900 text-amber-300",
  delivered: "bg-green-900 text-green-300",
  collected: "bg-green-900 text-green-300",
  rejected: "bg-red-900 text-red-300",
};

export default async function StorePage() {
  const { pending, completed, apartmentParts } = await getStoreData();

  return (
    <main className="p-8">
      <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">← Dashboard</Link>
      <h1 className="text-2xl font-extrabold mt-1 mb-1">Store & Dispatch</h1>
      <p className="text-[#a0977e] mb-6">
        Incoming parts requests from technicians on-site. Pick, pack, and dispatch or mark for pickup.
      </p>

      <section className="mb-8">
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
          Active Requests ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-[#6b6454] text-sm">No pending requests.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => {
              const item = r.inventory_item as { id: string; name: string; sku: string | null; quantity_on_hand: number; unit_of_measure: string | null; unit_cost: number | null } | null;
              const requester = r.requester as { full_name: string } | null;
              const wo = r.work_order as { title: string; properties: { name: string } | null; units: { label: string } | null } | null;
              const property = wo?.properties as { name: string } | null;
              const unit = wo?.units as { label: string } | null;
              const itemCost = Number(item?.unit_cost ?? 0);
              const lineCost = itemCost * Number(r.quantity);

              return (
                <div key={r.id} className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-lg">
                        {item?.name ?? "Item"}
                        <span className="text-[#d4af5a] ml-2">
                          × {Number(r.quantity)} {item?.unit_of_measure ?? ""}
                        </span>
                      </p>
                      {item?.sku && <p className="text-xs text-[#6b6454]">SKU: {item.sku}</p>}
                      <div className="flex gap-4 mt-1">
                        <p className="text-sm text-[#a0977e]">
                          In stock: {item ? Number(item.quantity_on_hand) : "?"} {item?.unit_of_measure ?? ""}
                        </p>
                        {itemCost > 0 && (
                          <p className="text-sm text-[#d4af5a]">
                            Unit: AED {itemCost.toLocaleString()} · Total: AED {lineCost.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status] ?? ""}`}>
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-[#6b6454]">Requested by:</span>{" "}
                      <span className="text-[#f0ece4]">{requester?.full_name ?? "—"}</span>
                    </div>
                    <div>
                      <span className="text-[#6b6454]">Work order:</span>{" "}
                      {r.work_order_id ? (
                        <Link href={`/work-orders/${r.work_order_id}`} className="text-[#d4af5a] hover:text-[#b8902f]">
                          {wo?.title ?? "View"}
                        </Link>
                      ) : (
                        <span className="text-[#f0ece4]">{wo?.title ?? "—"}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[#6b6454]">Location:</span>{" "}
                      <span className="text-[#f0ece4]">
                        {[property?.name, unit?.label].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6b6454]">Method:</span>{" "}
                      <span className="text-[#f0ece4]">
                        {r.delivery_method === "deliver" ? "🚚 Deliver" : "🏪 Pickup"}
                      </span>
                    </div>
                  </div>

                  {r.delivery_location && (
                    <p className="text-sm text-[#a0977e] mb-2">📍 Deliver to: {r.delivery_location}</p>
                  )}
                  {r.notes && (
                    <p className="text-sm text-[#6b6454] mb-3">Note: {r.notes}</p>
                  )}

                  <StoreRequestActions requestId={r.id} currentStatus={r.status} inventoryItemId={item?.id ?? ""} quantity={Number(r.quantity)} unitCost={itemCost} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
          Completed ({completed.length})
        </h2>
        {completed.length === 0 ? (
          <p className="text-[#6b6454] text-sm">No completed requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[900px]">
              <thead>
                <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 font-medium">Qty</th>
                  <th className="py-2 font-medium text-right">Cost</th>
                  <th className="py-2 font-medium">Building / Apartment</th>
                  <th className="py-2 font-medium">Work Order</th>
                  <th className="py-2 font-medium">Requester</th>
                  <th className="py-2 font-medium">Method</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {completed.map((r) => {
                  const item = r.inventory_item as { name: string; sku: string | null } | null;
                  const requester = r.requester as { full_name: string } | null;
                  const wo = r.work_order as { title: string; properties: { name: string } | null; units: { label: string } | null } | null;
                  const property = wo?.properties as { name: string } | null;
                  const unit = wo?.units as { label: string } | null;
                  const cost = r.total_cost ? Number(r.total_cost) : null;
                  return (
                    <tr key={r.id} className="border-b border-[rgba(184,144,47,0.08)]">
                      <td className="py-2">
                        {item?.name ?? "—"}
                        {item?.sku && <span className="text-[#6b6454] text-[10px] ml-1">({item.sku})</span>}
                      </td>
                      <td className="py-2 font-medium">{Number(r.quantity)}</td>
                      <td className="py-2 text-right">
                        {cost !== null ? (
                          <span className="text-[#d4af5a] font-medium">AED {cost.toLocaleString()}</span>
                        ) : (
                          <span className="text-[#6b6454]">—</span>
                        )}
                      </td>
                      <td className="py-2">
                        <span className="font-medium">{property?.name ?? "—"}</span>
                        {unit && <span className="text-[#d4af5a] ml-1">· {unit.label}</span>}
                      </td>
                      <td className="py-2">
                        {r.work_order_id ? (
                          <Link href={`/work-orders/${r.work_order_id}`} className="text-[#d4af5a] hover:underline text-xs">
                            {wo?.title ?? "View"}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="py-2 text-[#a0977e]">{requester?.full_name ?? "—"}</td>
                      <td className="py-2 text-[#a0977e]">
                        {r.delivery_method === "deliver" ? "Deliver" : "Pickup"}
                      </td>
                      <td className="py-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status] ?? ""}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 text-[#6b6454]">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
          Parts Issued by Building & Apartment
        </h2>
        <p className="text-xs text-[#a0977e] mb-3">
          Complete record of all parts delivered to each apartment — track what was issued, when, and how many times.
        </p>
        {apartmentParts.length === 0 ? (
          <p className="text-[#6b6454] text-sm">No parts issued yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
                  <th className="py-2 font-medium">Building</th>
                  <th className="py-2 font-medium">Apartment</th>
                  <th className="py-2 font-medium">Part</th>
                  <th className="py-2 font-medium text-right">Total Qty</th>
                  <th className="py-2 font-medium text-right">Total Cost</th>
                  <th className="py-2 font-medium text-right">Times Issued</th>
                  <th className="py-2 font-medium">Last Issued</th>
                </tr>
              </thead>
              <tbody>
                {apartmentParts.map((ap, i) => (
                  <tr key={i} className="border-b border-[rgba(184,144,47,0.08)] hover:bg-[#213052]">
                    <td className="py-2 font-medium">{ap.property_name}</td>
                    <td className="py-2">
                      {ap.unit_label ? (
                        <span className="text-[#d4af5a] font-medium">{ap.unit_label}</span>
                      ) : (
                        <span className="text-[#6b6454]">Common Area</span>
                      )}
                    </td>
                    <td className="py-2">
                      {ap.item_name}
                      {ap.item_sku && <span className="text-[#6b6454] text-[10px] ml-1">({ap.item_sku})</span>}
                    </td>
                    <td className="py-2 text-right text-[#d4af5a] font-bold">{ap.total_qty}</td>
                    <td className="py-2 text-right text-[#d4af5a] font-medium">
                      {ap.total_cost > 0 ? `AED ${ap.total_cost.toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 text-right text-[#a0977e]">{ap.request_count}</td>
                    <td className="py-2 text-[#6b6454]">{new Date(ap.last_issued).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
