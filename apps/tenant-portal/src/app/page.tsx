import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import {
  camelCaseKeys,
  type Asset,
  type Lease,
  type RentInvoice,
  type Unit,
  type UnitPhoto,
} from "@gspop/shared";

// RLS on `leases` and `rent_invoices` already restricts a resident to their
// own rows — this query is identical for every tenant, the database enforces
// "you only see your own apartment," not app code.
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
  { href: "/gate", icon: "🚪", label: "Gate" },
  { href: "/complaints/new", icon: "🛠️", label: "Report an Issue" },
  { href: "/complaints", icon: "📋", label: "My Requests" },
  { href: "/rent", icon: "💳", label: "Rent & Payments" },
  { href: "/notices", icon: "📣", label: "Building Notices" },
];

export default async function HomePage() {
  const data = await getMyApartment();

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#0B1320] text-white">
        <p className="text-gray-500 text-center">No active lease found for your account.</p>
      </main>
    );
  }

  const { lease, unit, assets, nextInvoice, photoUrl } = data;
  const rentDue = nextInvoice && (nextInvoice.status === "pending" || nextInvoice.status === "overdue");

  return (
    <main className="min-h-screen bg-[#0B1320] text-white pb-24">
      {/* Hero: real apartment photo when available, otherwise a warm gradient */}
      <div
        className="relative h-56 w-full bg-cover bg-center"
        style={{
          backgroundImage: photoUrl
            ? `linear-gradient(to top, rgba(11,19,32,0.95), rgba(11,19,32,0.15)), url(${photoUrl})`
            : "linear-gradient(135deg, #1d3a63 0%, #0B1320 100%)",
        }}
      >
        {!photoUrl && (
          <div className="absolute inset-0 flex items-center justify-center opacity-20 text-8xl">🏢</div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <p className="text-sm text-blue-200">Welcome home</p>
          <h1 className="text-3xl font-bold tracking-tight">{unit?.label ?? "Your Apartment"}</h1>
        </div>
      </div>

      <div className="px-4 -mt-2 relative z-10">
        {rentDue && (
          <Link
            href="/rent"
            className={`mb-4 flex items-center justify-between rounded-2xl p-4 shadow-lg ${
              nextInvoice!.status === "overdue" ? "bg-red-600" : "bg-amber-600"
            }`}
          >
            <div>
              <p className="font-semibold">
                {nextInvoice!.status === "overdue" ? "Rent overdue" : "Rent due"}
              </p>
              <p className="text-sm opacity-90">
                {nextInvoice!.amount} AED due {nextInvoice!.dueDate}
              </p>
            </div>
            <span className="text-2xl">→</span>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="bg-[#162335] rounded-2xl p-5 text-center hover:bg-[#1c2c45] transition-colors"
            >
              <p className="text-3xl mb-2">{action.icon}</p>
              <p className="font-medium text-sm">{action.label}</p>
            </Link>
          ))}
        </div>

        <section className="mt-6 bg-[#162335] rounded-2xl p-5">
          <h2 className="font-semibold mb-4">My Apartment</h2>
          <div className="grid grid-cols-3 gap-3 mb-4 text-center">
            <div className="bg-[#0B1320] rounded-xl p-3">
              <p className="text-lg font-bold">{unit?.bedrooms ?? "—"}</p>
              <p className="text-xs text-gray-400">Bedrooms</p>
            </div>
            <div className="bg-[#0B1320] rounded-xl p-3">
              <p className="text-lg font-bold">{unit?.bathrooms ?? "—"}</p>
              <p className="text-xs text-gray-400">Bathrooms</p>
            </div>
            <div className="bg-[#0B1320] rounded-xl p-3">
              <p className="text-lg font-bold">{unit?.sizeSqm ?? "—"}</p>
              <p className="text-xs text-gray-400">sqm</p>
            </div>
          </div>
          <p className="text-sm text-gray-300">Occupants: {lease.occupantCount}</p>
          <p className="text-sm text-gray-300 mt-1">Parking: {lease.parkingSpaceLabel ?? "Not assigned"}</p>
          <p className="text-sm text-gray-400 mt-4 mb-2">Equipment</p>
          <ul className="space-y-1">
            {assets.map((a) => (
              <li key={a.id} className="text-sm text-gray-300 flex items-center gap-2">
                <span className="text-gray-500">•</span> {a.name}
              </li>
            ))}
            {assets.length === 0 && <li className="text-sm text-gray-500">None registered</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
