import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import AssignTechnicianControl from "./AssignTechnicianControl";
import WorkOrderStatusControl from "./WorkOrderStatusControl";
import RequestParts from "./RequestParts";
import CreateWorkOrderPO from "./CreateWorkOrderPO";

async function getWorkOrder(id: string) {
  const supabase = await createClient();

  const { data: wo } = await supabase
    .from("work_orders")
    .select(
      "*, properties(name), units(label), assets(name, category, status, condition), technician:user_profiles!work_orders_assigned_technician_id_fkey(full_name), creator:user_profiles!work_orders_created_by_fkey(full_name)"
    )
    .eq("id", id)
    .single();

  return wo;
}

async function getTechnicians() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("id, full_name, trade")
    .eq("role", "technician")
    .order("full_name");
  return (data ?? []).map((t) => ({
    id: t.id as string,
    fullName: t.full_name as string,
    trade: t.trade as string | null,
  }));
}

async function getPhotos(workOrderId: string) {
  const supabase = await createClient();
  const { data: photoRows } = await supabase
    .from("work_order_photos")
    .select("stage, storage_path, taken_at")
    .eq("work_order_id", workOrderId)
    .order("taken_at", { ascending: true });

  const paths = (photoRows ?? []).map((p) => p.storage_path as string);
  if (paths.length === 0) return { before: [] as string[], after: [] as string[] };

  const { data: signed } = await supabase.storage
    .from("work-order-photos")
    .createSignedUrls(paths, 3600);

  const urlMap = new Map<string, string>();
  (signed ?? []).forEach((s) => {
    if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
  });

  const before: string[] = [];
  const after: string[] = [];
  (photoRows ?? []).forEach((p) => {
    const url = urlMap.get(p.storage_path as string);
    if (url) {
      if (p.stage === "before") before.push(url);
      else after.push(url);
    }
  });

  return { before, after };
}

type PartsRequestRow = {
  id: string;
  quantity: number;
  status: string;
  delivery_method: string;
  notes: string | null;
  created_at: string;
  inventory_item: { name: string; sku: string | null; unit_of_measure: string | null } | null;
  requester: { full_name: string } | null;
};

async function getPartsRequests(workOrderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("parts_requests")
    .select(
      `id, quantity, status, delivery_method, notes, created_at,
       inventory_item:inventory_items(name, sku, unit_of_measure),
       requester:user_profiles!parts_requests_requested_by_fkey(full_name)`
    )
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as PartsRequestRow[];
}

async function getInventoryItems(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_items")
    .select("id, name, sku, quantity_on_hand, unit_of_measure")
    .or(`property_id.eq.${propertyId},property_id.is.null`)
    .order("name");
  return (data ?? []) as { id: string; name: string; sku: string | null; quantity_on_hand: number; unit_of_measure: string | null }[];
}

type PORow = {
  id: string;
  description: string | null;
  amount: number;
  status: string;
  created_at: string;
  vendor: { name: string } | null;
};

async function getWorkOrderPOs(workOrderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_orders")
    .select("id, description, amount, status, created_at, vendor:vendors(name)")
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as PORow[];
}

async function getVendors() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select("id, name, category")
    .order("name");
  return (data ?? []) as { id: string; name: string; category: string | null }[];
}

async function getLinkedComplaint(workOrderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("complaints")
    .select("id, category, sub_issue, status, created_at")
    .eq("work_order_id", workOrderId)
    .limit(1)
    .single();
  return data as { id: string; category: string; sub_issue: string | null; status: string; created_at: string } | null;
}

