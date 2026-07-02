import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type Visitor } from "@gspop/shared";
import BottomNav from "@/components/BottomNav";
import { DoorOpen, Package, Wrench as ServiceIcon } from "lucide-react";

const GATE_ACTIONS = [
  { href: "/gate/guest", Icon: DoorOpen, label: "Invite Guest" },
  { href: "/gate/delivery", Icon: Package, label: "Allow Delivery" },
  { href: "/gate/service", Icon: ServiceIcon, label: "Notify Service" },
];

const STATUS_LABEL: Record<string, string> = {
  invited: "Invited",
  checked_in: "On site",
  checked_out: "Checked out",
  declined: "Declined",
  expired: "Expired",
};

const STATUS_STYLE: Record<string, string> = {
  invited: "bg-[rgba(176,27,66,0.15)] text-[#d9647f]",
  checked_in: "bg-[rgba(45,140,90,0.15)] text-[#1f8a4d]",
  checked_out: "bg-[rgba(255,255,255,0.06)] text-[#5b6b85]",
  declined: "bg-[rgba(180,60,60,0.15)] text-[#c0304a]",
  expired: "bg-[rgba(255,255,255,0.06)] text-[#5b6b85]",
};

async function getMyVisitors(): Promise<Visitor[]> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("visitors")
    .select("*")
    .eq("host_resident_id", userData.user?.id)
    .order("created_at", { ascending: false })
    .limit(10);
  return camelCaseKeys<Visitor[]>(data ?? []);
}

export default async function GatePage() {
  const visitors = await getMyVisitors();

  return (
    <main className="min-h-screen pb-32">
      <div className="px-6 pt-10 pb-6">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1.5">
          Security
        </p>
        <h1 className="font-display text-3xl text-[#16233c] font-semibold">Gate</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Pre-authorize who security should let in.</p>
      </div>

      <div className="px-5 space-y-5">
        <div className="elevated-card rounded-2xl p-5">
          <div className="grid grid-cols-3 gap-3">
            {GATE_ACTIONS.map(({ href, Icon, label }) => (
              <Link key={href} href={href} className="flex flex-col items-center gap-2 group">
                <span className="w-14 h-14 rounded-full bg-[var(--gold-pale)] flex items-center justify-center text-[var(--gold)] group-hover:bg-[var(--gold)] group-hover:text-[#f4f6fa] transition-colors">
                  <Icon size={22} strokeWidth={1.7} />
                </span>
                <span className="text-[10px] text-center text-[#16233c] leading-tight font-medium">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <section className="elevated-card rounded-2xl p-5">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold mb-4">
            My Visitors
          </p>
          <ul className="space-y-3">
            {visitors.map((v) => (
              <li key={v.id} className="flex items-center justify-between pb-3 border-b border-[var(--hairline)] last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-[#16233c]">{v.fullName || v.brandName || "Visitor"}</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5 capitalize">{v.purpose}</p>
                </div>
                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[v.status]}`}>
                  {STATUS_LABEL[v.status]}
                </span>
              </li>
            ))}
            {visitors.length === 0 && <p className="text-[var(--muted)] text-sm">No visitors invited yet.</p>}
          </ul>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
