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
  LayoutDashboard, ScrollText, Building2, ShieldAlert,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  adminOnly?: boolean;
  ownerOnly?: boolean;
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
      { href: "/reports/ai-summary", label: "AI Building Report", icon: ScrollText },
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
  {
    label: "Private",
    items: [
      { href: "/gm/integrity", label: "Integrity Watch", icon: ShieldAlert, ownerOnly: true },
      { href: "/gm/access", label: "Owner Access", icon: UserCog, ownerOnly: true },
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
  const [profile, setProfile] = useState<{ name: string; role: string; isOwner: boolean } | null>(null);
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
        supabase.from("user_profiles").select("full_name, role, is_owner").eq("id", uid).single(),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", uid)
          .is("read_at", null),
      ]);
      if (p) setProfile({ name: p.full_name as string, role: p.role as string, isOwner: p.is_owner === true });
      setUnread(count ?? 0);
    })();
  }, [bare, pathname]);

  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  if (bare) return <>{children}</>;

  const isAdmin = profile ? ["super_admin", "tenant_admin", "property_manager"].includes(profile.role) : true;
  // Owner-only items never show optimistically — only once we've confirmed the flag.
  const isOwner = profile?.isOwner === true;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const sidebar = (
    <div className="flex flex-col h-full bg-gradient-to-b from-white to-[#fcfdff] border-r border-[#e4e9f2]">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-[#eef1f7]">
        <Link href="/" className="group flex items-center gap-3">
          <span className="icon-chip icon-chip-solid icon-chip-lg shrink-0 font-display text-lg font-bold">
            A
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-extrabold tracking-[0.12em] text-[#16233c] leading-none">
              ARENCO <span className="text-[#b01b42]">One</span>
            </span>
            <span className="block text-[9px] font-bold tracking-[0.3em] uppercase text-[#b01b42] mt-1.5">
              Estate Operations
            </span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV.map((group) => {
          const items = group.items.filter((i) => (!i.adminOnly || isAdmin) && (!i.ownerOnly || isOwner));
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold tracking-[0.18em] uppercase text-[#9aa6ba]">
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
                        aria-current={active ? "page" : undefined}
                        className={`group/nav relative flex items-center gap-3 pl-3 pr-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                          active
                            ? "bg-[rgba(176,27,66,0.07)] text-[#b01b42] font-semibold shadow-[inset_0_0_0_1px_rgba(176,27,66,0.12)]"
                            : "text-[#43536e] hover:bg-[#f4f7fb] hover:text-[#16233c]"
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-gradient-to-b from-[#c92c52] to-[#97173a]" />
                        )}
                        <span
                          className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 ${
                            active
                              ? "bg-white text-[#b01b42] shadow-[0_1px_2px_rgba(176,27,66,0.18),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-[rgba(176,27,66,0.15)]"
                              : "text-[#8b97ab] group-hover/nav:text-[#5b6b85]"
                          }`}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-[#eef1f7]">
        <p className="text-[10px] text-[#9aa6ba] tracking-[0.14em] uppercase flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] shadow-[0_0_0_2px_rgba(52,211,153,0.2)]" />
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
        <header className="sticky top-0 z-30 bg-white/75 backdrop-blur-xl border-b border-[#e4e9f2] shadow-[0_1px_2px_rgba(22,35,60,0.03)]">
          <div className="flex items-center gap-3 px-4 sm:px-6 h-14">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-[#43536e] hover:bg-[#f4f7fb] transition-colors"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <div className="flex-1" />

            <Link
              href="/notifications"
              className="relative w-9 h-9 flex items-center justify-center rounded-lg text-[#43536e] hover:bg-[#f4f7fb] hover:text-[#b01b42] transition-colors"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-[#c92c52] to-[#97173a] text-white text-[10px] font-bold flex items-center justify-center shadow-[0_2px_5px_rgba(176,27,66,0.4)] ring-2 ring-white tabular-nums">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>

            <div className="w-px h-6 bg-[#e4e9f2] mx-0.5 hidden sm:block" />

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-xl hover:bg-[#f4f7fb] transition-colors"
              >
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c92c52] to-[#97173a] text-white text-xs font-bold flex items-center justify-center shadow-[0_2px_6px_rgba(176,27,66,0.3),inset_0_1px_0_rgba(255,255,255,0.3)]">
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
                  <div className="absolute right-0 top-full mt-2 z-20 w-56 bg-white border border-[#e4e9f2] rounded-xl shadow-[0_12px_40px_rgba(22,35,60,0.16)] overflow-hidden origin-top-right">
                    <div className="px-4 py-3 border-b border-[#eef1f7] bg-gradient-to-b from-white to-[#fbfcfe]">
                      <p className="text-sm font-semibold text-[#16233c] leading-tight truncate">{profile?.name ?? "…"}</p>
                      <p className="text-[11px] text-[#8b97ab] capitalize leading-tight mt-0.5">
                        {profile?.role?.replace(/_/g, " ") ?? ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={signOut}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-[#c0304a] hover:bg-[#fdf2f4] transition-colors"
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
