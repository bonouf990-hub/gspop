import { createClient } from "./supabase-server";

const MANAGEMENT_ROLES = ["super_admin", "tenant_admin", "property_manager", "supervisor"];

export async function requireManagementRole(): Promise<{ allowed: true; role: string } | { allowed: false }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { allowed: false };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (!profile || !MANAGEMENT_ROLES.includes(profile.role)) return { allowed: false };
  return { allowed: true, role: profile.role };
}

type PermissionResult = {
  allowed: boolean;
  requiresApproval: boolean;
  maxAmount: number | null;
  approvalThreshold: number | null;
};

export async function checkPermission(
  module: string,
  action: string,
  amount?: number
): Promise<PermissionResult> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { allowed: false, requiresApproval: false, maxAmount: null, approvalThreshold: null };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (!profile) {
    return { allowed: false, requiresApproval: false, maxAmount: null, approvalThreshold: null };
  }

  const role = profile.role;

  // Super admins and tenant admins always have access
  if (role === "super_admin") {
    return { allowed: true, requiresApproval: false, maxAmount: null, approvalThreshold: null };
  }

  const { data: rule } = await supabase
    .from("workflow_rules")
    .select("allowed_roles, max_amount, requires_approval_above, is_active")
    .eq("module", module)
    .eq("action", action)
    .single();

  // No rule configured = allow by default for backward compatibility
  if (!rule) {
    return { allowed: true, requiresApproval: false, maxAmount: null, approvalThreshold: null };
  }

  if (!rule.is_active) {
    return { allowed: false, requiresApproval: false, maxAmount: null, approvalThreshold: null };
  }

  const allowed = (rule.allowed_roles as string[]).includes(role);
  const maxAmount = rule.max_amount ? Number(rule.max_amount) : null;
  const approvalThreshold = rule.requires_approval_above ? Number(rule.requires_approval_above) : null;

  if (!allowed) {
    return { allowed: false, requiresApproval: false, maxAmount, approvalThreshold };
  }

  // Check if amount exceeds max
  if (maxAmount !== null && amount !== undefined && amount > maxAmount) {
    return { allowed: false, requiresApproval: true, maxAmount, approvalThreshold };
  }

  // Check if amount requires approval
  const requiresApproval = approvalThreshold !== null && amount !== undefined && amount > approvalThreshold;

  return { allowed: true, requiresApproval, maxAmount, approvalThreshold };
}

export async function getPermittedActions(
  module: string
): Promise<Map<string, PermissionResult>> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Map();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (!profile) return new Map();

  if (profile.role === "super_admin") {
    const { data: rules } = await supabase
      .from("workflow_rules")
      .select("action, max_amount, requires_approval_above")
      .eq("module", module);

    const result = new Map<string, PermissionResult>();
    for (const r of rules ?? []) {
      result.set(r.action, {
        allowed: true,
        requiresApproval: false,
        maxAmount: r.max_amount ? Number(r.max_amount) : null,
        approvalThreshold: r.requires_approval_above ? Number(r.requires_approval_above) : null,
      });
    }
    return result;
  }

  const { data: rules } = await supabase
    .from("workflow_rules")
    .select("action, allowed_roles, max_amount, requires_approval_above, is_active")
    .eq("module", module);

  const result = new Map<string, PermissionResult>();
  for (const rule of rules ?? []) {
    if (!rule.is_active) {
      result.set(rule.action, { allowed: false, requiresApproval: false, maxAmount: null, approvalThreshold: null });
      continue;
    }
    const allowed = (rule.allowed_roles as string[]).includes(profile.role);
    result.set(rule.action, {
      allowed,
      requiresApproval: false,
      maxAmount: rule.max_amount ? Number(rule.max_amount) : null,
      approvalThreshold: rule.requires_approval_above ? Number(rule.requires_approval_above) : null,
    });
  }
  return result;
}
