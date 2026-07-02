import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type Complaint } from "@gspop/shared";
import BottomNav from "@/components/BottomNav";
import { ChevronLeft, Check, Clock } from "lucide-react";

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-[rgba(255,255,255,0.06)] text-[#5b6b85]",
  medium: "bg-[rgba(176,27,66,0.15)] text-[#d9647f]",
  high: "bg-[rgba(200,130,50,0.15)] text-[#b26a1f]",
  emergency: "bg-[rgba(180,60,60,0.15)] text-[#c0304a]",
};

// The lifecycle a resident sees, in order. Statuses map onto these stages.
const STAGES = [
  { key: "submitted", label: "Submitted", statuses: ["submitted"] },
  { key: "acknowledged", label: "Acknowledged", statuses: ["acknowledged"] },
  { key: "in_progress", label: "In Progress", statuses: ["assigned", "in_progress"] },
  { key: "resolved", label: "Resolved", statuses: ["resolved", "closed"] },
];

function stageIndexFor(status: string): number {
  if (status === "rejected") return -1;
  const idx = STAGES.findIndex((s) => s.statuses.includes(status));
  return idx === -1 ? 0 : idx;
}

async function getComplaint(id: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  // Scope to the resident's own complaint (belt-and-suspenders on top of RLS).
  const { data: row } = await supabase
    .from("complaints")
    .select("*")
    .eq("id", id)
    .eq("resident_id", userData.user?.id)
    .single();

  if (!row) return null;
  const complaint = camelCaseKeys<Complaint>(row);

  // Attached photos (private bucket → signed URLs).
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

  // Assigned technician, once the complaint has become a work order.
  let technicianName: string | null = null;
  const workOrderId = (row as { work_order_id: string | null }).work_order_id;
  if (workOrderId) {
    const { data: wo } = await supabase
      .from("work_orders")
      .select("assigned_technician_id")
      .eq("id", workOrderId)
      .single();
    const techId = (wo as { assigned_technician_id: string | null } | null)?.assigned_technician_id;
    if (techId) {
      const { data: tech } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", techId)
        .single();
      technicianName = (tech as { full_name: string } | null)?.full_name ?? null;
    }
  }

  return { complaint, photoUrls, technicianName };
}

export default async function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getComplaint(id);

  if (!data) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-[var(--muted)] text-center mb-4">Request not found.</p>
        <Link href="/complaints" className="text-[var(--gold)] text-sm font-medium">
          Back to my requests
        </Link>
      </main>
    );
  }

  const { complaint, photoUrls, technicianName } = data;
  const rejected = complaint.status === "rejected";
  const currentStage = stageIndexFor(complaint.status);

  return (
    <main className="min-h-screen pb-32">
      <div className="px-6 pt-10 pb-6">
        <Link href="/complaints" className="inline-flex items-center text-[var(--muted)] text-sm mb-4">
          <ChevronLeft size={16} /> My Requests
        </Link>
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1.5">
          Maintenance
        </p>
        <h1 className="font-display text-2xl text-[#16233c] font-semibold leading-tight">
          {complaint.title}
        </h1>
        <div className="flex items-center gap-2 mt-3">
          <span
            className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${
              PRIORITY_STYLE[complaint.priority] ?? PRIORITY_STYLE.medium
            }`}
          >
            {complaint.priority}
          </span>
          <span className="text-xs text-[var(--muted)]">
            Submitted {new Date(complaint.submittedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="px-5 space-y-5">
        {/* Progress */}
        <section className="elevated-card rounded-2xl p-6">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold mb-5">
            Progress
          </p>
          {rejected ? (
            <div className="rounded-xl bg-[rgba(180,60,60,0.15)] text-[#c0304a] p-4 text-sm font-medium">
              This request was closed without action. If the issue persists, please submit a new request.
            </div>
          ) : (
            <ol className="space-y-0">
              {STAGES.map((stage, i) => {
                const done = i < currentStage;
                const current = i === currentStage;
                const last = i === STAGES.length - 1;
                return (
                  <li key={stage.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                          done
                            ? "bg-[var(--gold)] border-[var(--gold)] text-[#f4f6fa]"
                            : current
                              ? "bg-[rgba(176,27,66,0.12)] border-[var(--gold)] text-[var(--gold)]"
                              : "bg-[#f4f6fa] border-[var(--hairline)] text-[#8b97ab]"
                        }`}
                      >
                        {done ? <Check size={14} /> : current ? <Clock size={14} /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                      </span>
                      {!last && (
                        <span className={`w-0.5 flex-1 min-h-[28px] ${i < currentStage ? "bg-[var(--gold)]" : "bg-[var(--hairline)]"}`} />
                      )}
                    </div>
                    <div className={`pb-6 ${last ? "pb-0" : ""}`}>
                      <p
                        className={`text-sm font-medium ${
                          done || current ? "text-[#16233c]" : "text-[var(--muted)]"
                        }`}
                      >
                        {stage.label}
                      </p>
                      {current && <p className="text-xs text-[var(--gold)] mt-0.5">Current status</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Details */}
        <section className="elevated-card rounded-2xl p-6">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold mb-3">
            Details
          </p>
          <p className="text-sm text-[#16233c] leading-relaxed whitespace-pre-line">
            {complaint.description || "No additional details provided."}
          </p>
          <div className="gold-divider my-4" />
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Assigned technician</span>
            <span className="text-[#16233c] font-medium">{technicianName ?? "Not yet assigned"}</span>
          </div>
        </section>

        {/* Photos */}
        {photoUrls.length > 0 && (
          <section className="elevated-card rounded-2xl p-6">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold mb-4">
              Photos You Attached
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {photoUrls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={`Attachment ${i + 1}`}
                  className="aspect-square w-full object-cover rounded-xl border border-[var(--hairline)]"
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
