import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type RentInvoice } from "@gspop/shared";
import { ChevronLeft, Check } from "lucide-react";
import PrintButton from "./PrintButton";

async function getReceipt(id: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: invoiceRow } = await supabase.from("rent_invoices").select("*").eq("id", id).single();
  if (!invoiceRow || invoiceRow.status !== "paid") return null;

  const { data: lease } = await supabase
    .from("leases")
    .select("id, primary_resident_id, tenant_full_name, unit_id, units(label, property_id, properties(name))")
    .eq("id", invoiceRow.lease_id)
    .single();

  // Only the resident on this lease may view their receipt.
  if (!lease || lease.primary_resident_id !== userData.user?.id) return null;

  const unit = lease.units as unknown as { label: string; properties: { name: string } } | null;

  return {
    invoice: camelCaseKeys<RentInvoice>(invoiceRow),
    residentName: lease.tenant_full_name as string,
    unitLabel: unit?.label ?? null,
    propertyName: unit?.properties?.name ?? null,
  };
}

function receiptNo(id: string): string {
  return "GS-" + id.slice(0, 8).toUpperCase();
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getReceipt(id);

  if (!data) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-[var(--muted)] text-center mb-4">Receipt not available.</p>
        <Link href="/rent" className="text-[var(--gold)] text-sm font-medium">
          Back to rent
        </Link>
      </main>
    );
  }

  const { invoice, residentName, unitLabel, propertyName } = data;
  const paidDate = invoice.clearedAt ?? invoice.paidAt;

  return (
    <main className="min-h-screen pb-32">
      <div className="px-6 pt-10 pb-4 print:hidden">
        <Link href="/rent" className="inline-flex items-center text-[var(--muted)] text-sm">
          <ChevronLeft size={16} /> Rent
        </Link>
      </div>

      <div className="px-5">
        <section className="elevated-card rounded-2xl overflow-hidden">
          <div className="bg-[#0F1626] border-b border-[rgba(176,27,66,0.15)] px-6 py-6">
            <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold-soft)] font-medium mb-1">
              Golden Sands Residences
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-8 h-8 rounded-full bg-[rgba(45,140,90,0.3)] text-[#5cc98a] flex items-center justify-center">
                <Check size={16} />
              </span>
              <h1 className="font-display text-white text-2xl font-semibold">Payment Receipt</h1>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted)]">Receipt No.</span>
              <span className="text-[#eef1f6] font-medium">{receiptNo(invoice.id)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted)]">Date</span>
              <span className="text-[#eef1f6] font-medium">
                {paidDate ? new Date(paidDate).toLocaleDateString() : "—"}
              </span>
            </div>

            <div className="gold-divider" />

            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted)]">Received from</span>
              <span className="text-[#eef1f6] font-medium">{residentName}</span>
            </div>
            {propertyName && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted)]">Property</span>
                <span className="text-[#eef1f6] font-medium">{propertyName}</span>
              </div>
            )}
            {unitLabel && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted)]">Unit</span>
                <span className="text-[#eef1f6] font-medium">{unitLabel}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted)]">Method</span>
              <span className="text-[#eef1f6] font-medium capitalize">
                {invoice.paymentMethod ?? "Cheque"}
                {invoice.chequeNumber ? ` · ${invoice.chequeNumber}` : ""}
              </span>
            </div>
            {invoice.chequeBank && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted)]">Bank</span>
                <span className="text-[#eef1f6] font-medium">{invoice.chequeBank}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted)]">Due date</span>
              <span className="text-[#eef1f6] font-medium">{invoice.dueDate}</span>
            </div>

            <div className="gold-divider" />

            <div className="flex justify-between items-end">
              <span className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold">
                Amount Paid
              </span>
              <span className="font-display text-3xl text-[#eef1f6]">{invoice.amount} AED</span>
            </div>
          </div>
        </section>

        <div className="mt-5">
          <PrintButton />
        </div>
      </div>
    </main>
  );
}
