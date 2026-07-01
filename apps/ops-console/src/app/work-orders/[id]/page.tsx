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
        <p className="text-gray-500">Work order not found.</p>
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
      <Link href="/work-orders" className="text-sm text-gray-400 hover:text-white">
        ← Work Orders
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">{wo.title}</h1>
      <p className="text-gray-400 mb-6">{wo.description}</p>

      <section className="border border-gray-700 rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-3">Status</h2>
        <WorkOrderStatusControl id={id} currentStatus={wo.status as string} />
      </section>

      <section className="border border-gray-700 rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-3">Assign Technician</h2>
        <AssignTechnicianControl
          workOrderId={id}
          currentTechId={wo.assigned_technician_id as string | null}
          technicians={technicians}
        />
      </section>

      <section className="border border-gray-700 rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Details</h2>
        <div className="grid grid-cols-2 gap-y-1 text-sm">
          <span className="text-gray-500">Type</span>
          <span className="capitalize">{wo.type as string}</span>
          <span className="text-gray-500">Priority</span>
          <span className="capitalize">{wo.priority as string}</span>
          <span className="text-gray-500">Property</span>
          <span>{property?.name ?? "—"}</span>
          <span className="text-gray-500">Unit</span>
          <span>{unit?.label ?? "—"}</span>
          <span className="text-gray-500">Created by</span>
          <span>{creator?.full_name ?? "—"}</span>
          <span className="text-gray-500">Technician</span>
          <span>{tech?.full_name ?? "Unassigned"}</span>
          <span className="text-gray-500">Estimated cost</span>
          <span>{wo.estimated_cost ? `AED ${wo.estimated_cost}` : "—"}</span>
          <span className="text-gray-500">Actual cost</span>
          <span>{wo.actual_cost ? `AED ${wo.actual_cost}` : "—"}</span>
          <span className="text-gray-500">Created</span>
          <span>{new Date(wo.created_at as string).toLocaleString()}</span>
        </div>
      </section>

      {asset && (
        <section className="border border-gray-700 rounded-lg p-4 mb-4">
          <h2 className="font-semibold mb-2">Linked Asset</h2>
          <div className="grid grid-cols-2 gap-y-1 text-sm">
            <span className="text-gray-500">Name</span>
            <span>{asset.name}</span>
            <span className="text-gray-500">Category</span>
            <span className="capitalize">{asset.category}</span>
            <span className="text-gray-500">Status</span>
            <span className="capitalize">{asset.status.replace(/_/g, " ")}</span>
            <span className="text-gray-500">Condition</span>
            <span className="capitalize">{asset.condition}</span>
          </div>
        </section>
      )}

      {(photos.before.length > 0 || photos.after.length > 0) && (
        <section className="border border-gray-700 rounded-lg p-4 mb-4">
          <h2 className="font-semibold mb-3">Technician Photos</h2>
          {photos.before.length > 0 && (
            <>
              <p className="text-sm text-gray-400 mb-2">Before</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {photos.before.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Before ${i + 1}`}
                      className="aspect-square w-full object-cover rounded-lg border border-gray-700"
                    />
                  </a>
                ))}
              </div>
            </>
          )}
          {photos.after.length > 0 && (
            <>
              <p className="text-sm text-gray-400 mb-2">After</p>
              <div className="grid grid-cols-4 gap-2">
                {photos.after.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`After ${i + 1}`}
                      className="aspect-square w-full object-cover rounded-lg border border-gray-700"
                    />
                  </a>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {checkins.length > 0 && (
        <section className="border border-gray-700 rounded-lg p-4 mb-4">
          <h2 className="font-semibold mb-2">GPS Check-ins</h2>
          <div className="space-y-2 text-sm">
            {checkins.map((c, i) => (
              <div key={i} className="flex justify-between">
                <span className="capitalize">
                  {(c.type as string).replace("_", " ")}
                </span>
                <span className="text-gray-400">
                  {(c.latitude as number).toFixed(5)}, {(c.longitude as number).toFixed(5)}
                  {c.accuracy_meters ? ` (±${Math.round(c.accuracy_meters as number)}m)` : ""}
                </span>
                <span className="text-gray-500">
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
