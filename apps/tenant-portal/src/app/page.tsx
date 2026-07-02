import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import {
  camelCaseKeys,
  type Asset,
  type Lease,
  type RentInvoice,
  type Unit,
} from "@gspop/shared";
import BottomNav from "@/components/BottomNav";
import { KeyRound, Wrench, ClipboardList, Megaphone, ArrowRight, BedDouble, Bath, Ruler, User, Bell, CalendarDays, HardHat } from "lucide-react";

async function getMyApartment() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const residentId = userData.user?.id;

  const { data: lease } = await supabase
    .from("leases")
    .select("*")
    .eq("primary_resident_id", residentId)
    .eq("status", "active")
    .single();

  if (!lease) return null;

  const [
    { data: unit },
    { data: assets },
    { data: invoices },
    { data: photos },
    { data: profile },
    { count: unreadCount },
  ] = await Promise.all([
      supabase.from("units").select("*").eq("id", lease.unit_id).single(),
      supabase.from("assets").select("*").eq("unit_id", lease.unit_id),
      supabase
        .from("rent_invoices")
        .select("*")
        .eq("lease_id", lease.id)
        .order("due_date", { ascending: false })
        .limit(1),
      supabase.from("unit_photos").select("*").eq("unit_id", lease.unit_id).order("is_primary", { ascending: false }),
      supabase.from("user_profiles").select("avatar_path").eq("id", residentId).single(),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
    ]);

  const primaryPhoto = photos?.[0] as { storage_path: string } | undefined;
  const photoUrl = primaryPhoto
    ? supabase.storage.from("unit-photos").getPublicUrl(primaryPhoto.storage_path).data.publicUrl
    : null;

  const avatarPath = (profile as { avatar_path: string | null } | null)?.avatar_path ?? null;
  const avatarUrl = avatarPath
    ? (await supabase.storage.from("avatars").createSignedUrl(avatarPath, 3600)).data?.signedUrl ?? null
    : null;

  return {
    lease: camelCaseKeys<Lease>(lease),
    unit: unit ? camelCaseKeys<Unit>(unit) : null,
    assets: camelCaseKeys<Asset[]>(assets ?? []),
    nextInvoice: invoices?.[0] ? camelCaseKeys<RentInvoice>(invoices[0]) : null,
    photoUrl,
    avatarUrl,
    unreadCount: unreadCount ?? 0,
  };
}

const QUICK_ACTIONS = [
  { href: "/gate", Icon: KeyRound, label: "Gate" },
  { href: "/complaints/new", Icon: Wrench, label: "Report Issue" },
  { href: "/book-visit", Icon: HardHat, label: "Book Visit" },
  { href: "/bookings", Icon: CalendarDays, label: "Bookings" },
  { href: "/notices", Icon: Megaphone, label: "Notices" },
];

