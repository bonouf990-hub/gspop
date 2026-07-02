import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import SubmitInvoiceForm from "./SubmitInvoiceForm";

async function getVendorPOs() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, tenant_id")
    .eq("id", userData.user?.id ?? "")
    .single();

  if (!profile || profile.role !== "vendor") return null;

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name")
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!vendor) return null;

  const { data: pos } = await supabase
    .from("purchase_orders")
    .select("id, description, amount, status")
    .eq("vendor_id", vendor.id)
    .in("status", ["approved", "fulfilled"])
    .order("created_at", { ascending: false });

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    tenantId: profile.tenant_id,
    pos: (pos ?? []) as { id: string; description: string | null; amount: number; status: string }[],
  };
}

export default async function SubmitInvoicePage() {
  const data = await getVendorPOs();

  if (!data) {
    return (
      <main className="p-6 sm:p-8">
        <p className="text-[#8b97ab]">Vendor account not found.</p>
      </main>
    );
  }

  return (
    <main className="p-6 sm:p-8 max-w-2xl mx-auto">
      <Link href="/vendor-portal" className="text-sm text-[#5b6b85] hover:text-[#b01b42]">← Vendor Portal</Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-2">Submit Invoice</h1>
      <p className="text-[#5b6b85] mb-6">
        Submit an invoice against an approved purchase order for payment processing.
      </p>
      <SubmitInvoiceForm
        vendorId={data.vendorId}
        tenantId={data.tenantId}
        pos={data.pos}
      />
    </main>
  );
}
