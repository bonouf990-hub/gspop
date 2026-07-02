import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import PageHeader from "@/components/PageHeader";
import { camelCaseKeys, type Complaint } from "@gspop/shared";

async function getComplaints(): Promise<Complaint[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("complaints")
    .select("*")
    .order("submitted_at", { ascending: false });
  return camelCaseKeys<Complaint[]>(data ?? []);
}

export default async function ComplaintsPage() {
  const complaints = await getComplaints();

  return (
    <main className="p-6 sm:p-8 max-w-6xl mx-auto">
      <div className="rise-in">
        <PageHeader
          eyebrow="Maintenance & Help Desk"
          title="Tenant Complaints"
          icon={MessageSquare}
          description="Resident-reported issues — review, triage, and convert to a job card on the same case number."
        />
      </div>
      <ul className="space-y-3 rise-in rise-in-1">
        {complaints.map((c) => (
          <li key={c.id}>
            <Link href={`/complaints/${c.id}`} className="group lux-card lux-card-hover lux-card-accent p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-[#16233c] group-hover:text-[#b01b42] transition-colors truncate">{c.title}</p>
                <p className="text-sm text-[#5b6b85] mt-0.5 capitalize">
                  {c.status.replace(/_/g, " ")} · {c.priority} · submitted {new Date(c.submittedAt).toLocaleString()}
                </p>
              </div>
            </Link>
          </li>
        ))}
        {complaints.length === 0 && (
          <li className="lux-card p-12 text-center">
            <span className="icon-chip icon-chip-neutral icon-chip-lg mb-3 flex mx-auto" style={{ width: "3rem" }}>
              <MessageSquare size={22} />
            </span>
            <p className="text-[#5b6b85] font-medium">No complaints submitted yet</p>
          </li>
        )}
      </ul>
    </main>
  );
}
