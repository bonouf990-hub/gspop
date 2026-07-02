import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkflowCheck = {
  allowed: boolean;
  reason: string | null;
  requiresApprovalAbove: number | null;
  maxAmount: number | null;
};

const PASS: WorkflowCheck = {
  allowed: true,
  reason: null,
  requiresApprovalAbove: null,
  maxAmount: null,
};

/**
 * Checks the caller's action against the tenant's workflow_rules
 * (configured in /admin/workflows). RLS scopes rules to the tenant.
 * If no active rule exists for (module, action), the action is allowed
 * (backwards compatible).
 */
export async function checkWorkflow(
  supabase: SupabaseClient,
  module: string,
  action: string,
  opts?: { amount?: number }
): Promise<WorkflowCheck> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return { ...PASS, allowed: false, reason: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .single();
  const role = (profile?.role as string | undefined) ?? null;

  const { data: rule } = await supabase
    .from("workflow_rules")
    .select("allowed_roles, max_amount, requires_approval_above, is_active")
    .eq("module", module)
    .eq("action", action)
    .maybeSingle();

  if (!rule || !rule.is_active) return PASS;

  const maxAmount = rule.max_amount != null ? Number(rule.max_amount) : null;
  const requiresApprovalAbove =
    rule.requires_approval_above != null ? Number(rule.requires_approval_above) : null;

  if (role !== "super_admin") {
    const allowedRoles = (rule.allowed_roles as string[] | null) ?? [];
    if (!role || !allowedRoles.includes(role)) {
      return {
        allowed: false,
        reason: `Your role (${role ?? "unknown"}) is not permitted to ${action.replace(/_/g, " ")} in ${module.replace(/_/g, " ")} — configured in Workflow Configuration`,
        requiresApprovalAbove,
        maxAmount,
      };
    }

    if (
      opts?.amount !== undefined &&
      maxAmount !== null &&
      opts.amount > maxAmount
    ) {
      return {
        allowed: false,
        reason: `Amount exceeds the AED ${maxAmount.toLocaleString()} limit for your role`,
        requiresApprovalAbove,
        maxAmount,
      };
    }
  }

  return { allowed: true, reason: null, requiresApprovalAbove, maxAmount };
}
