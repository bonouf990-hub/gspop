import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

type Card = { href: string; title: string; desc: string; adminOnly?: boolean };

const CARDS: Card[] = [
  { href: "/work-orders", title: "Work Orders", desc: "Assign, track, and verify maintenance jobs." },
  { href: "/approvals", title: "Approvals", desc: "Review spend and escalations awaiting sign-off." },
  { href: "/complaints", title: "Complaints", desc: "Triage resident-reported issues; spot recurring faults." },
  { href: "/compliance", title: "Compliance", desc: "Document expiry and regulatory tracking." },
  { href: "/visitors", title: "Visitor Log", desc: "Gate activity and pre-authorized visitors." },
  { href: "/security", title: "Security Console", desc: "Live gate queue: check visitors in and out." },
  { href: "/call-center", title: "Call Center", desc: "Identify callers and log complaints on their behalf." },
  { href: "/operations-monitor", title: "Operations Monitor", desc: "Trade utilization and workload signals." },
  { href: "/staff-dashboard", title: "Staff Dashboard", desc: "Per-technician KPIs and throughput." },
  { href: "/admin/residents", title: "Residents & Leases", desc: "Onboard residents, rent schedules, documents.", adminOnly: true },
  { href: "/admin/notices", title: "Building Notices", desc: "Post announcements to residents.", adminOnly: true },
  { href: "/admin/team", title: "Team Management", desc: "Create staff, roles, reporting lines.", adminOnly: true },
];

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, role")
    .eq("id", userData.user?.id ?? "")
    .single();

  const isAdmin = profile && ["tenant_admin", "property_manager"].includes(profile.role);
  const cards = CARDS.filter((c) => !c.adminOnly || isAdmin);

  return (
    <main className="p-8 max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <p className="text-xs text-[#b8902f] font-bold tracking-[0.2em] uppercase mb-1">GSPOP — Operations Console</p>
        <h1 className="text-2xl font-extrabold mb-1">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-[#a0977e] capitalize">{profile?.role?.replace(/_/g, " ") ?? ""}</p>
        <div className="w-10 h-0.5 bg-[#b8902f] mt-3 rounded-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="border border-[rgba(184,144,47,0.15)] hover:border-[#b8902f] rounded-xl p-5 transition-colors bg-[#1a2640]"
          >
            <p className="font-bold mb-1">{c.title}</p>
            <p className="text-sm text-[#a0977e]">{c.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