export default async function HomePage() {
  const data = await getMyApartment();

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-[var(--muted)] text-center">No active lease found for your account.</p>
      </main>
    );
  }

  const { lease, unit, assets, nextInvoice, photoUrl, avatarUrl, unreadCount } = data;
  const rentDue = nextInvoice && (nextInvoice.status === "pending" || nextInvoice.status === "overdue");

  return (
    <main className="min-h-screen pb-32">
      {/* Dark hero, transitions into light body below */}
      <div
        className="relative h-[300px] w-full bg-cover bg-center overflow-hidden"
        style={{
          backgroundImage: photoUrl
            ? `linear-gradient(180deg, rgba(15,22,38,0.5) 0%, rgba(15,22,38,0.92) 100%), url(${photoUrl})`
            : "radial-gradient(ellipse 140% 100% at 20% -10%, #3a4d78 0%, #1a2440 45%, #0B1020 100%)",
        }}
      >
        {!photoUrl && (
          <svg
            className="absolute bottom-0 left-0 w-full opacity-[0.18]"
            height="90"
            viewBox="0 0 375 90"
            preserveAspectRatio="none"
          >
            <path
              fill="#F4EFE6"
              d="M0 90V55l20-10V40l15-5V20l25-8V8l30 4V0l25 6v10l20-4v14l30-6v12l25-2v10l30-4v8l30-6v10l30-2v18l30-4v18l40-2v18H0Z"
            />
          </svg>
        )}
        <div className="absolute inset-0 flex flex-col justify-between p-6 pb-10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold-soft)] font-medium">
              Golden Sands Residences
            </span>
            <div className="flex items-center gap-2.5">
              <Link
                href="/notifications"
                aria-label="Notifications"
                className="relative w-10 h-10 rounded-full bg-white/10 ring-1 ring-white/25 flex items-center justify-center backdrop-blur-sm"
              >
                <Bell size={18} className="text-white/85" strokeWidth={1.8} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--gold)] text-[#0f1626] text-[10px] font-semibold flex items-center justify-center ring-2 ring-[#0B1020]">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href="/profile"
                aria-label="My profile"
                className="w-10 h-10 rounded-full overflow-hidden bg-white/10 ring-1 ring-white/25 flex items-center justify-center backdrop-blur-sm"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="My profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={18} className="text-white/85" strokeWidth={1.8} />
                )}
              </Link>
            </div>
          </div>
          <div>
            <p className="text-xs tracking-[0.2em] uppercase text-white/55 mb-1.5">Welcome home</p>
            <h1 className="font-display text-white text-[3.25rem] leading-[1.05] font-semibold tracking-tight">
              {unit?.label ?? "—"}
            </h1>
            <div className="h-px w-14 mt-3 bg-gradient-to-r from-[var(--gold-soft)] to-transparent" />
          </div>
        </div>
      </div>

      <div className="px-5 -mt-6 relative z-10 space-y-5">
        {rentDue && (
          <Link
            href="/rent"
            className="elevated-card rounded-2xl p-5 flex items-center justify-between"
          >
            <div>
              <p className="eyebrow text-[10px] mb-1">
                {nextInvoice!.status === "overdue" ? "Payment Overdue" : "Payment Due"}
              </p>
              <p className="font-display text-2xl text-[#f0ece4]">{nextInvoice!.amount} AED</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">by {nextInvoice!.dueDate}</p>
            </div>
            <ArrowRight size={20} className="text-[var(--gold)]" />
          </Link>
        )}

        <div className="elevated-card rounded-2xl p-5">
          <div className="grid grid-cols-4 gap-2">
            {QUICK_ACTIONS.map(({ href, Icon, label }) => (
              <Link key={href} href={href} className="flex flex-col items-center gap-2 group">
                <span className="w-12 h-12 rounded-full bg-[var(--gold-pale)] flex items-center justify-center text-[var(--gold)] group-hover:bg-[var(--gold)] group-hover:text-[#0f1626] transition-colors">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                <span className="text-[10px] text-center text-[#f0ece4] leading-tight font-medium">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <section className="elevated-card rounded-2xl p-6">
          <p className="eyebrow">Residence Details</p>
          <div className="gold-rule mt-2.5 mb-5" />
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="text-center">
              <BedDouble size={18} className="mx-auto mb-1.5 text-[var(--gold)]" strokeWidth={1.6} />
              <p className="font-display text-xl text-[#f0ece4]">{unit?.bedrooms ?? "—"}</p>
              <p className="text-[9px] text-[var(--muted)] uppercase tracking-wide mt-0.5">Bedrooms</p>
            </div>
            <div className="text-center border-x border-[var(--hairline)]">
              <Bath size={18} className="mx-auto mb-1.5 text-[var(--gold)]" strokeWidth={1.6} />
              <p className="font-display text-xl text-[#f0ece4]">{unit?.bathrooms ?? "—"}</p>
              <p className="text-[9px] text-[var(--muted)] uppercase tracking-wide mt-0.5">Bathrooms</p>
            </div>
            <div className="text-center">
              <Ruler size={18} className="mx-auto mb-1.5 text-[var(--gold)]" strokeWidth={1.6} />
              <p className="font-display text-xl text-[#f0ece4]">{unit?.sizeSqm ?? "—"}</p>
              <p className="text-[9px] text-[var(--muted)] uppercase tracking-wide mt-0.5">Sq. Meters</p>
            </div>
          </div>

          <div className="gold-divider mb-4" />

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Occupants</span>
              <span className="text-[#f0ece4] font-medium">{lease.occupantCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Parking</span>
              <span className="text-[#f0ece4] font-medium">{lease.parkingSpaceLabel ?? "Not assigned"}</span>
            </div>
          </div>

          {assets.length > 0 && (
            <>
              <p className="eyebrow mt-6">In-Residence Equipment</p>
              <div className="gold-rule mt-2.5 mb-3" />
              <ul className="space-y-2">
                {assets.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm text-[#f0ece4]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
                    {a.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
