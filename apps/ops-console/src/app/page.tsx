import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

type Card = { href: string; title: string; desc: string; adminOnly?: boolean };
type Section = { label: string; cards: Card[] };

const SECTIONS: Section[] = [
  {
    label: "Daily Operations",
    cards: [
      { href: "/work-orders", title: "Work Orders", desc: "Assign, track, and verify maintenance jobs." },
      { href: "/complaints", title: "Complaints", desc: "Triage resident-reported issues; spot recurring faults." },
      { href: "/approvals", title: "Approvals", desc: "Review spend and escalations awaiting sign-off." },
      { href: "/maintenance", title: "Preventive Maintenance", desc: "Recurring schedules that auto-generate work orders." },
      { href: "/call-center", title: "Call Center", desc: "Identify callers and log complaints on their behalf." },
      { href: "/notifications", title: "Notifications", desc: "Alerts and updates for your team." },
    ],
  },
  {
    label: "Building & Residents",
    cards: [
      { href: "/admin/residents", title: "Residents & Leases", desc: "Onboard residents, rent schedules, documents.", adminOnly: true },
      { href: "/admin/notices", title: "Building Notices", desc: "Post announcements to residents.", adminOnly: true },
      { href: "/bookings", title: "Bookings", desc: "Common-area reservations: gym, pool, function rooms." },
      { href: "/visitors", title: "Visitor Log", desc: "Gate activity and pre-authorized visitors." },
      { href: "/security", title: "Security Console", desc: "Live gate queue: check visitors in and out." },
      { href: "/compliance", title: "Compliance", desc: "Document expiry and regulatory tracking." },
    ],
  },
  {
    label: "Procurement & Finance",
    cards: [
      { href: "/purchasing", title: "Purchasing", desc: "Purchase orders, vendor selection, and fulfillment." },
      { href: "/tenders", title: "Tender Management", desc: "Create RFPs, receive vendor bids, AI-scored evaluation." },
      { href: "/vendors", title: "Vendors & Contracts", desc: "Manage suppliers, ratings, and service contracts." },
      { href: "/invoices", title: "Invoices & Payments", desc: "Track contractor invoices, verify against POs, record payments." },
      { href: "/inventory", title: "Inventory & Store", desc: "Stock levels, reorder alerts, and movement tracking." },
      { href: "/store", title: "Store & Dispatch", desc: "Pick, pack, and deliver parts requests from technicians." },
    ],
  },
  {
    label: "Analytics & Intelligence",
    cards: [
      { href: "/reports/dashboard", title: "Analytics Dashboard", desc: "KPI tiles, occupancy, rent collection, turnaround times, building health." },
      { href: "/ai-brain", title: "AI Brain", desc: "Smart triage, budget forecasting, anomaly detection, data queries, predictive maintenance." },
      { href: "/command-center", title: "GM Command Center", desc: "Live ops overview: jobs, contractors, inventory alerts." },
      { href: "/reports/maintenance-costs", title: "Maintenance Cost Report", desc: "Per-building and apartment cost breakdown: parts, labor, external." },
      { href: "/reports/budgets", title: "Building Budgets", desc: "Annual maintenance budget per building — track spent vs remaining." },
      { href: "/operations-monitor", title: "Operations Monitor", desc: "Trade utilization and workload signals." },
      { href: "/staff-dashboard", title: "Staff Dashboard", desc: "Per-technician KPIs and throughput." },
      { href: "/activity-log", title: "Activity Log", desc: "Full audit trail of all operations across the platform." },
    ],
  },
  {
    label: "Administration",
    cards: [
      { href: "/admin/team", title: "Team Management", desc: "Create staff, roles, reporting lines.", adminOnly: true },
      { href: "/admin/workflows", title: "Workflow Configuration", desc: "Control permissions, approval chains, and task routing.", adminOnly: true },
    ],
  },
  {
    label: "Role Portals",
    cards: [
      { href: "/technician", title: "Technician View", desc: "Mobile-friendly job list, GPS check-in, photo upload, timer." },
      { href: "/vendor-portal", title: "Vendor Portal", desc: "View assignments, contracts, submit invoices." },
    ],
  },
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
  const sections = SECTIONS.map((s) => ({
    ...s,
    cards: s.cards.filter((c) => !c.adminOnly || isAdmin),
  })).filter((s) => s.cards.length > 0);

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

      {sections.map((section) => (
        <section key={section.label} className="mb-10">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
            {section.label}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.cards.map((c) => (
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
        </section>
      ))}
    </main>
  );
}
