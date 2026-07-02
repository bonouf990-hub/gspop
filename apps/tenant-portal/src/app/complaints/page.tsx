import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type Complaint } from "@gspop/shared";
import BottomNav from "@/components/BottomNav";
import { ClipboardList, ChevronRight } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-[rgba(176,27,66,0.15)] text-[#d9647f]",
  acknowledged: "bg-[rgba(90,140,200,0.15)] text-[#3d6cb3]",
  assigned: "bg-[rgba(90,140,200,0.15)] text-[#3d6cb3]",
  in_progress: "bg-[rgba(90,140,200,0.15)] text-[#3d6cb3]",
  resolved: "bg-[rgba(45,140,90,0.15)] text-[#1f8a4d]",
  closed: "bg-[rgba(255,255,255,0.06)] text-[#5b6b85]",
  rejected: "bg-[rgba(180,60,60,0.15)] text-[#c0304a]",
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
    <main className="min-h-screen pb-32">
      <div className="px-6 pt-10 pb-6">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1.5">
          Maintenance
        </p>
        <h1 className="font-display text-3xl text-[#16233c] font-semibold">My Requests</h1>
      </div>

      <div className="px-5">
        <section className="elevated-card rounded-2xl p-5">
          <ul className="space-y-3">
            {complaints.map((c) => (
              <li key={c.id} className="border-b border-[var(--hairline)] last:border-0">
                <Link
                  href={`/complaints/${c.id}`}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-[#16233c]">{c.title}</p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      {new Date(c.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[c.status]}`}>
                      {c.status.replace(/_/g, " ")}
                    </span>
                    <ChevronRight size={16} className="text-[#8b97ab]" />
                  </div>
                </Link>
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
