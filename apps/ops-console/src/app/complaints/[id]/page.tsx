import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type ComplaintContext } from "@gspop/shared";
import ComplaintStatusControl from "./ComplaintStatusControl";
import ConvertToWorkOrder from "./ConvertToWorkOrder";

async function getComplaintContext(id: string): Promise<ComplaintContext | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("complaint_context")
    .select("*")
    .eq("complaint_id", id)
    .single();
  return data ? camelCaseKeys<ComplaintContext>(data) : null;
}

async function getComplaintExtras(id: string) {
  const supabase = await createClient();
  const { data: complaint } = await supabase
    .from("complaints")
    .select("status, property_id, unit_id, tenant_id, work_order_id")
    .eq("id", id)
    .single();

  const { data: photoRows } = await supabase
    .from("complaint_photos")
    .select("storage_path")
    .eq("complaint_id", id)
    .order("uploaded_at", { ascending: true });

  const paths = (photoRows ?? []).map((p) => p.storage_path as string);
  let photoUrls: string[] = [];
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("complaint-photos").createSignedUrls(paths, 3600);
    photoUrls = (signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[];
  }

  const { data: technicians } = await supabase
    .from("user_profiles")
    .select("id, full_name, trade")
    .eq("role", "technician");

  const c = complaint as { status: string; property_id: string; unit_id: string | null; tenant_id: string; work_order_id: string | null } | null;
  return {
    status: c?.status ?? "submitted",
    propertyId: c?.property_id ?? "",
    unitId: c?.unit_id ?? null,
    tenantId: c?.tenant_id ?? "",
    workOrderId: c?.work_order_id ?? null,
    photoUrls,
    technicians: (technicians ?? []) as { id: string; full_name: string; trade: string | null }[],
  };
}

export default async function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getComplaintContext(id);

  if (!context) {
    return (
      <main className="p-8">
        <p className="text-[#8b97ab]">Complaint not found.</p>
      </main>
    );
  }

  const { status, propertyId, unitId, tenantId, workOrderId, photoUrls, technicians } =
    await getComplaintExtras(id);

  return (
    <main className="p-8 max-w-2xl">
      <Link href="/complaints" className="text-sm text-[#5b6b85] hover:text-[#b01b42]">← Complaints</Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-2">{context.title}</h1>
      <p className="text-[#5b6b85] mb-6">{context.description}</p>

      <section className="lux-card p-4 mb-4">
        <h2 className="eyebrow mb-3">Status</h2>
        <ComplaintStatusControl id={id} currentStatus={status} />
      </section>

      <section className="lux-card p-4 mb-4">
        <h2 className="eyebrow mb-3">Work Order</h2>
        <ConvertToWorkOrder
          complaintId={id}
          propertyId={propertyId}
          unitId={unitId}
          tenantId={tenantId}
          title={context.title}
          description={context.description}
          technicians={technicians}
          existingWorkOrderId={workOrderId}
        />
      </section>

      {photoUrls.length > 0 && (
        <section className="lux-card p-4 mb-4">
          <h2 className="eyebrow mb-3">Resident Photos</h2>
          <div className="grid grid-cols-3 gap-2">
            {photoUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`Attachment ${i + 1}`} className="aspect-square w-full object-cover rounded-lg border border-[rgba(176,27,66,0.15)]" />
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="lux-card p-4 mb-4">
        <h2 className="eyebrow mb-3">Tenant / Unit</h2>
        <p>Unit: {context.unitLabel ?? "Common area"}</p>
        <p>Resident: {context.residentName ?? "Unknown"}</p>
        <p>Occupants: {context.occupantCount ?? "n/a"}</p>
        <p>
          Lease: {context.leaseStartDate ?? "n/a"}
          {context.leaseEndDate ? ` to ${context.leaseEndDate}` : " (ongoing)"}
        </p>
      </section>

      <section
        className={`border rounded-xl p-4 ${
          context.isRecurringIssue ? "border-red-500 bg-red-950/30" : "border-[rgba(176,27,66,0.15)] bg-[#ffffff]"
        }`}
      >
        <h2 className="eyebrow mb-3">
          Equipment History {context.isRecurringIssue && "— RECURRING ISSUE"}
        </h2>
        {context.assetName ? (
          <>
            <p>Asset: {context.assetName}</p>
            <p>Prior corrective work orders on this asset: {context.correctiveWorkOrderCount}</p>
            <p>Prior complaints on this asset: {context.priorComplaintCountOnAsset}</p>
            <p>
              Last work order on this asset:{" "}
              {context.lastWorkOrderOnAssetAt
                ? new Date(context.lastWorkOrderOnAssetAt).toLocaleString()
                : "none"}
            </p>
            {context.isRecurringIssue && (
              <p className="text-red-600 mt-2">
                This equipment has been worked on 3+ times. Consider replacement instead of repeat repair.
              </p>
            )}
          </>
        ) : (
          <p className="text-[#8b97ab]">No specific asset linked to this complaint yet.</p>
        )}
      </section>
    </main>
  );
}
