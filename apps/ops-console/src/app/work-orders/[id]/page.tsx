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
      "*, properties(name), units(label), assets(id, name, category, status, condition, system_type, warranty_expiry, warranty_provider), technician:user_profiles!work_orders_assigned_technician_id_fkey(full_name, hourly_rate), creator:user_profiles!work_orders_created_by_fkey(full_name)"
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

type PhotoEvent = { stage: string; url: string; takenAt: string };

async function getPhotos(workOrderId: string): Promise<PhotoEvent[]> {
  const supabase = await createClient();
  const { data: photoRows } = await supabase
    .from("work_order_photos")
    .select("stage, storage_path, taken_at")
    .eq("work_order_id", workOrderId)
    .order("taken_at", { ascending: true });

  const paths = (photoRows ?? []).map((p) => p.storage_path as string);
  if (paths.length === 0) return [];

  const { data: signed } = await supabase.storage
    .from("work-order-photos")
    .createSignedUrls(paths, 3600);

  const urlMap = new Map<string, string>();
  (signed ?? []).forEach((s) => {
    if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
  });

  return (photoRows ?? [])
    .map((p) => ({
      stage: p.stage as string,
      url: urlMap.get(p.storage_path as string) ?? "",
      takenAt: p.taken_at as string,
    }))
    .filter((p) => p.url);
}

type PartsRequestRow = {
  id: string;
  quantity: number;
  status: string;
  delivery_method: string;
  notes: string | null;
  created_at: string;
  fulfilled_at: string | null;
  total_cost: number | null;
  inventory_item: { name: string; sku: string | null; unit_of_measure: string | null } | null;
  requester: { full_name: string } | null;
};

async function getPartsRequests(workOrderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("parts_requests")
    .select(
      `id, quantity, status, delivery_method, notes, created_at, fulfilled_at, total_cost,
       inventory_item:inventory_items(name, sku, unit_of_measure),
       requester:user_profiles!parts_requests_requested_by_fkey(full_name)`
    )
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: true });
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
    .order("created_at", { ascending: true });
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
    .select("id, case_number, category, sub_issue, status, created_at, resident:user_profiles!complaints_resident_id_fkey(id, full_name)")
    .eq("work_order_id", workOrderId)
    .limit(1)
    .maybeSingle();
  return data as unknown as {
    id: string;
    case_number: string | null;
    category: string;
    sub_issue: string | null;
    status: string;
    created_at: string;
    resident: { id: string; full_name: string } | null;
  } | null;
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

async function getRatings(workOrderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("work_order_ratings")
    .select("rating_type, score, comment, created_at")
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: true });
  return (data ?? []) as { rating_type: string; score: number; comment: string | null; created_at: string }[];
}

async function getHistoryCounts(unitId: string | null, assetId: string | null, excludeId: string) {
  const supabase = await createClient();
  const [unitRes, assetRes] = await Promise.all([
    unitId
      ? supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("unit_id", unitId)
      : Promise.resolve({ count: null }),
    assetId
      ? supabase.from("work_orders").select("id, actual_cost").eq("asset_id", assetId).neq("id", excludeId)
      : Promise.resolve({ data: null }),
  ]);
  const assetRows = ("data" in assetRes ? assetRes.data : null) as { id: string; actual_cost: number | null }[] | null;
  return {
    unitCaseCount: ("count" in unitRes ? unitRes.count : null) ?? 0,
    assetRepairCount: assetRows?.length ?? 0,
    assetLifetimeCost: (assetRows ?? []).reduce((s, r) => s + Number(r.actual_cost ?? 0), 0),
  };
}

async function getActiveAMC(propertyId: string | null, systemType: string | null) {
  if (!propertyId) return [];
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("contracts")
    .select("id, title, end_date, covered_system, vendor:vendors(name)")
    .eq("property_id", propertyId)
    .gte("end_date", today)
    .order("end_date", { ascending: true });
  const rows = (data ?? []) as unknown as {
    id: string; title: string; end_date: string | null; covered_system: string | null; vendor: { name: string } | null;
  }[];
  // Keep AMCs covering this asset's system, or general/unspecified ones.
  return rows.filter((c) => !c.covered_system || c.covered_system === "general" || (systemType && c.covered_system === systemType));
}

