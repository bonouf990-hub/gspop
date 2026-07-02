import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import RenewalActions from "./RenewalActions";

type LeaseRow = {
  id: string;
  tenant_full_name: string;
  status: string;
  rent_amount: number | null;
  rent_frequency: string | null;
  start_date: string;
  end_date: string | null;
  renewal_status: string | null;
  renewal_notice_sent_at: string | null;
  renewal_notes: string | null;
  units: { label: string; properties: { name: string } | null } | null;
};

async function getRenewalsData() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userData.user?.id ?? "")
    .single();

  if (!profile || !["tenant_admin", "property_manager"].includes(profile.role)) {
    return null;
  }

  const { data: leases } = await supabase
    .from("leases")
    .select(
      "id, tenant_full_name, status, rent_amount, rent_frequency, start_date, end_date, renewal_status, renewal_notice_sent_at, renewal_notes, units(label, properties(name))"
    )
    .eq("status", "active")
    .not("end_date", "is", null)
    .order("end_date", { ascending: true });

  return { leases: (leases ?? []) as unknown as LeaseRow[] };
}

const RENEWAL_STATUS_STYLE: Record<string, { bg: string; label: string }> = {
  not_started: { bg: "bg-[#213052] text-[#a0977e]", label: "Not Started" },
  notice_sent: { bg: "bg-blue-900/50 text-blue-300", label: "Notice Sent" },
  negotiating: { bg: "bg-amber-900/50 text-amber-300", label: "Negotiating" },
  renewed: { bg: "bg-green-900/50 text-green-300", label: "Renewed" },
  not_renewing: { bg: "bg-red-900/50 text-red-300", label: "Not Renewing" },
  expired: { bg: "bg-[#213052] text-[#6b6454]", label: "Expired" },
};

export default async function LeaseRenewalsPage() {
  const data = await getRenewalsData();

  if (!data) {
    return <main className="p-8"><p className="text-[#6b6454]">Not authorized.</p></main>;
  }

  const { leases } = data;
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const urgent = leases.filter((l) => l.end_date && new Date(l.end_date) <= thirtyDays);
  const upcoming = leases.filter(
    (l) => l.end_date && new Date(l.end_date) > thirtyDays && new Date(l.end_date) <= ninetyDays
  );
  const later = leases.filter((l) => l.end_date && new Date(l.end_date) > ninetyDays);

  const needsAction = leases.filter(
    (l) => !l.renewal_status || l.renewal_status === "not_started"
  );

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin/residents" className="text-sm text-[#a0977e] hover:text-[#b8902f]">
            ← Residents & Leases
          </Link>
          <h1 className="text-2xl font-extrabold mt-1">Lease Renewals</h1>
          <p className="text-[#a0977e] text-sm mt-1">
            Track upcoming expirations and manage renewal workflows.
          </p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="lux-card p-4 text-center">
          <p className="text-xl font-extrabold text-[#d4af5a]">{leases.length}</p>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">Active with End Date</p>
        </div>
        <div className="border border-red-500/30 bg-red-950/20 rounded-xl p-4 text-center">
          <p className="text-xl font-extrabold text-red-400">{urgent.length}</p>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">Expiring ≤ 30 Days</p>
        </div>
        <div className="border border-amber-500/30 bg-amber-950/20 rounded-xl p-4 text-center">
          <p className="text-xl font-extrabold text-amber-400">{upcoming.length}</p>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">Expiring 31–90 Days</p>
        </div>
        <div className="lux-card p-4 text-center">
          <p className="text-xl font-extrabold text-amber-400">{needsAction.length}</p>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">Needs Action</p>
        </div>
      </div>

      {/* Urgent Section */}
      {urgent.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-bold text-red-400 tracking-[0.15em] uppercase mb-3">
            Urgent — Expiring Within 30 Days ({urgent.length})
          </h2>
          <LeaseTable leases={urgent} now={now} />
        </section>
      )}

      {/* Upcoming Section */}
      {upcoming.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-bold text-amber-400 tracking-[0.15em] uppercase mb-3">
            Upcoming — 31 to 90 Days ({upcoming.length})
          </h2>
          <LeaseTable leases={upcoming} now={now} />
        </section>
      )}

      {/* Later */}
      {later.length > 0 && (
        <section className="mb-6">
          <h2 className="eyebrow mb-3">
            Future — 90+ Days ({later.length})
          </h2>
          <LeaseTable leases={later} now={now} />
        </section>
      )}

      {leases.length === 0 && (
        <p className="text-[#6b6454] text-center py-8">No active leases with end dates found.</p>
      )}
    </main>
  );
}

function LeaseTable({ leases, now }: { leases: LeaseRow[]; now: Date }) {
  return (
    <div className="space-y-2">
      {leases.map((l) => {
        const unit = l.units as { label: string; properties: { name: string } | null } | null;
        const daysLeft = l.end_date
          ? Math.floor((new Date(l.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const statusStyle = RENEWAL_STATUS_STYLE[l.renewal_status ?? "not_started"] ?? RENEWAL_STATUS_STYLE.not_started;

        return (
          <div key={l.id} className="lux-card p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-bold">{l.tenant_full_name}</p>
                <p className="text-xs text-[#a0977e]">
                  {unit?.properties?.name ? `${unit.properties.name} — ` : ""}{unit?.label ?? "—"}
                  {l.rent_amount && ` · ${l.rent_amount} AED${l.rent_frequency ? `/${l.rent_frequency}` : ""}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyle.bg}`}>
                  {statusStyle.label}
                </span>
                {daysLeft !== null && (
                  <span className={`text-xs font-bold ${
                    daysLeft <= 30 ? "text-red-400" : daysLeft <= 60 ? "text-amber-400" : "text-[#a0977e]"
                  }`}>
                    {daysLeft}d left
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#6b6454] mb-2">
              <span>Start: {l.start_date}</span>
              <span>End: {l.end_date}</span>
              {l.renewal_notice_sent_at && (
                <span className="text-blue-400">
                  Notice sent: {new Date(l.renewal_notice_sent_at).toLocaleDateString()}
                </span>
              )}
            </div>
            {l.renewal_notes && (
              <p className="text-xs text-[#a0977e] mb-2">{l.renewal_notes}</p>
            )}
            <RenewalActions
              leaseId={l.id}
              currentStatus={l.renewal_status ?? "not_started"}
              residentName={l.tenant_full_name}
            />
          </div>
        );
      })}
    </div>
  );
}
