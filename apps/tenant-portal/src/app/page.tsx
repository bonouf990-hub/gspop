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
  { href: "/gate", icon: "⚿", label: "Gate" },
  { href: "/complaints/new", icon: "✦", label: "Report an Issue" },
  { href: "/complaints", icon: "▤", label: "My Requests" },
  { href: "/notices", icon: "♫", label: "Notices" },
];

export default async function HomePage() {
  const data = await getMyApartment();

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#0A0E18] text-[#F4EFE6]">
        <p className="text-gray-500 text-center">No active lease found for your account.</p>
      </main>
    );
  }

  const { lease, unit, assets, nextInvoice, photoUrl } = data;
  const rentDue = nextInvoice && (nextInvoice.status === "pending" || nextInvoice.status === "overdue");

  return (
    <main className="min-h-screen pb-32">
      {/* Hero */}
      <div
        className="relative h-72 w-full bg-cover bg-center"
        style={{
          backgroundImage: photoUrl
            ? `linear-gradient(to top, #0A0E18 0%, rgba(10,14,24,0.25) 60%, rgba(10,14,24,0.05) 100%), url(${photoUrl})`
            : "radial-gradient(circle at 30% 20%, #2a3a5c 0%, #0A0E18 70%)",
        }}
      >
        <div className="absolute inset-0 flex flex-col justify-between p-6">
          <div className="flex justify-between items-start">
            <span className="text-[10px] tracking-[0.25em] uppercase text-[var(--gold-soft)]">
              Golden Sands Residences
            </span>
          </div>
          <div>
            <p className="text-xs tracking-[0.2em] uppercase text-[#B9C0D0] mb-1">Welcome home</p>
            <h1 className="font-display text-4xl font-semibold tracking-tight">{unit?.label ?? "—"}</h1>
            <div className="gold-divider w-16 mt-3" />
          </div>
        </div>
      </div>

      <div className="px-5 -mt-8 relative z-10 space-y-5">
        {rentDue && (
          <Link
            href="/rent"
            className="glass-card rounded-2xl p-5 flex items-center justify-between shadow-xl shadow-black/30"
          >
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold-soft)] mb-1">
                {nextInvoice!.status === "overdue" ? "Payment Overdue" : "Payment Due"}
              </p>
              <p className="font-display text-2xl">{nextInvoice!.amount} AED</p>
              <p className="text-xs text-[#8B94A8] mt-0.5">by {nextInvoice!.dueDate}</p>
            </div>
            <span className="text-[var(--gold)] text-xl">→</span>
          </Link>
        )}

        <div>
          <div className="grid grid-cols-4 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <Link key={action.href} href={action.href} className="flex flex-col items-center gap-2">
                <span className="w-14 h-14 rounded-full glass-card flex items-center justify-center text-xl text-[var(--gold)]">
                  {action.icon}
                </span>
                <span className="text-[10px] text-center text-[#B9C0D0] leading-tight">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <section className="glass-card rounded-2xl p-6">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold-soft)] mb-4">
            Residence Details
          </p>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="text-center">
              <p className="font-display text-2xl">{unit?.bedrooms ?? "—"}</p>
              <p className="text-[10px] text-[#8B94A8] uppercase tracking-wide mt-1">Bedrooms</p>
            </div>
            <div className="text-center border-x border-[var(--hairline)]">
              <p className="font-display text-2xl">{unit?.bathrooms ?? "—"}</p>
              <p className="text-[10px] text-[#8B94A8] uppercase tracking-wide mt-1">Bathrooms</p>
            </div>
            <div className="text-center">
              <p className="font-display text-2xl">{unit?.sizeSqm ?? "—"}</p>
              <p className="text-[10px] text-[#8B94A8] uppercase tracking-wide mt-1">Sq. Meters</p>
            </div>
          </div>

          <div className="gold-divider mb-4" />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#8B94A8]">Occupants</span>
              <span>{lease.occupantCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8B94A8]">Parking</span>
              <span>{lease.parkingSpaceLabel ?? "Not assigned"}</span>
            </div>
          </div>

          {assets.length > 0 && (
            <>
              <div className="gold-divider my-4" />
              <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold-soft)] mb-3">
                In-Residence Equipment
              </p>
              <ul className="space-y-2">
                {assets.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm text-[#D8DCE6]">
                    <span className="w-1 h-1 rounded-full bg-[var(--gold)]" />
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
