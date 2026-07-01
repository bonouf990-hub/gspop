import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

// Onboards a resident: creates their login, a resident profile, and an active
// lease (with rent terms) tying them to a unit. Admin/manager only.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from("user_profiles")
    .select("role, tenant_id")
    .eq("id", userData.user.id)
    .single();

  if (!callerProfile || !["tenant_admin", "property_manager"].includes(callerProfile.role)) {
    return NextResponse.json({ error: "Not authorized to create residents" }, { status: 403 });
  }

  const body = await request.json();
  const {
    email,
    password,
    fullName,
    phone,
    unitId,
    startDate,
    endDate,
    occupantCount,
    rentAmount,
    rentFrequency,
    depositAmount,
    parkingSpaceLabel,
  } = body as {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    unitId: string;
    startDate: string;
    endDate?: string | null;
    occupantCount?: number;
    rentAmount?: number | null;
    rentFrequency?: string | null;
    depositAmount?: number | null;
    parkingSpaceLabel?: string | null;
  };

  if (!email || !password || !fullName || !unitId || !startDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Guard: the unit must belong to the caller's tenant.
  const { data: unit } = await admin
    .from("units")
    .select("id, property_id, properties(tenant_id)")
    .eq("id", unitId)
    .single();
  const unitTenant = (unit as unknown as { properties: { tenant_id: string } } | null)?.properties?.tenant_id;
  if (!unit || unitTenant !== callerProfile.tenant_id) {
    return NextResponse.json({ error: "Unit not found in your portfolio" }, { status: 400 });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? "Failed to create user" }, { status: 400 });
  }

  const { error: profileError } = await admin.from("user_profiles").insert({
    id: created.user.id,
    tenant_id: callerProfile.tenant_id,
    full_name: fullName,
    role: "resident",
    phone: phone ?? null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { data: lease, error: leaseError } = await admin
    .from("leases")
    .insert({
      unit_id: unitId,
      primary_resident_id: created.user.id,
      tenant_full_name: fullName,
      start_date: startDate,
      end_date: endDate || null,
      occupant_count: occupantCount ?? 1,
      status: "active",
      rent_amount: rentAmount ?? null,
      rent_frequency: rentFrequency || null,
      deposit_amount: depositAmount ?? null,
      parking_space_label: parkingSpaceLabel || null,
    })
    .select("id")
    .single();
  if (leaseError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: leaseError.message }, { status: 400 });
  }

  return NextResponse.json({ id: created.user.id, leaseId: lease.id });
}
