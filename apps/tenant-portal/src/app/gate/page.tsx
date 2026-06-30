import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type Visitor } from "@gspop/shared";

const GATE_ACTIONS = [
  { href: "/gate/guest", icon: "🚪", label: "Invite Guest" },
  { href: "/gate/delivery", icon: "📦", label: "Allow Delivery" },
  { href: "/gate/service", icon: "🧰", label: "Notify Service" },
];

const STATUS_LABEL: Record<string, string> = {
  invited: "Invited",
  checked_in: "On site",
  checked_out: "Checked out",
  declined: "Declined",
  expired: "Expired",
};

const STATUS_COLOR: Record<string, string> = {
  invited: "text-amber-400",
  checked_in: "text-green-400",
  checked_out: "text-[var(--muted)]",
  declined: "text-red-400",
  expired: "text-[var(--muted)]",
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
    <main className="min-h-screen bg-[var(--background)] text-[var(--navy)] p-6 pb-24">
      <h1 className="text-xl font-bold mb-1">Gate</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Pre-authorize who security should let in.</p>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {GATE_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="bg-white border border-[var(--hairline)] rounded-2xl p-4 text-center hover:border-[var(--gold)] transition-colors"
          >
            <p className="text-2xl mb-1">{action.icon}</p>
            <p className="text-xs font-medium">{action.label}</p>
          </Link>
        ))}
      </div>

      <h2 className="font-semibold mb-3">My Visitors</h2>
      <ul className="space-y-2">
        {visitors.map((v) => (
          <li key={v.id} className="bg-white border border-[var(--hairline)] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{v.fullName || v.brandName || "Visitor"}</p>
              <span className={`text-xs font-medium ${STATUS_COLOR[v.status]}`}>
                {STATUS_LABEL[v.status]}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)] mt-1 capitalize">{v.purpose}</p>
          </li>
        ))}
        {visitors.length === 0 && <p className="text-[var(--muted)] text-sm">No visitors invited yet.</p>}
      </ul>
    </main>
  );
}
