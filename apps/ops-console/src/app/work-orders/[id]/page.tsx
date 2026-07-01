import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import AssignTechnicianControl from "./AssignTechnicianControl";
import WorkOrderStatusControl from "./WorkOrderStatusControl";

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

  if (!wo) {
    return (
      <main className="p-8">
        <p className="text-[#6b6454]">Work order not found.</p>
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
      <Link href="/work-orders" className="text-sm text-[#a0977e] hover:text-[#b8902f]">
        ← Work Orders
      </Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-1">{wo.title}</h1>
      <p className="text-[#a0977e] mb-6">{wo.description}</p>

      <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 mb-4">
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">Status</h2>
        <WorkOrderStatusControl id={id} currentStatus={wo.status as string} />
      </section>

      <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 mb-4">
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">Assign Technician</h2>
        <AssignTechnicianControl
          workOrderId={id}
          currentTechId={wo.assigned_technician_id as string | null}
          technicians={technicians}
        />
      </section>

      <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 mb-4">
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">Details</h2>
        <div className="grid grid-cols-2 gap-y-1 text-sm">
          <span className="text-[#a0977e]">Type</span>
          <span className="capitalize">{wo.type as string}</span>
          <span className="text-[#a0977e]">Priority</span>
          <span className="capitalize">{wo.priority as string}</span>
          <span className="text-[#a0977e]">Property</span>
          <span>{property?.name ?? "—"}</span>
          <span className="text-[#a0977e]">Unit</span>
          <span>{unit?.label ?? "—"}</span>
          <span className="text-[#a0977e]">Created by</span>
          <span>{creator?.full_name ?? "—"}</span>
          <span className="text-[#a0977e]">Technician</span>
          <span>{tech?.full_name ?? "Unassigned"}</span>
          <span className="text-[#a0977e]">Estimated cost</span>
          <span>{wo.estimated_cost ? `AED ${wo.estimated_cost}` : "—"}</span>
          <span className="text-[#a0977e]">Actual cost</span>
          <span>{wo.actual_cost ? `AED ${wo.actual_cost}` : "—"}</span>
          <span className="text-[#a0977e]">Created</span>
          <span>{new Date(wo.created_at as string).toLocaleString()}</span>
        </div>
      </section>

      {asset && (
        <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 mb-4">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">Linked Asset</h2>
          <div className="grid grid-cols-2 gap-y-1 text-sm">
            <span className="text-[#a0977e]">Name</span>
            <span>{asset.name}</span>
            <span className="text-[#a0977e]">Category</span>
            <span className="capitalize">{asset.category}</span>
            <span className="text-[#a0977e]">Status</span>
            <span className="capitalize">{asset.status.replace(/_/g, " ")}</span>
            <span className="text-[#a0977e]">Condition</span>
            <span className="capitalize">{asset.condition}</span>
          </div>
        </section>
      )}

      {(photos.before.length > 0 || photos.after.length > 0) && (
        <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 mb-4">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">Technician Photos</h2>
          {photos.before.length > 0 && (
            <>
              <p className="text-sm text-[#a0977e] mb-2">Before</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {photos.before.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Before ${i + 1}`}
                      className="aspect-square w-full object-cover rounded-lg border border-[rgba(184,144,47,0.15)]"
                    />
                  </a>
                ))}
              </div>
            </>
          )}
          {photos.after.length > 0 && (
            <>
              <p className="text-sm text-[#a0977e] mb-2">After</p>
              <div className="grid grid-cols-4 gap-2">
                {photos.after.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`After ${i + 1}`}
                      className="aspect-square w-full object-cover rounded-lg border border-[rgba(184,144,47,0.15)]"
                    />
                  </a>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {checkins.length > 0 && (
        <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 mb-4">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">GPS Check-ins</h2>
          <div className="space-y-2 text-sm">
            {checkins.map((c, i) => (
              <div key={i} className="flex justify-between">
                <span className="capitalize">
                  {(c.type as string).replace("_", " ")}
                </span>
                <span className="text-[#a0977e]">
                  {(c.latitude as number).toFixed(5)}, {(c.longitude as number).toFixed(5)}
                  {c.accuracy_meters ? ` (±${Math.round(c.accuracy_meters as number)}m)` : ""}
                </span>
                <span className="text-[#6b6454]">
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
