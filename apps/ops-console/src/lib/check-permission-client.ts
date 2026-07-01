import { createClient } from "./supabase-browser";

type PermissionResult = {
  allowed: boolean;
  requiresApproval: boolean;
  maxAmount: number | null;
};

export async function checkPermissionClient(
  module: string,
  action: string,
  amount?: number
): Promise<PermissionResult> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { allowed: false, requiresApproval: false, maxAmount: null };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (!profile) {
    return { allowed: false, requiresApproval: false, maxAmount: null };
  }

  if (profile.role === "super_admin") {
    return { allowed: true, requiresApproval: false, maxAmount: null };
  }

  const { data: rule } = await supabase
    .from("workflow_rules")
    .select("allowed_roles, max_amount, requires_approval_above, is_active")
    .eq("module", module)
    .eq("action", action)
    .single();

  if (!rule) {
    return { allowed: true, requiresApproval: false, maxAmount: null };
  }

  if (!rule.is_active) {
    return { allowed: false, requiresApproval: false, maxAmount: null };
  }

  const allowed = (rule.allowed_roles as string[]).includes(profile.role);
  if (!allowed) {
    return { allowed: false, requiresApproval: false, maxAmount: null };
  }

  const maxAmount = rule.max_amount ? Number(rule.max_amount) : null;
  const approvalThreshold = rule.requires_approval_above ? Number(rule.requires_approval_above) : null;

  if (maxAmount !== null && amount !== undefined && amount > maxAmount) {
    return { allowed: false, requiresApproval: true, maxAmount };
  }

  const requiresApproval = approvalThreshold !== null && amount !== undefined && amount > approvalThreshold;

  return { allowed: true, requiresApproval, maxAmount };
}
