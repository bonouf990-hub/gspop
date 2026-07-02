import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
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
    <main className="p-8">
      <h1 className="text-2xl font-extrabold mt-1 mb-6">Tenant Complaints</h1>
      <ul className="space-y-3">
        {complaints.map((c) => (
          <li key={c.id} className="lux-card p-4">
            <Link href={`/complaints/${c.id}`} className="font-medium text-[#d9647f] hover:underline">
              {c.title}
            </Link>
            <p className="text-sm text-[#5b6b85]">
              {c.status.replace(/_/g, " ")} · {c.priority} · submitted {new Date(c.submittedAt).toLocaleString()}
            </p>
          </li>
        ))}
        {complaints.length === 0 && <p className="text-[#8b97ab]">No complaints submitted yet.</p>}
      </ul>
    </main>
  );
}
