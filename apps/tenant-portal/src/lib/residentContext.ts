import { createClient } from "@/lib/supabase-browser";

// Resolves the logged-in resident's unit/property/tenant chain, needed to
// stamp new records (visitors, complaints) with the right foreign keys
// since RLS requires they match the resident's own tenant/property.
export async function getResidentContext() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const residentId = userData.user?.id;

  const { data: lease } = await supabase
    .from("leases")
    .select("unit_id, units(property_id, properties(tenant_id))")
    .eq("primary_resident_id", residentId)
    .eq("status", "active")
    .single();

  const unit = lease?.units as unknown as { property_id: string; properties: { tenant_id: string } } | null;

  return {
    residentId: residentId ?? null,
    unitId: lease?.unit_id ?? null,
    propertyId: unit?.property_id ?? null,
    tenantId: unit?.properties?.tenant_id ?? null,
  };
}
