"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  Wrench, MessageSquare, CheckSquare, CalendarClock, Phone, Bell,
  Users, Megaphone, CalendarDays, DoorOpen, Shield, FileCheck,
  ShoppingCart, Gavel, Briefcase, ReceiptText, Boxes, Package,
  BarChart3, Brain, Activity, LineChart, Wallet, ClipboardList,
  UserCog, GitBranch, Timer, HardHat, Store, Menu, X, LogOut,
  LayoutDashboard, ScrollText, Building2,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  adminOnly?: boolean;
};
type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Home", icon: LayoutDashboard },
    ],
  },
  {
    label: "Maintenance & Engineering",
    items: [
      { href: "/assets", label: "Asset Register", icon: Boxes },
      { href: "/work-orders", label: "Job Cards / Work Orders", icon: Wrench },
      { href: "/complaints", label: "Complaints & Help Desk", icon: MessageSquare },
      { href: "/maintenance", label: "Preventive Maintenance", icon: CalendarClock },
      { href: "/approvals", label: "Approvals", icon: CheckSquare },
      { href: "/call-center", label: "Call Center", icon: Phone },
      { href: "/compliance", label: "Compliance", icon: FileCheck },
    ],
  },
  {
    label: "Store & Inventory",
    items: [
      { href: "/store", label: "Store & Dispatch", icon: Package },
      { href: "/inventory", label: "Inventory / Stock", icon: Boxes },
    ],
  },
  {
    label: "Purchasing & Contracts",
    items: [
      { href: "/purchasing", label: "Purchasing / POs", icon: ShoppingCart },
      { href: "/tenders", label: "Tenders", icon: Gavel },
      { href: "/vendors", label: "Vendors & Contracts", icon: Briefcase },
      { href: "/invoices", label: "Invoices & Payments", icon: ReceiptText },
    ],
  },
  {
    label: "Community & Residents",
    items: [
      { href: "/admin/residents", label: "Residents & Leases", icon: Users, adminOnly: true },
      { href: "/admin/notices", label: "Building Notices", icon: Megaphone, adminOnly: true },
      { href: "/bookings", label: "Bookings", icon: CalendarDays },
      { href: "/visitors", label: "Visitor Log", icon: DoorOpen },
      { href: "/security", label: "Security Console", icon: Shield },
    ],
  },
  {
    label: "Insight & Reporting",
    items: [
      { href: "/reports/dashboard", label: "Analytics Dashboard", icon: BarChart3 },
      { href: "/ai-brain", label: "AI Brain", icon: Brain },
      { href: "/command-center", label: "Command Center", icon: Activity },
      { href: "/reports/maintenance-costs", label: "Maintenance Costs", icon: LineChart },
      { href: "/reports/budgets", label: "Building Budgets", icon: Wallet },
      { href: "/operations-monitor", label: "Operations Monitor", icon: ClipboardList },
      { href: "/staff-dashboard", label: "Staff KPIs", icon: Users },
      { href: "/activity-log", label: "Activity Log", icon: ScrollText },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/buildings", label: "Buildings", icon: Building2, adminOnly: true },
      { href: "/admin/team", label: "Team Management", icon: UserCog, adminOnly: true },
      { href: "/admin/workflows", label: "Workflows", icon: GitBranch, adminOnly: true },
      { href: "/admin/automation", label: "Automation", icon: Timer, adminOnly: true },
    ],
  },
  {
    label: "Portals",
    items: [
      { href: "/technician", label: "Technician View", icon: HardHat },
      { href: "/vendor-portal", label: "Vendor Portal", icon: Store },
    ],
  },
];

// Routes that render without the shell (public / purpose-built layouts)
const BARE_PREFIXES = ["/login", "/tenders/submit", "/tenders/register", "/technician"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<{ name: string; role: string } | null>(null);
  const [unread, setUnread] = useState(0);

  const bare = BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/vendor-portal");

  useEffect(() => {
    if (bare) return;
    const supabase = createClient();
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const [{ data: p }, { count }] = await Promise.all([
        supabase.from("user_profiles").select("full_name, role").eq("id", uid).single(),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", uid)
          .is("read_at", null),
      ]);
      if (p) setProfile({ name: p.full_name as string, role: p.role as string });
      setUnread(count ?? 0);
    })();
  }, [bare, pathname]);

  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  if (bare) return <>{children}</>;

  const isAdmin = profile ? ["super_admin", "tenant_admin", "property_manager"].includes(profile.role) : true;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const sidebar = (
    <div className="flex flex-col h-full bg-white border-r border-[#e4e9f2]">
      {/* Brand */}
      <div className="px-6 pt-6 pb-5 border-b border-[#eef1f7]">
        <Link href="/" className="block">
          <p className="text-xl font-extrabold tracking-[0.14em] text-[#16233c]">ARENCO <span className="text-[#b01b42]">One</span></p>
          <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-[#b01b42] mt-0.5">
            Estate Operations
          </p>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.adminOnly || isAdmin);
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold tracking-[0.18em] uppercase text-[#8b97ab]">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          active
                            ? "bg-[rgba(176,27,66,0.08)] text-[#b01b42] font-semibold"
                            : "text-[#43536e] hover:bg-[#f4f7fb] hover:text-[#16233c]"
                        }`}
                      >
                        <Icon size={17} className={active ? "text-[#b01b42]" : "text-[#8b97ab]"} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-[#eef1f7]">
        <p className="text-[10px] text-[#8b97ab] tracking-[0.14em] uppercase">
          ARENCO Real Estate · Dubai
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-40">{sidebar}</aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-[#e4e9f2]">
          <div className="flex items-center gap-3 px-4 sm:px-6 h-14">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-[#43536e] hover:bg-[#f4f7fb]"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <div className="flex-1" />

            <Link
              href="/notifications"
              className="relative w-9 h-9 flex items-center justify-center rounded-lg text-[#43536e] hover:bg-[#f4f7fb]"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#b01b42] text-white text-[10px] font-bold flex items-center justify-center">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-lg hover:bg-[#f4f7fb]"
              >
                <span className="w-8 h-8 rounded-full bg-[#b01b42] text-white text-xs font-bold flex items-center justify-center">
                  {(profile?.name ?? "?")
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <span className="hidden sm:block text-left">
                  <span className="block text-sm font-semibold text-[#16233c] leading-tight">
                    {profile?.name ?? "…"}
                  </span>
                  <span className="block text-[11px] text-[#8b97ab] capitalize leading-tight">
                    {profile?.role?.replace(/_/g, " ") ?? ""}
                  </span>
                </span>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-20 w-48 bg-white border border-[#e4e9f2] rounded-xl shadow-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={signOut}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[#c0304a] hover:bg-[#fdf2f4]"
                    >
                      <LogOut size={16} />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </div>

      {/* Mobile close button rendered inside overlay sidebar */}
      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed top-3 right-3 z-[60] w-9 h-9 flex items-center justify-center rounded-lg bg-white shadow text-[#43536e]"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