async function getCheckins(workOrderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("work_order_checkins")
    .select("type, latitude, longitude, accuracy_meters, timestamp")
    .eq("work_order_id", workOrderId)
    .order("timestamp", { ascending: true });
  return data ?? [];
}

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [wo, technicians, photos, checkins] = await Promise.all([
    getWorkOrder(id),
    getTechnicians(),
    getPhotos(id),
    getCheckins(id),
  ]);

  const propertyId = wo?.property_id as string | null;
  const [partsRequests, inventoryItems, purchaseOrders, vendors, linkedComplaint] = await Promise.all([
    getPartsRequests(id),
    propertyId ? getInventoryItems(propertyId) : Promise.resolve([]),
    getWorkOrderPOs(id),
    getVendors(),
    getLinkedComplaint(id),
  ]);

  if (!wo) {
    return (
      <main className="p-8">
        <p className="text-[#5d6880]">Work order not found.</p>
      </main>
    );
  }

  const property = wo.properties as unknown as { name: string } | null;
  const unit = wo.units as unknown as { label: string } | null;
  const asset = wo.assets as unknown as {
    name: string;
    category: string;
    status: string;
    condition: string;
  } | null;
  const tech = wo.technician as unknown as { full_name: string } | null;
  const creator = wo.creator as unknown as { full_name: string } | null;

  return (
    <main className="p-8 max-w-3xl">
      <Link href="/work-orders" className="text-sm text-[#9aa5bd] hover:text-[#b01b42]">
        ← Work Orders
      </Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-1">{wo.title}</h1>
      <p className="text-[#9aa5bd] mb-6">{wo.description}</p>

      <section className="lux-card p-4 mb-4">
        <h2 className="eyebrow mb-3">Status</h2>
        <WorkOrderStatusControl id={id} currentStatus={wo.status as string} startedAt={(wo.started_at as string | null) ?? null} />
      </section>

      <section className="lux-card p-4 mb-4">
        <h2 className="eyebrow mb-3">Assign Technician</h2>
        <AssignTechnicianControl
          workOrderId={id}
          currentTechId={wo.assigned_technician_id as string | null}
          technicians={technicians}
        />
      </section>

      <section className="lux-card p-4 mb-4">
        <h2 className="eyebrow mb-3">Details</h2>
        <div className="grid grid-cols-2 gap-y-1 text-sm">
          <span className="text-[#9aa5bd]">Type</span>
          <span className="capitalize">{wo.type as string}</span>
          <span className="text-[#9aa5bd]">Priority</span>
          <span className="capitalize">{wo.priority as string}</span>
          <span className="text-[#9aa5bd]">Property</span>
          <span>{property?.name ?? "—"}</span>
          <span className="text-[#9aa5bd]">Unit</span>
          <span>{unit?.label ?? "—"}</span>
          <span className="text-[#9aa5bd]">Created by</span>
          <span>{creator?.full_name ?? "—"}</span>
          <span className="text-[#9aa5bd]">Technician</span>
          <span>{tech?.full_name ?? "Unassigned"}</span>
          <span className="text-[#9aa5bd]">Estimated cost</span>
          <span>{wo.estimated_cost ? `AED ${wo.estimated_cost}` : "—"}</span>
          <span className="text-[#9aa5bd]">Actual cost</span>
          <span>{wo.actual_cost ? `AED ${wo.actual_cost}` : "—"}</span>
          <span className="text-[#9aa5bd]">Started</span>
          <span>{wo.started_at ? new Date(wo.started_at as string).toLocaleString() : "—"}</span>
          <span className="text-[#9aa5bd]">Completed</span>
          <span>{wo.completed_at ? new Date(wo.completed_at as string).toLocaleString() : "—"}</span>
          <span className="text-[#9aa5bd]">Hours worked</span>
          <span>{wo.hours_worked ? `${Number(wo.hours_worked).toFixed(1)}h` : "—"}</span>
          <span className="text-[#9aa5bd]">Created</span>
          <span>{new Date(wo.created_at as string).toLocaleString()}</span>
          {wo.visit_source === "resident_booking" && (
            <>
              <span className="text-[#9aa5bd]">Source</span>
              <span className="text-[#8fb4e0] font-medium">Resident Visit Request</span>
              <span className="text-[#9aa5bd]">Preferred date</span>
              <span>{wo.preferred_visit_date ? new Date(wo.preferred_visit_date as string).toLocaleDateString() : "—"}</span>
              <span className="text-[#9aa5bd]">Preferred time</span>
              <span className="capitalize">{(wo.preferred_visit_time as string) ?? "—"}</span>
            </>
          )}
        </div>
      </section>

      {linkedComplaint && (
        <section className="lux-card p-4 mb-4">
          <h2 className="eyebrow mb-3">Originating Complaint</h2>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium capitalize">
                {linkedComplaint.category?.replace(/_/g, " ")}
                {linkedComplaint.sub_issue && ` — ${linkedComplaint.sub_issue.replace(/_/g, " ")}`}
              </p>
              <p className="text-[10px] text-[#5d6880]">
                Reported: {new Date(linkedComplaint.created_at).toLocaleDateString()} · Status: {linkedComplaint.status}
              </p>
            </div>
            <Link
              href={`/complaints/${linkedComplaint.id}`}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#213052] text-[#d9647f] hover:bg-[rgba(176,27,66,0.15)]"
            >
              View Complaint
            </Link>
          </div>
        </section>
      )}

      {asset && (
        <section className="lux-card p-4 mb-4">
          <h2 className="eyebrow mb-3">Linked Asset</h2>
          <div className="grid grid-cols-2 gap-y-1 text-sm">
            <span className="text-[#9aa5bd]">Name</span>
            <span>{asset.name}</span>
            <span className="text-[#9aa5bd]">Category</span>
            <span className="capitalize">{asset.category}</span>
            <span className="text-[#9aa5bd]">Status</span>
            <span className="capitalize">{asset.status.replace(/_/g, " ")}</span>
            <span className="text-[#9aa5bd]">Condition</span>
            <span className="capitalize">{asset.condition}</span>
          </div>
        </section>
      )}

      <section className="lux-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="eyebrow">
            Parts Requests ({partsRequests.length})
          </h2>
          {propertyId && !["closed", "cancelled"].includes(wo.status as string) && (
            <RequestParts
              workOrderId={id}
              propertyId={propertyId}
              items={inventoryItems}
              propertyName={property?.name ?? ""}
              unitLabel={unit?.label ?? ""}
            />
          )}
        </div>
        {partsRequests.length === 0 ? (
          <p className="text-sm text-[#5d6880]">No parts requested for this work order.</p>
        ) : (
          <div className="space-y-2">
            {partsRequests.map((pr) => {
              const item = pr.inventory_item as { name: string; sku: string | null; unit_of_measure: string | null } | null;
              const requester = pr.requester as { full_name: string } | null;
              const statusStyle: Record<string, string> = {
                requested: "bg-amber-900 text-amber-300",
                approved: "bg-[rgba(176,27,66,0.12)] text-[#d9647f]",
                picking: "bg-[rgba(176,27,66,0.12)] text-[#d9647f]",
                delivering: "bg-amber-900 text-amber-300",
                delivered: "bg-green-900 text-green-300",
                collected: "bg-green-900 text-green-300",
                rejected: "bg-red-900 text-red-300",
              };
              return (
                <div key={pr.id} className="bg-[#0f1626] rounded-lg px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {item?.name ?? "Item"}
                      {item?.sku && <span className="text-[#5d6880] ml-1">({item.sku})</span>}
                      <span className="text-[#d9647f] ml-2">
                        x{pr.quantity} {item?.unit_of_measure ?? ""}
                      </span>
                    </p>
                    <p className="text-[10px] text-[#5d6880]">
                      {requester?.full_name ?? "—"} · {pr.delivery_method} · {new Date(pr.created_at).toLocaleDateString()}
                      {pr.notes && ` · ${pr.notes}`}
                    </p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusStyle[pr.status] ?? ""}`}>
                    {pr.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="lux-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="eyebrow">
            Purchase Orders ({purchaseOrders.length})
          </h2>
          {propertyId && !["closed", "cancelled"].includes(wo.status as string) && (
            <CreateWorkOrderPO
              workOrderId={id}
              propertyId={propertyId}
              workOrderTitle={wo.title as string}
              vendors={vendors}
            />
          )}
        </div>
        {purchaseOrders.length === 0 ? (
          <p className="text-sm text-[#5d6880]">No purchase orders linked to this work order.</p>
        ) : (
          <div className="space-y-2">
            {purchaseOrders.map((po) => {
              const vendor = po.vendor as { name: string } | null;
              const poStatusStyle: Record<string, string> = {
                pending: "bg-amber-900 text-amber-300",
                approved: "bg-green-900 text-green-300",
                rejected: "bg-red-900 text-red-300",
                escalated: "bg-[rgba(176,27,66,0.12)] text-[#d9647f]",
                fulfilled: "bg-[#213052] text-[#9aa5bd]",
              };
              return (
                <Link
                  key={po.id}
                  href={`/purchasing/${po.id}`}
                  className="block bg-[#0f1626] rounded-lg px-3 py-2 hover:bg-[#213052]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {po.description ?? "Purchase Order"}
                        <span className="text-[#d9647f] ml-2 font-bold">
                          AED {Number(po.amount).toLocaleString()}
                        </span>
                      </p>
                      <p className="text-[10px] text-[#5d6880]">
                        {vendor?.name ?? "No vendor"} · {new Date(po.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${poStatusStyle[po.status] ?? ""}`}>
                      {po.status}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {(photos.before.length > 0 || photos.after.length > 0) && (
        <section className="lux-card p-4 mb-4">
          <h2 className="eyebrow mb-3">Technician Photos</h2>
          {photos.before.length > 0 && (
            <>
              <p className="text-sm text-[#9aa5bd] mb-2">Before</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {photos.before.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Before ${i + 1}`}
                      className="aspect-square w-full object-cover rounded-lg border border-[rgba(176,27,66,0.15)]"
                    />
                  </a>
                ))}
              </div>
            </>
          )}
          {photos.after.length > 0 && (
            <>
              <p className="text-sm text-[#9aa5bd] mb-2">After</p>
              <div className="grid grid-cols-4 gap-2">
                {photos.after.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`After ${i + 1}`}
                      className="aspect-square w-full object-cover rounded-lg border border-[rgba(176,27,66,0.15)]"
                    />
                  </a>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {checkins.length > 0 && (
        <section className="lux-card p-4 mb-4">
          <h2 className="eyebrow mb-3">GPS Check-ins</h2>
          <div className="space-y-2 text-sm">
            {checkins.map((c, i) => (
              <div key={i} className="flex justify-between">
                <span className="capitalize">
                  {(c.type as string).replace("_", " ")}
                </span>
                <span className="text-[#9aa5bd]">
                  {(c.latitude as number).toFixed(5)}, {(c.longitude as number).toFixed(5)}
                  {c.accuracy_meters ? ` (±${Math.round(c.accuracy_meters as number)}m)` : ""}
                </span>
                <span className="text-[#5d6880]">
                  {new Date(c.timestamp as string).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
