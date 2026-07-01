import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import WorkflowRuleEditor from "./WorkflowRuleEditor";
import ApprovalChainEditor from "./ApprovalChainEditor";
import SeedDefaults from "./SeedDefaults";

type WorkflowRule = {
  id: string;
  module: string;
  action: string;
  allowed_roles: string[];
  max_amount: number | null;
  requires_approval_above: number | null;
  approval_chain: string[];
  is_active: boolean;
  notes: string | null;
  updated_at: string;
  updated_by_user: { full_name: string } | null;
};

type ApprovalChain = {
  id: string;
  name: string;
  module: string;
  min_amount: number | null;
  max_amount: number | null;
  is_active: boolean;
  steps: {
    id: string;
    step_order: number;
    approver_role: string;
    approver_user: { full_name: string } | null;
    is_required: boolean;
    can_skip_if_below: number | null;
  }[];
};

type StaffMember = { id: string; full_name: string; role: string };

const MODULE_LABELS: Record<string, string> = {
  work_orders: "Work Orders",
  purchase_orders: "Purchase Orders",
  invoices: "Invoices & Payments",
  tenders: "Tenders",
  maintenance: "Preventive Maintenance",
  complaints: "Complaints",
  inventory: "Inventory & Store",
  vendors: "Vendors & Contracts",
  visitors: "Visitors",
  bookings: "Bookings",
  compliance: "Compliance",
  team: "Team Management",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Create",
  view: "View",
  update: "Update",
  delete: "Delete",
  assign: "Assign",
  approve: "Approve",
  reject: "Reject",
  escalate: "Escalate",
  verify: "Verify",
  close: "Close",
  cancel: "Cancel",
  generate_wo: "Generate Work Order",
  record_payment: "Record Payment",
  decide_winner: "Decide Winner",
  dispatch: "Dispatch",
};

const ALL_ROLES = [
  "super_admin", "tenant_admin", "property_manager",
  "supervisor", "technician", "vendor",
  "security", "call_center", "resident",
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  tenant_admin: "Tenant Admin",
  property_manager: "Property Manager",
  supervisor: "Supervisor",
  technician: "Technician",
  vendor: "Vendor",
  security: "Security",
  call_center: "Call Center",
  resident: "Resident",
};

async function getPageData() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const { data: callerProfile } = await supabase
    .from("user_profiles")
    .select("role, tenant_id")
    .eq("id", userData.user?.id ?? "")
    .single();

  const [{ data: rules }, { data: chains }, { data: staff }] = await Promise.all([
    supabase
      .from("workflow_rules")
      .select(
        `id, module, action, allowed_roles, max_amount, requires_approval_above,
         approval_chain, is_active, notes, updated_at,
         updated_by_user:user_profiles!workflow_rules_updated_by_fkey(full_name)`
      )
      .order("module")
      .order("action"),
    supabase
      .from("approval_chains")
      .select(
        `id, name, module, min_amount, max_amount, is_active,
         steps:approval_chain_steps(id, step_order, approver_role,
           approver_user:user_profiles(full_name),
           is_required, can_skip_if_below)`
      )
      .order("module"),
    supabase
      .from("user_profiles")
      .select("id, full_name, role")
      .in("role", ["tenant_admin", "property_manager", "supervisor"])
      .order("full_name"),
  ]);

  return {
    callerProfile,
    rules: (rules ?? []) as unknown as WorkflowRule[],
    chains: (chains ?? []) as unknown as ApprovalChain[],
    staff: (staff ?? []) as StaffMember[],
    tenantId: callerProfile?.tenant_id,
  };
}

