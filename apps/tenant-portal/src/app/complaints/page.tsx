import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type Complaint } from "@gspop/shared";
import BottomNav from "@/components/BottomNav";
import { ClipboardList } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-[var(--gold-pale)] text-[#8a6a1f]",
  acknowledged: "bg-[#E6EEF8] text-[#2A5A8C]",
  assigned: "bg-[#E6EEF8] text-[#2A5A8C]",
  in_progress: "bg-[#E6EEF8] text-[#2A5A8C]",
  resolved: "bg-[#E3F2E8] text-[#1F7A45]",
  closed: "bg-[#F1EFE8] text-[var(--muted)]",
  rejected: "bg-[#FBE6E6] text-[#B23B3B]",
};

async function getMyComplaints(): Promise<Complaint[]> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("complaints")
    .select("*")
    .eq("resident_id", userData.user?.id)
    .order("submitted_at", { ascending: false });
  return camelCaseKeys<Complaint[]>(data ?? []);
}

export default async function MyComplaintsPage() {
  const complaints = await getMyComplaints();

  return (
    <main className="min-h-screen bg-[var(--background)] pb-32">
      <div className="px-6 pt-10 pb-6">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1.5">
          Maintenance
        </p>
        <h1 className="font-display text-3xl text-[var(--navy)] font-semibold">My Requests</h1>
      </div>

      <div className="px-5">
        <section className="elevated-card rounded-2xl p-5">
          <ul className="space-y-3">
            {complaints.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between pb-3 border-b border-[var(--hairline)] last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--navy)]">{c.title}</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {new Date(c.submittedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[c.status]}`}>
                  {c.status.replace(/_/g, " ")}
                </span>
              </li>
            ))}
            {complaints.length === 0 && (
              <div className="text-center py-8">
                <ClipboardList size={28} className="mx-auto mb-2 text-[var(--gold)]" strokeWidth={1.5} />
                <p className="text-[var(--muted)] text-sm">No requests submitted yet.</p>
              </div>
            )}
          </ul>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
