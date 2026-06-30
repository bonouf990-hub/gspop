import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type RentInvoice } from "@gspop/shared";

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

function statusColor(status: RentInvoice["status"]) {
  if (status === "overdue") return "text-red-400";
  if (status === "pending") return "text-amber-400";
  return "text-green-400";
}

export default async function RentPage() {
  const invoices = await getMyInvoices();

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--navy)] p-6">
      <h1 className="text-xl font-bold mb-4">Rent & Payments</h1>
      <ul className="space-y-3">
        {invoices.map((i) => (
          <li key={i.id} className="bg-white border border-[var(--hairline)] rounded-xl p-4 flex justify-between">
            <div>
              <p className="font-medium">{i.amount}</p>
              <p className="text-sm text-[var(--muted)]">Due {i.dueDate}</p>
            </div>
            <p className={`font-medium ${statusColor(i.status)}`}>{i.status}</p>
          </li>
        ))}
        {invoices.length === 0 && <p className="text-[var(--muted)]">No invoices yet.</p>}
      </ul>
    </main>
  );
}
