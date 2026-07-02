import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type Lease, type RentInvoice } from "@gspop/shared";
import BottomNav from "@/components/BottomNav";
import { CreditCard, ChevronRight } from "lucide-react";

async function getRent(): Promise<{ lease: Lease | null; invoices: RentInvoice[] }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: leaseRow } = await supabase
    .from("leases")
    .select("*")
    .eq("primary_resident_id", userData.user?.id)
    .eq("status", "active")
    .single();
  if (!leaseRow) return { lease: null, invoices: [] };
  const { data } = await supabase
    .from("rent_invoices")
    .select("*")
    .eq("lease_id", leaseRow.id)
    .order("due_date", { ascending: false });
  return {
    lease: camelCaseKeys<Lease>(leaseRow),
    invoices: camelCaseKeys<RentInvoice[]>(data ?? []),
  };
}

const STATUS_STYLE: Record<string, string> = {
  overdue: "bg-[rgba(180,60,60,0.15)] text-[#e08a8a]",
  pending: "bg-[rgba(184,144,47,0.15)] text-[#d4af5a]",
  paid: "bg-[rgba(45,140,90,0.15)] text-[#5cc98a]",
  waived: "bg-[rgba(255,255,255,0.06)] text-[#a0977e]",
};

const STATUS_LABEL: Record<string, string> = {
  overdue: "Overdue",
  pending: "Upcoming",
  paid: "Cleared",
  waived: "Waived",
};

const DEPOSIT_LABEL: Record<string, string> = {
  held: "Held",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
  forfeited: "Forfeited",
};

export default async function RentPage() {
  const { lease, invoices } = await getRent();

  return (
    <main className="min-h-screen bg-[var(--background)] pb-32">
      <div className="px-6 pt-10 pb-6">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1.5">
          Account
        </p>
        <h1 className="font-display text-3xl text-[#f0ece4] font-semibold">Rent & Payments</h1>
      </div>

      <div className="px-5 space-y-5">
        {/* Lease terms */}
        {lease && (
          <section className="elevated-card rounded-2xl p-6">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold mb-4">
              Your Tenancy
            </p>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Rent</span>
                <span className="text-[#f0ece4] font-medium">
                  {lease.rentAmount != null ? `${lease.rentAmount} AED` : "—"}
                  {lease.rentFrequency ? ` / ${lease.rentFrequency}` : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Security deposit</span>
                <span className="text-[#f0ece4] font-medium">
                  {lease.depositAmount != null ? `${lease.depositAmount} AED` : "—"}
                  <span className="text-[var(--muted)] font-normal">
                    {" "}({DEPOSIT_LABEL[lease.depositStatus] ?? lease.depositStatus})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Lease period</span>
                <span className="text-[#f0ece4] font-medium">
                  {lease.startDate}
                  {lease.endDate ? ` – ${lease.endDate}` : ""}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-4 leading-relaxed">
              Rent is collected by the post-dated cheques held under your tenancy contract. Each
              row below is one cheque in the schedule; it shows as <span className="font-medium">Cleared</span> once
              the cheque is deposited.
            </p>
          </section>
        )}

        {/* Cheque schedule */}
        <section className="elevated-card rounded-2xl p-5">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold mb-3 px-1">
            Payment Schedule
          </p>
          <ul className="space-y-1">
            {invoices.map((i) => {
              const cleared = i.status === "paid";
              const row = (
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-display text-lg text-[#f0ece4]">{i.amount} AED</p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      Due {i.dueDate}
                      {i.chequeNumber ? ` · Cheque ${i.chequeNumber}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[i.status]}`}>
                      {STATUS_LABEL[i.status] ?? i.status}
                    </span>
                    {cleared && <ChevronRight size={16} className="text-[#6b6454]" />}
                  </div>
                </div>
              );
              return (
                <li key={i.id} className="border-b border-[var(--hairline)] last:border-0">
                  {cleared ? (
                    <Link href={`/rent/${i.id}`} className="block first:pt-0">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
            {invoices.length === 0 && (
              <div className="text-center py-8">
                <CreditCard size={28} className="mx-auto mb-2 text-[var(--gold)]" strokeWidth={1.5} />
                <p className="text-[var(--muted)] text-sm">No payment schedule yet.</p>
              </div>
            )}
          </ul>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
