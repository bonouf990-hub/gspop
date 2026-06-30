import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type ComplaintContext } from "@gspop/shared";

async function getComplaintContext(id: string): Promise<ComplaintContext | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("complaint_context")
    .select("*")
    .eq("complaint_id", id)
    .single();
  return data ? camelCaseKeys<ComplaintContext>(data) : null;
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
        <p className="text-gray-500">Complaint not found.</p>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">{context.title}</h1>
      <p className="text-gray-400 mb-6">{context.description}</p>

      <section className="border border-gray-700 rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Tenant / Unit</h2>
        <p>Unit: {context.unitLabel ?? "Common area"}</p>
        <p>Resident: {context.residentName ?? "Unknown"}</p>
        <p>Occupants: {context.occupantCount ?? "n/a"}</p>
        <p>
          Lease: {context.leaseStartDate ?? "n/a"}
          {context.leaseEndDate ? ` to ${context.leaseEndDate}` : " (ongoing)"}
        </p>
      </section>

      <section
        className={`border rounded-lg p-4 ${
          context.isRecurringIssue ? "border-red-500 bg-red-950/30" : "border-gray-700"
        }`}
      >
        <h2 className="font-semibold mb-2">Equipment History {context.isRecurringIssue && "— RECURRING ISSUE"}</h2>
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
              <p className="text-red-400 mt-2">
                This equipment has been worked on 3+ times. Consider replacement instead of repeat repair.
              </p>
            )}
          </>
        ) : (
          <p className="text-gray-500">No specific asset linked to this complaint yet.</p>
        )}
      </section>
    </main>
  );
}