type ThreadEvent = {
  at: string;
  who: string;
  title: string;
  detail?: string;
  photos?: PhotoEvent[];
  done: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[#e9eef6] text-[#5b6b85]",
  pending_approval: "bg-amber-50 text-amber-700",
  approved: "bg-blue-50 text-blue-700",
  assigned: "bg-[rgba(176,27,66,0.1)] text-[#b01b42]",
  in_progress: "bg-amber-50 text-amber-700",
  paused: "bg-[#e9eef6] text-[#5b6b85]",
  completed_by_technician: "bg-green-50 text-green-700",
  verified_by_supervisor: "bg-green-50 text-green-700",
  confirmed_by_resident: "bg-green-50 text-green-700",
  closed: "bg-[#e9eef6] text-[#5b6b85]",
  cancelled: "bg-red-50 text-red-600",
};

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [wo, technicians, photoEvents, checkins, ratings] = await Promise.all([
    getWorkOrder(id),
    getTechnicians(),
    getPhotos(id),
    getCheckins(id),
    getRatings(id),
  ]);

  if (!wo) {
    return (
      <main className="p-8">
        <p className="text-[#8b97ab]">Case not found.</p>
      </main>
    );
  }

  const propertyId = wo.property_id as string | null;
  const assetCoverage = wo.assets as unknown as { system_type: string | null; warranty_expiry: string | null; warranty_provider: string | null } | null;
  const [partsRequests, inventoryItems, purchaseOrders, vendors, linkedComplaint, history, amc] =
    await Promise.all([
      getPartsRequests(id),
      propertyId ? getInventoryItems(propertyId) : Promise.resolve([]),
      getWorkOrderPOs(id),
      getVendors(),
      getLinkedComplaint(id),
      getHistoryCounts(wo.unit_id as string | null, wo.asset_id as string | null, id),
      getActiveAMC(propertyId, assetCoverage?.system_type ?? null),
    ]);

  // AMC / warranty guard — is this repair likely already covered?
  const warrantyExpiry = assetCoverage?.warranty_expiry ?? null;
  const warrantyDays = warrantyExpiry ? Math.ceil((new Date(warrantyExpiry).getTime() - Date.now()) / 86400000) : null;
  const underWarranty = warrantyDays !== null && warrantyDays >= 0;
  const hasCoverage = underWarranty || amc.length > 0;

  const property = wo.properties as unknown as { name: string } | null;
  const unit = wo.units as unknown as { label: string } | null;
  const asset = wo.assets as unknown as { id: string; name: string; category: string; status: string; condition: string } | null;
  const tech = wo.technician as unknown as { full_name: string; hourly_rate: number | null } | null;
  const creator = wo.creator as unknown as { full_name: string } | null;
  const status = wo.status as string;

  // ── Compose the thread from every linked record ─────────────────────────
  const events: ThreadEvent[] = [];

  if (linkedComplaint) {
    events.push({
      at: linkedComplaint.created_at,
      who: linkedComplaint.resident?.full_name ?? "Resident",
      title: "Reported",
      detail: `${linkedComplaint.category?.replace(/_/g, " ")}${linkedComplaint.sub_issue ? ` — ${linkedComplaint.sub_issue.replace(/_/g, " ")}` : ""}`,
      done: true,
    });
  }

  events.push({
    at: wo.created_at as string,
    who: creator?.full_name ?? "Staff",
    title: linkedComplaint ? "Triaged — work order opened" : "Case opened",
    detail: `${wo.type} · ${wo.priority} priority${tech ? ` · assigned to ${tech.full_name}` : ""}`,
    done: true,
  });

  checkins.forEach((c) => {
    events.push({
      at: c.timestamp as string,
      who: tech?.full_name ?? "Technician",
      title: (c.type as string) === "check_in" ? "Checked in on site" : "Checked out",
      detail: `GPS ${(c.latitude as number).toFixed(5)}, ${(c.longitude as number).toFixed(5)}${c.accuracy_meters ? ` (±${Math.round(c.accuracy_meters as number)}m)` : ""}`,
      done: true,
    });
  });

  const beforePhotos = photoEvents.filter((p) => p.stage === "before");
  const afterPhotos = photoEvents.filter((p) => p.stage === "after");
  if (beforePhotos.length > 0) {
    events.push({
      at: beforePhotos[0].takenAt,
      who: tech?.full_name ?? "Technician",
      title: `Before photos (${beforePhotos.length})`,
      photos: beforePhotos,
      done: true,
    });
  }

  partsRequests.forEach((pr) => {
    const item = pr.inventory_item;
    events.push({
      at: pr.created_at,
      who: pr.requester?.full_name ?? "Technician",
      title: `Parts requested: ${item?.name ?? "item"} ×${pr.quantity}`,
      detail: `${pr.status}${pr.total_cost ? ` · AED ${Number(pr.total_cost).toLocaleString()}` : ""}${pr.fulfilled_at ? ` · fulfilled ${new Date(pr.fulfilled_at).toLocaleString()}` : ""}`,
      done: ["delivered", "collected"].includes(pr.status),
    });
  });

  purchaseOrders.forEach((po) => {
    events.push({
      at: po.created_at,
      who: po.vendor?.name ?? "External",
      title: `Purchase order — AED ${Number(po.amount).toLocaleString()}`,
      detail: `${po.description ?? ""} · ${po.status}`,
      done: ["approved", "fulfilled"].includes(po.status),
    });
  });

  if (afterPhotos.length > 0) {
    events.push({
      at: afterPhotos[0].takenAt,
      who: tech?.full_name ?? "Technician",
      title: `After photos (${afterPhotos.length})`,
      photos: afterPhotos,
      done: true,
    });
  }

  if (wo.completed_at) {
    events.push({
      at: wo.completed_at as string,
      who: tech?.full_name ?? "Technician",
      title: "Completed by technician",
      detail: wo.hours_worked ? `${Number(wo.hours_worked).toFixed(1)} hours on site` : undefined,
      done: true,
    });
  }

  ratings.forEach((r) => {
    events.push({
      at: r.created_at,
      who: r.rating_type === "resident_satisfaction" ? "Resident" : "Supervisor",
      title: `${r.rating_type === "resident_satisfaction" ? "Resident rating" : "Supervisor quality"}: ${"★".repeat(r.score)}${"☆".repeat(5 - r.score)}`,
      detail: r.comment ?? undefined,
      done: true,
    });
  });

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // Pending next steps derived from status
  const pending: string[] = [];
  if (["draft", "pending_approval", "approved"].includes(status)) pending.push("Assign a technician");
  if (["assigned"].includes(status)) pending.push("Technician check-in on site");
  if (["in_progress", "paused"].includes(status)) pending.push("Completion by technician");
  if (status === "completed_by_technician") pending.push("Supervisor verification");
  if (status === "verified_by_supervisor") pending.push("Resident confirmation");

  // ── Live cost ────────────────────────────────────────────────────────────
  const partsCost = partsRequests.reduce((s, p) => s + Number(p.total_cost ?? 0), 0);
  const laborCost = wo.hours_worked && tech?.hourly_rate ? Number(wo.hours_worked) * Number(tech.hourly_rate) : 0;
  const externalCost = purchaseOrders
    .filter((p) => ["approved", "fulfilled"].includes(p.status))
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalCost = partsCost + laborCost + externalCost;

  const active = !["closed", "cancelled"].includes(status);

  return (
    <main className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <Link href="/work-orders" className="text-sm text-[#5b6b85] hover:text-[#b01b42]">
            ← All Cases
          </Link>
          <p className="eyebrow mt-2">{(wo.case_number as string) ?? "Case"}</p>
          <h1 className="mt-0.5">{wo.title}</h1>
          <p className="text-[#5b6b85] mt-1">
            {property?.name ?? "—"}{unit ? ` · ${unit.label}` : ""} · reported {new Date((linkedComplaint?.created_at ?? wo.created_at) as string).toLocaleDateString()}
          </p>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full capitalize ${STATUS_COLORS[status] ?? ""}`}>
          {status.replace(/_/g, " ")}
        </span>
      </div>

      {/* AMC / warranty guard — flag likely coverage before any spend */}
      {hasCoverage && (
        <div className="lux-card p-4 mb-6 border-l-4 border-l-amber-500 bg-amber-50/40">
          <div className="flex items-start gap-3">
            <span className="text-xl">🛡️</span>
            <div className="text-sm">
              <p className="font-bold text-amber-800">This equipment may be covered — confirm before charging.</p>
              {underWarranty && (
                <p className="text-[#5b6b85] mt-1">
                  Under <b>manufacturer warranty</b> until {new Date(warrantyExpiry as string).toLocaleDateString()} ({warrantyDays} days)
                  {assetCoverage?.warranty_provider ? ` · ${assetCoverage.warranty_provider}` : ""}.
                </p>
              )}
              {amc.map((c) => (
                <p key={c.id} className="text-[#5b6b85] mt-1">
                  Active <b>AMC</b>: {c.title}{c.vendor?.name ? ` · ${c.vendor.name}` : ""}
                  {c.end_date ? ` until ${new Date(c.end_date).toLocaleDateString()}` : ""}
                  {c.covered_system && c.covered_system !== "general" ? ` (${c.covered_system})` : ""}.
                </p>
              ))}
              <p className="text-xs text-amber-700 mt-1.5">Raise the repair against the provider/AMC — don&apos;t charge parts or a PO to the building without checking coverage.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        {/* ── The thread ── */}
        <section className="lux-card p-6">
          <h2 className="eyebrow mb-5">Case Thread</h2>

          {wo.description && (
            <p className="text-sm text-[#5b6b85] bg-[#f4f6fa] rounded-lg p-3 mb-5">{wo.description}</p>
          )}

          <ol className="relative">
            {events.map((e, i) => (
              <li key={i} className="flex gap-4 pb-6 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className={`w-3 h-3 rounded-full mt-1 shrink-0 ${e.done ? "bg-green-600" : "bg-[#b01b42]"}`} />
                  {(i < events.length - 1 || pending.length > 0) && (
                    <span className="w-px flex-1 bg-[#e4e9f2] mt-1" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <p className="text-sm font-bold">{e.title}</p>
                    <p className="text-[11px] text-[#8b97ab] shrink-0">{new Date(e.at).toLocaleString()}</p>
                  </div>
                  <p className="text-xs text-[#b01b42] font-semibold">{e.who}</p>
                  {e.detail && <p className="text-xs text-[#5b6b85] mt-0.5 capitalize">{e.detail}</p>}
                  {e.photos && (
                    <div className="grid grid-cols-4 gap-2 mt-2 max-w-sm">
                      {e.photos.map((p, j) => (
                        <a key={j} href={p.url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt={`${p.stage} ${j + 1}`} className="aspect-square w-full object-cover rounded-lg border border-[#e4e9f2]" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}

            {pending.map((p, i) => (
              <li key={`p-${i}`} className="flex gap-4 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className="w-3 h-3 rounded-full mt-1 shrink-0 border-2 border-[#c9d3e2] bg-white" />
                  {i < pending.length - 1 && <span className="w-px flex-1 bg-[#e4e9f2] mt-1" />}
                </div>
                <p className="text-sm text-[#8b97ab] pt-0.5">{p}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Right rail ── */}
        <div className="space-y-4">
          {/* Live cost */}
          <section className="lux-card p-5">
            <h2 className="eyebrow mb-3">Live Cost</h2>
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#5b6b85]">Parts ({partsRequests.length})</span>
                <span>{partsCost > 0 ? `AED ${partsCost.toLocaleString()}` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5b6b85]">
                  Labor{wo.hours_worked ? ` ${Number(wo.hours_worked).toFixed(1)}h` : ""}
                </span>
                <span>{laborCost > 0 ? `AED ${laborCost.toLocaleString()}` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5b6b85]">External</span>
                <span>{externalCost > 0 ? `AED ${externalCost.toLocaleString()}` : "—"}</span>
              </div>
              <div className="flex justify-between border-t-2 border-[#16233c] pt-2 mt-2 font-extrabold">
                <span>Total</span>
                <span>AED {totalCost.toLocaleString()}</span>
              </div>
            </div>
          </section>

          {/* Connected */}
          <section className="lux-card p-5">
            <h2 className="eyebrow mb-3">Connected</h2>
            <div className="flex flex-wrap gap-1.5">
              {wo.unit_id != null && (
                <Link
                  href={`/work-orders?unit=${wo.unit_id}`}
                  className="text-xs font-bold px-3 py-1.5 rounded-full border border-[#e4e9f2] text-[#b01b42] hover:border-[#b01b42]"
                >
                  🏠 {unit?.label ?? "Unit"} history ({history.unitCaseCount} cases)
                </Link>
              )}
              {linkedComplaint?.resident && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full border border-[#e4e9f2] text-[#3c4b66]">
                  👤 {linkedComplaint.resident.full_name}
                </span>
              )}
              {asset && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full border border-[#e4e9f2] text-[#3c4b66]">
                  ⚙️ {asset.name} — repaired {history.assetRepairCount}×
                  {history.assetLifetimeCost > 0 ? ` · AED ${history.assetLifetimeCost.toLocaleString()} lifetime` : ""}
                </span>
              )}
              {linkedComplaint && (
                <Link
                  href={`/complaints/${linkedComplaint.id}`}
                  className="text-xs font-bold px-3 py-1.5 rounded-full border border-[#e4e9f2] text-[#b01b42] hover:border-[#b01b42]"
                >
                  📣 Original complaint
                </Link>
              )}
              {purchaseOrders.map((po) => (
                <Link
                  key={po.id}
                  href={`/purchasing/${po.id}`}
                  className="text-xs font-bold px-3 py-1.5 rounded-full border border-[#e4e9f2] text-[#b01b42] hover:border-[#b01b42]"
                >
                  🧾 PO · AED {Number(po.amount).toLocaleString()} ({po.status})
                </Link>
              ))}
              {purchaseOrders.length === 0 && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full border border-[#e4e9f2] text-[#8b97ab]">
                  🧾 No external cost (internal job)
                </span>
              )}
            </div>
            {asset && history.assetRepairCount >= 3 && (
              <p className="mt-3 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2.5">
                ⚠ This {asset.category || "asset"} has been repaired {history.assetRepairCount} times — consider
                replacement instead of repair.
              </p>
            )}
          </section>

          {/* Actions */}
          <section className="lux-card p-5">
            <h2 className="eyebrow mb-3">Status</h2>
            <WorkOrderStatusControl id={id} currentStatus={status} startedAt={(wo.started_at as string | null) ?? null} />
          </section>

          <section className="lux-card p-5">
            <h2 className="eyebrow mb-3">Technician</h2>
            <AssignTechnicianControl
              workOrderId={id}
              currentTechId={wo.assigned_technician_id as string | null}
              technicians={technicians}
            />
          </section>

          {propertyId && active && (
            <section className="lux-card p-5">
              <h2 className="eyebrow mb-3">Add to this case</h2>
              <div className="flex flex-wrap gap-2">
                <RequestParts
                  workOrderId={id}
                  propertyId={propertyId}
                  items={inventoryItems}
                  propertyName={property?.name ?? ""}
                  unitLabel={unit?.label ?? ""}
                />
                <CreateWorkOrderPO
                  workOrderId={id}
                  propertyId={propertyId}
                  workOrderTitle={wo.title as string}
                  vendors={vendors}
                />
              </div>
            </section>
          )}

          {/* Details */}
          <section className="lux-card p-5">
            <h2 className="eyebrow mb-3">Details</h2>
            <div className="grid grid-cols-2 gap-y-1.5 text-sm">
              <span className="text-[#5b6b85]">Type</span>
              <span className="capitalize">{wo.type as string}</span>
              <span className="text-[#5b6b85]">Priority</span>
              <span className="capitalize">{wo.priority as string}</span>
              <span className="text-[#5b6b85]">Created by</span>
              <span>{creator?.full_name ?? "—"}</span>
              <span className="text-[#5b6b85]">Technician</span>
              <span>{tech?.full_name ?? "Unassigned"}</span>
              {wo.visit_source === "resident_booking" && (
                <>
                  <span className="text-[#5b6b85]">Source</span>
                  <span className="text-[#3d6cb3] font-medium">Resident visit request</span>
                  <span className="text-[#5b6b85]">Preferred</span>
                  <span>
                    {wo.preferred_visit_date ? new Date(wo.preferred_visit_date as string).toLocaleDateString() : "—"}
                    {wo.preferred_visit_time ? ` · ${wo.preferred_visit_time}` : ""}
                  </span>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
