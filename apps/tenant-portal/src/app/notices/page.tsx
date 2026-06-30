import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type BuildingNotice } from "@gspop/shared";

async function getNotices(): Promise<BuildingNotice[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("building_notices")
    .select("*")
    .order("posted_at", { ascending: false });
  return camelCaseKeys<BuildingNotice[]>(data ?? []);
}

export default async function NoticesPage() {
  const notices = await getNotices();

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--navy)] p-6">
      <h1 className="text-xl font-bold mb-4">Building Notices</h1>
      <ul className="space-y-3">
        {notices.map((n) => (
          <li key={n.id} className="bg-white border border-[var(--hairline)] rounded-xl p-4">
            <p className="font-medium">{n.title}</p>
            <p className="text-sm text-[var(--muted)] mt-1">{n.body}</p>
            <p className="text-xs text-[var(--muted)] mt-2">{new Date(n.postedAt).toLocaleString()}</p>
          </li>
        ))}
        {notices.length === 0 && <p className="text-[var(--muted)]">No notices posted.</p>}
      </ul>
    </main>
  );
}
