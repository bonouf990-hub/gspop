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
import { KeyRound, Wrench, ClipboardList, Megaphone, ArrowRight, BedDouble, Bath, Ruler } from "lucide-react";

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

  const [{ data: unit }, { data: assets }, { data: invoices }, { data: photos }] = await Promise.all([
    supabase.from("units").select("*").eq("id", lease.unit_id).single(),
    supabase.from("assets").select("*").eq("unit_id", lease.unit_id),
    supabase
      .from("rent_invoices")
      .select("*")
      .eq("lease_id", lease.id)
      .order("due_date", { ascending: false })
      .limit(1),
    supabase.from("unit_photos").select("*").eq("unit_id", lease.unit_id).order("is_primary", { ascending: false }),
  ]);

  const primaryPhoto = photos?.[0] as { storage_path: string } | undefined;
  const photoUrl = primaryPhoto
    ? supabase.storage.from("unit-photos").getPublicUrl(primaryPhoto.storage_path).data.publicUrl
    : null;

  return {
    lease: camelCaseKeys<Lease>(lease),
    unit: unit ? camelCaseKeys<Unit>(unit) : null,
    assets: camelCaseKeys<Asset[]>(assets ?? []),
    nextInvoice: invoices?.[0] ? camelCaseKeys<RentInvoice>(invoices[0]) : null,
    photoUrl,
  };
}

const QUICK_ACTIONS = [
  { href: "/gate", Icon: KeyRound, label: "Gate" },
  { href: "/complaints/new", Icon: Wrench, label: "Report Issue" },
  { href: "/complaints", Icon: ClipboardList, label: "My Requests" },
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

  const { lease, unit, assets, nextInvoice, photoUrl } = data;
  const rentDue = nextInvoice && (nextInvoice.status === "pending" || nextInvoice.status === "overdue");

  return (
    <main className="min-h-screen pb-32 bg-[var(--background)]">
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
          <span className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold-soft)] font-medium">
            Golden Sands Residences
          </span>
          <div>
            <p className="text-xs tracking-[0.2em] uppercase text-white/55 mb-1.5">Welcome home</p>
            <h1 className="font-display text-white text-[2.75rem] leading-[1.05] font-semibold tracking-tight">
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
              <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold mb-1">
                {nextInvoice!.status === "overdue" ? "Payment Overdue" : "Payment Due"}
              </p>
              <p className="font-display text-2xl text-[var(--navy)]">{nextInvoice!.amount} AED</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">by {nextInvoice!.dueDate}</p>
            </div>
            <ArrowRight size={20} className="text-[var(--gold)]" />
          </Link>
        )}

        <div className="elevated-card rounded-2xl p-5">
          <div className="grid grid-cols-4 gap-2">
            {QUICK_ACTIONS.map(({ href, Icon, label }) => (
              <Link key={href} href={href} className="flex flex-col items-center gap-2 group">
                <span className="w-12 h-12 rounded-full bg-[var(--gold-pale)] flex items-center justify-center text-[var(--gold)] group-hover:bg-[var(--gold)] group-hover:text-white transition-colors">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                <span className="text-[10px] text-center text-[var(--navy)] leading-tight font-medium">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <section className="elevated-card rounded-2xl p-6">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold mb-5">
            Residence Details
          </p>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="text-center">
              <BedDouble size={18} className="mx-auto mb-1.5 text-[var(--gold)]" strokeWidth={1.6} />
              <p className="font-display text-xl text-[var(--navy)]">{unit?.bedrooms ?? "—"}</p>
              <p className="text-[9px] text-[var(--muted)] uppercase tracking-wide mt-0.5">Bedrooms</p>
            </div>
            <div className="text-center border-x border-[var(--hairline)]">
              <Bath size={18} className="mx-auto mb-1.5 text-[var(--gold)]" strokeWidth={1.6} />
              <p className="font-display text-xl text-[var(--navy)]">{unit?.bathrooms ?? "—"}</p>
              <p className="text-[9px] text-[var(--muted)] uppercase tracking-wide mt-0.5">Bathrooms</p>
            </div>
            <div className="text-center">
              <Ruler size={18} className="mx-auto mb-1.5 text-[var(--gold)]" strokeWidth={1.6} />
              <p className="font-display text-xl text-[var(--navy)]">{unit?.sizeSqm ?? "—"}</p>
              <p className="text-[9px] text-[var(--muted)] uppercase tracking-wide mt-0.5">Sq. Meters</p>
            </div>
          </div>

          <div className="gold-divider mb-4" />

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Occupants</span>
              <span className="text-[var(--navy)] font-medium">{lease.occupantCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Parking</span>
              <span className="text-[var(--navy)] font-medium">{lease.parkingSpaceLabel ?? "Not assigned"}</span>
            </div>
          </div>

          {assets.length > 0 && (
            <>
              <div className="gold-divider my-4" />
              <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold mb-3">
                In-Residence Equipment
              </p>
              <ul className="space-y-2">
                {assets.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm text-[var(--navy)]">
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