export default async function WorkflowsPage() {
  const { callerProfile, rules, chains, staff, tenantId } = await getPageData();

  const isAdmin = callerProfile && ["tenant_admin", "super_admin"].includes(callerProfile.role);
  if (!isAdmin) {
    return (
      <main className="p-8">
        <p className="text-[#6b6454]">Only tenant administrators can configure workflows.</p>
      </main>
    );
  }

  const rulesByModule = new Map<string, WorkflowRule[]>();
  for (const rule of rules) {
    if (!rulesByModule.has(rule.module)) rulesByModule.set(rule.module, []);
    rulesByModule.get(rule.module)!.push(rule);
  }

  const modules = Object.keys(MODULE_LABELS);

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-extrabold mt-1">Workflow Configuration</h1>
          <p className="text-[#a0977e] text-sm mt-1">
            Control who can perform each action, set approval thresholds, and define approval chains.
            Changes take effect immediately across the platform.
          </p>
        </div>
        {rules.length === 0 && tenantId && <SeedDefaults tenantId={tenantId} />}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 text-center">
          <p className="text-2xl font-extrabold text-[#d4af5a]">{rules.length}</p>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">Rules Configured</p>
        </div>
        <div className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 text-center">
          <p className="text-2xl font-extrabold text-green-400">{rules.filter((r) => r.is_active).length}</p>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">Active</p>
        </div>
        <div className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 text-center">
          <p className="text-2xl font-extrabold text-[#d4af5a]">{chains.length}</p>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">Approval Chains</p>
        </div>
        <div className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4 text-center">
          <p className="text-2xl font-extrabold text-blue-400">{rulesByModule.size}</p>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider mt-1">Modules Covered</p>
        </div>
      </div>

      {modules.map((mod) => {
        const moduleRules = rulesByModule.get(mod) ?? [];
        const moduleChains = chains.filter((c) => c.module === mod);
        return (
          <section key={mod} className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase">
                {MODULE_LABELS[mod]} ({moduleRules.length} rules)
              </h2>
            </div>

            {moduleRules.length === 0 ? (
              <p className="text-sm text-[#6b6454] mb-4">
                No rules configured yet for this module.
              </p>
            ) : (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
                      <th className="py-2 font-medium w-32">Action</th>
                      <th className="py-2 font-medium">Allowed Roles</th>
                      <th className="py-2 font-medium w-36">Approval Above</th>
                      <th className="py-2 font-medium w-28">Max Amount</th>
                      <th className="py-2 font-medium w-16">Active</th>
                      <th className="py-2 font-medium w-40">Last Updated</th>
                      <th className="py-2 font-medium w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moduleRules.map((rule) => (
                      <tr key={rule.id} className={`border-b border-[rgba(184,144,47,0.08)] hover:bg-[#213052] ${!rule.is_active ? "opacity-50" : ""}`}>
                        <td className="py-2 font-medium">{ACTION_LABELS[rule.action] ?? rule.action}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {rule.allowed_roles.map((role) => (
                              <span
                                key={role}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#213052] text-[#a0977e]"
                              >
                                {ROLE_LABELS[role] ?? role}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 text-[#a0977e]">
                          {rule.requires_approval_above !== null
                            ? `AED ${Number(rule.requires_approval_above).toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="py-2 text-[#a0977e]">
                          {rule.max_amount !== null
                            ? `AED ${Number(rule.max_amount).toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="py-2">
                          {rule.is_active ? (
                            <span className="text-green-400 text-xs">Yes</span>
                          ) : (
                            <span className="text-red-400 text-xs">No</span>
                          )}
                        </td>
                        <td className="py-2 text-[10px] text-[#6b6454]">
                          {new Date(rule.updated_at).toLocaleDateString()}
                          {rule.updated_by_user && (
                            <span> by {(rule.updated_by_user as { full_name: string }).full_name}</span>
                          )}
                        </td>
                        <td className="py-2">
                          <WorkflowRuleEditor
                            rule={rule}
                            allRoles={ALL_ROLES}
                            roleLabels={ROLE_LABELS}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {moduleChains.length > 0 && (
              <div className="ml-4 mb-4">
                <h3 className="text-[10px] font-bold text-[#a0977e] tracking-[0.15em] uppercase mb-2">
                  Approval Chains
                </h3>
                {moduleChains.map((chain) => (
                  <div key={chain.id} className="border border-[rgba(184,144,47,0.08)] rounded-lg p-3 mb-2 bg-[#0f1626]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">
                        {chain.name}
                        {chain.min_amount !== null && chain.max_amount !== null && (
                          <span className="text-[#6b6454] text-xs ml-2">
                            AED {Number(chain.min_amount).toLocaleString()} – {Number(chain.max_amount).toLocaleString()}
                          </span>
                        )}
                      </p>
                      {!chain.is_active && <span className="text-red-400 text-[10px]">Inactive</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      {(chain.steps as ApprovalChain["steps"])
                        .sort((a, b) => a.step_order - b.step_order)
                        .map((step, i) => (
                          <div key={step.id} className="flex items-center gap-1">
                            {i > 0 && <span className="text-[#6b6454]">→</span>}
                            <span className={`text-[10px] font-medium px-2 py-1 rounded ${step.is_required ? "bg-[rgba(184,144,47,0.12)] text-[#d4af5a]" : "bg-[#213052] text-[#a0977e]"}`}>
                              {step.approver_user
                                ? (step.approver_user as { full_name: string }).full_name
                                : ROLE_LABELS[step.approver_role] ?? step.approver_role}
                              {!step.is_required && " (optional)"}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <section className="mb-8">
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
          Create Approval Chain
        </h2>
        <ApprovalChainEditor
          modules={Object.entries(MODULE_LABELS)}
          allRoles={ALL_ROLES}
          roleLabels={ROLE_LABELS}
          staff={staff}
        />
      </section>

      <div className="border border-[rgba(184,144,47,0.08)] rounded-xl p-5 bg-[#1a2640]">
        <h3 className="text-xs font-bold text-[#a0977e] tracking-[0.15em] uppercase mb-2">
          How Workflow Rules Work
        </h3>
        <ul className="text-xs text-[#6b6454] space-y-1">
          <li><strong className="text-[#a0977e]">Allowed Roles</strong> — Only users with these roles will see the action button for this module.</li>
          <li><strong className="text-[#a0977e]">Approval Above</strong> — Transactions above this amount require explicit approval from the next level in the chain.</li>
          <li><strong className="text-[#a0977e]">Max Amount</strong> — The maximum transaction value this role can handle without escalation.</li>
          <li><strong className="text-[#a0977e]">Approval Chains</strong> — Define the sequence of approvers for a module. Each step can be a specific person or any user with a given role.</li>
          <li><strong className="text-[#a0977e]">Active/Inactive</strong> — Deactivate a rule to temporarily disable the action without deleting the configuration.</li>
        </ul>
      </div>
    </main>
  );
}
