import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type Complaint } from "@gspop/shared";

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
    <main className="min-h-screen bg-[var(--background)] text-[var(--navy)] p-6">
      <h1 className="text-xl font-bold mb-4">My Requests</h1>
      <ul className="space-y-3">
        {complaints.map((c) => (
          <li key={c.id} className="bg-white border border-[var(--hairline)] rounded-xl p-4">
            <p className="font-medium">{c.title}</p>
            <p className="text-sm text-[var(--muted)]">{c.status.replace(/_/g, " ")}</p>
          </li>
        ))}
        {complaints.length === 0 && <p className="text-[var(--muted)]">No requests submitted yet.</p>}
      </ul>
    </main>
  );
}
