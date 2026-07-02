import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

type Card = { href: string; title: string; desc: string; adminOnly?: boolean };
type Section = { label: string; blurb: string; cards: Card[] };

// The console mirrors ARENCO's actual operation — organised department-wise.
// Each department owns its sections; the flow map above shows how work passes
// between them (Maintenance → Store → Purchasing).
const SECTIONS: Section[] = [
  {
    label: "Maintenance & Engineering",
    blurb: "The operational core — every asset, and every job done to it.",
    cards: [
      { href: "/assets", title: "Asset Register", desc: "Every equipment — Building → Floor → Apartment → Equipment. Warranty, cost, service history." },
      { href: "/work-orders", title: "Job Cards / Work Orders", desc: "Receive, attend, and close corrective jobs. Raise a store requisition if parts are needed." },
      { href: "/complaints", title: "Complaints & Help Desk", desc: "Resident-reported issues; convert to a job card on the same case number." },
      { href: "/maintenance", title: "Preventive Maintenance", desc: "PPM schedules that auto-raise job cards by asset and cycle." },
      { href: "/approvals", title: "Approvals", desc: "Spend and escalations awaiting sign-off, per the approval matrix." },
      { href: "/call-center", title: "Call Center", desc: "Identify callers and log complaints on their behalf." },
      { href: "/compliance", title: "Compliance", desc: "Civil Defence, lift inspections, DM reports — expiry tracking." },
    ],
  },
  {
    label: "Store & Inventory",
    blurb: "The internal supplier. Maintenance requisitions parts here — no PO for routine work.",
    cards: [
      { href: "/store", title: "Store & Dispatch", desc: "Incoming material requisitions from Maintenance — pick, issue, deliver from stock." },
      { href: "/inventory", title: "Inventory / Stock", desc: "Stock on hand, reorder thresholds, movements. Low stock triggers a PO to Purchasing." },
      { href: "/inventory/reports", title: "Stock Reports", desc: "Consumption by apartment and building, valuation, slow movers." },
    ],
  },
  {
    label: "Purchasing & Contracts",
    blurb: "A separate department, linked to Maintenance and Store. PO for bulk stock; tender for major work.",
    cards: [
      { href: "/purchasing", title: "Purchasing / Purchase Orders", desc: "Bulk stock purchase into the Store, and awarded-tender POs. Budget-checked." },
      { href: "/tenders", title: "Tenders", desc: "Major maintenance: BOQ from Maintenance → tender to vendors → site visits → quotes → award." },
      { href: "/vendors", title: "Vendors & Contracts", desc: "Subcontractors and suppliers, AMC contracts, ratings, assignments." },
      { href: "/invoices", title: "Invoices & Payments", desc: "Contractor invoices verified against POs; record payments." },
    ],
  },
  {
    label: "Community & Residents",
    blurb: "The resident-facing side of the building.",
    cards: [
      { href: "/admin/residents", title: "Residents & Leases", desc: "Onboard residents, rent schedules, renewal reminders, documents.", adminOnly: true },
      { href: "/admin/notices", title: "Building Notices", desc: "Post announcements to residents.", adminOnly: true },
      { href: "/bookings", title: "Bookings", desc: "Common-area reservations: gym, pool, function rooms." },
      { href: "/visitors", title: "Visitor Log", desc: "Gate activity and pre-authorized visitors." },
      { href: "/security", title: "Security Console", desc: "Live gate queue: check visitors in and out." },
    ],
  },
  {
    label: "Insight & Reporting",
    blurb: "Cross-department visibility for management.",
    cards: [
      { href: "/reports/dashboard", title: "Analytics Dashboard", desc: "KPI tiles, occupancy, rent collection, turnaround, building health." },
      { href: "/ai-brain", title: "AI Brain", desc: "Smart triage, budget forecasting, anomaly detection, predictive maintenance." },
      { href: "/command-center", title: "GM Command Center", desc: "Live ops overview across jobs, contractors, and stock alerts." },
      { href: "/reports/maintenance-costs", title: "Maintenance Cost Report", desc: "Per-building and apartment cost: parts, labor, external." },
      { href: "/reports/budgets", title: "Building Budgets", desc: "Annual budget per building — spent vs remaining, drives the spend guard." },
      { href: "/operations-monitor", title: "Operations Monitor", desc: "Trade utilization and workload signals." },
      { href: "/staff-dashboard", title: "Staff Dashboard", desc: "Per-technician KPIs and throughput." },
      { href: "/activity-log", title: "Activity Log", desc: "Full audit trail across the platform." },
    ],
  },
  {
    label: "Administration",
    blurb: "Configure how the operation runs.",
    cards: [
      { href: "/admin/buildings", title: "Buildings", desc: "Your portfolio — buildings, floors, apartments, common areas. Bulk-uploadable.", adminOnly: true },
      { href: "/admin/team", title: "Team Management", desc: "Create staff, roles, reporting lines.", adminOnly: true },
      { href: "/admin/workflows", title: "Workflow Configuration", desc: "Permissions, approval chains, and task routing.", adminOnly: true },
      { href: "/admin/automation", title: "Automation Settings", desc: "Renewal reminder stages (90/60/30/10 days), overdue repeats, run time.", adminOnly: true },
    ],
  },
  {
    label: "Role Portals",
    blurb: "Purpose-built views for field and external users.",
    cards: [
      { href: "/technician", title: "Technician View", desc: "Mobile job list, GPS check-in, photo upload, timer." },
      { href: "/vendor-portal", title: "Vendor Portal", desc: "View assignments, contracts, submit invoices." },
    ],
  },
];

