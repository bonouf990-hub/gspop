import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type RentInvoice } from "@gspop/shared";
import BottomNav from "@/components/BottomNav";
import { CreditCard } from "lucide-react";

async function getMyInvoices(): Promise<RentInvoice[]> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: lease } = await supabase
    .from("leases")
    .select("id")
    .eq("primary_resident_id", userData.user?.id)
    .eq("status", "active")
    .single();
  if (!lease) return [];
  const { data } = await supabase
    .from("rent_invoices")
    .select("*")
    .eq("lease_id", lease.id)
    .order("due_date", { ascending: false });
  return camelCaseKeys<RentInvoice[]>(data ?? []);
}

const STATUS_STYLE: Record<string, string> = {
  overdue: "bg-[#FBE6E6] text-[#B23B3B]",
  pending: "bg-[var(--gold-pale)] text-[#8a6a1f]",
  paid: "bg-[#E3F2E8] text-[#1F7A45]",
  waived: "bg-[#F1EFE8] text-[var(--muted)]",
};

export default async function RentPage() {
  const invoices = await getMyInvoices();

  return (
    <main className="min-h-screen bg-[var(--background)] pb-32">
      <div className="px-6 pt-10 pb-6">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1.5">
          Account
        </p>
        <h1 className="font-display text-3xl text-[var(--navy)] font-semibold">Rent & Payments</h1>
      </div>

      <div className="px-5">
        <section className="elevated-card rounded-2xl p-5">
          <ul className="space-y-3">
            {invoices.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between pb-3 border-b border-[var(--hairline)] last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-display text-lg text-[var(--navy)]">{i.amount} AED</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">Due {i.dueDate}</p>
                </div>
                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[i.status]}`}>
                  {i.status}
                </span>
              </li>
            ))}
            {invoices.length === 0 && (
              <div className="text-center py-8">
                <CreditCard size={28} className="mx-auto mb-2 text-[var(--gold)]" strokeWidth={1.5} />
                <p className="text-[var(--muted)] text-sm">No invoices yet.</p>
              </div>
            )}
          </ul>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
