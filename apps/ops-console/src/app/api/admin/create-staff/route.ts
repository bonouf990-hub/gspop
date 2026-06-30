import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

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
    return NextResponse.json({ error: "Not authorized to create staff" }, { status: 403 });
  }

  const body = await request.json();
  const { email, password, fullName, role, department, jobTitle, reportsToId, propertyIds } = body as {
    email: string;
    password: string;
    fullName: string;
    role: string;
    department?: string;
    jobTitle?: string;
    reportsToId?: string | null;
    propertyIds?: string[];
  };

  if (!email || !password || !fullName || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();

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
    role,
    department: department ?? null,
    job_title: jobTitle ?? null,
    reports_to_id: reportsToId ?? null,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (propertyIds && propertyIds.length > 0) {
    await admin.from("property_assignments").insert(
      propertyIds.map((propertyId) => ({ user_id: created.user!.id, property_id: propertyId }))
    );
  }

  return NextResponse.json({ id: created.user.id });
}