// The operating flow — the connection between departments, drawn out.
type FlowStep = { title: string; sub: string; href?: string; tone: "maint" | "store" | "purch" | "start" };
type Flow = { label: string; steps: FlowStep[] };

const FLOWS: Flow[] = [
  {
    label: "Routine maintenance",
    steps: [
      { title: "Help Desk / Resident", sub: "Request comes in", tone: "start", href: "/complaints" },
      { title: "Job Card", sub: "Maintenance attends", tone: "maint", href: "/work-orders" },
      { title: "Store Requisition", sub: "Parts needed — no PO", tone: "store", href: "/store" },
      { title: "Issue & Close", sub: "Fitted, job card closed", tone: "maint", href: "/work-orders" },
    ],
  },
  {
    label: "Store replenishment",
    steps: [
      { title: "Stock Low", sub: "Below reorder level", tone: "store", href: "/inventory" },
      { title: "Purchase Order", sub: "Bulk buy — the only PO", tone: "purch", href: "/purchasing" },
      { title: "Receive into Store", sub: "Stock topped up", tone: "store", href: "/inventory" },
    ],
  },
  {
    label: "Major maintenance",
    steps: [
      { title: "BOQ", sub: "Head of Maintenance", tone: "maint", href: "/work-orders" },
      { title: "Tender", sub: "Purchasing releases", tone: "purch", href: "/tenders" },
      { title: "Vendor Quotes", sub: "Site visit + bids", tone: "purch", href: "/tenders" },
      { title: "Award → Subcontract", sub: "Work assigned", tone: "purch", href: "/vendors" },
    ],
  },
];

const TONE: Record<FlowStep["tone"], string> = {
  start: "bg-[#eef1f7] text-[#43536e] border-[#dbe2ee]",
  maint: "bg-[rgba(176,27,66,0.06)] text-[#8f1636] border-[rgba(176,27,66,0.22)]",
  store: "bg-[#eef4ff] text-[#2c4a86] border-[#d3e0f7]",
  purch: "bg-[#fff5ec] text-[#8a5216] border-[#f2dcc2]",
};

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, role")
    .eq("id", userData.user?.id ?? "")
    .single();

  const isAdmin = profile && ["super_admin", "tenant_admin", "property_manager"].includes(profile.role);
  const sections = SECTIONS.map((s) => ({
    ...s,
    cards: s.cards.filter((c) => !c.adminOnly || isAdmin),
  })).filter((s) => s.cards.length > 0);

  return (
    <main className="p-8 max-w-6xl mx-auto w-full">
      <div className="mb-10">
        <p className="eyebrow mb-2">ARENCO Real Estate — Asset &amp; Facilities Management</p>
        <h1 className="font-display text-4xl text-[#16233c]">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-[#5b6b85] capitalize mt-1.5">{profile?.role?.replace(/_/g, " ") ?? ""}</p>
        <div className="gold-rule mt-5 max-w-xs" />
      </div>

      {/* Operating flow — how the departments connect */}
      <section className="mb-14">
        <div className="flex items-center gap-4 mb-5">
          <h2 className="eyebrow whitespace-nowrap">How work flows</h2>
          <div className="gold-rule flex-1 opacity-60" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {FLOWS.map((flow) => (
            <div key={flow.label} className="lux-card p-5">
              <p className="text-sm font-bold text-[#16233c] mb-3">{flow.label}</p>
              <div className="space-y-2">
                {flow.steps.map((step, i) => (
                  <div key={i}>
                    <Link
                      href={step.href ?? "#"}
                      className={`block rounded-lg border px-3 py-2 transition-opacity hover:opacity-80 ${TONE[step.tone]}`}
                    >
                      <p className="text-[13px] font-semibold leading-tight">{step.title}</p>
                      <p className="text-[11px] opacity-80 leading-tight mt-0.5">{step.sub}</p>
                    </Link>
                    {i < flow.steps.length - 1 && (
                      <div className="flex justify-center py-0.5 text-[#c3ccdb] text-xs leading-none">↓</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#8b97ab] mt-3">
          A purchase order is raised <b>only</b> for bulk stock into the Store. Routine repairs draw parts from the Store on a
          requisition — never a PO. Major works go out to tender.
        </p>
      </section>

      {/* Departments */}
      {sections.map((section) => (
        <section key={section.label} className="mb-12">
          <div className="flex items-center gap-4 mb-1">
            <h2 className="eyebrow whitespace-nowrap">{section.label}</h2>
            <div className="gold-rule flex-1 opacity-60" />
          </div>
          <p className="text-sm text-[#8b97ab] mb-4">{section.blurb}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.cards.map((c) => (
              <Link key={c.href} href={c.href} className="lux-card lux-card-hover p-5">
                <p className="font-bold mb-1">{c.title}</p>
                <p className="text-sm text-[#5b6b85] leading-relaxed">{c.desc}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
