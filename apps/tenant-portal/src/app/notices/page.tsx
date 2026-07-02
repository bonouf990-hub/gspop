import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type BuildingNotice } from "@gspop/shared";
import BottomNav from "@/components/BottomNav";
import { Megaphone } from "lucide-react";

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
    <main className="min-h-screen pb-32">
      <div className="px-6 pt-10 pb-6">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1.5">
          Community
        </p>
        <h1 className="font-display text-3xl text-[#16233c] font-semibold">Building Notices</h1>
      </div>

      <div className="px-5 space-y-3">
        {notices.map((n) => (
          <div key={n.id} className="elevated-card rounded-2xl p-5">
            <p className="text-sm font-semibold text-[#16233c]">{n.title}</p>
            <p className="text-sm text-[var(--muted)] mt-1.5 leading-relaxed">{n.body}</p>
            <p className="text-[10px] text-[var(--muted)] mt-3 uppercase tracking-wide">
              {new Date(n.postedAt).toLocaleString()}
            </p>
          </div>
        ))}
        {notices.length === 0 && (
          <div className="elevated-card rounded-2xl p-8 text-center">
            <Megaphone size={28} className="mx-auto mb-2 text-[var(--gold)]" strokeWidth={1.5} />
            <p className="text-[var(--muted)] text-sm">No notices posted.</p>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
