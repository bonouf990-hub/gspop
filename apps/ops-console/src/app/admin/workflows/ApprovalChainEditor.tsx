"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type StaffMember = { id: string; full_name: string; role: string };

type Step = {
  approverRole: string;
  approverUserId: string;
  isRequired: boolean;
  canSkipIfBelow: string;
};

export default function ApprovalChainEditor({
  modules,
  allRoles,
  roleLabels,
  staff,
}: {
  modules: [string, string][];
  allRoles: string[];
  roleLabels: Record<string, string>;
  staff: StaffMember[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [module, setModule] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [steps, setSteps] = useState<Step[]>([
    { approverRole: "supervisor", approverUserId: "", isRequired: true, canSkipIfBelow: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addStep() {
    setSteps([...steps, { approverRole: "property_manager", approverUserId: "", isRequired: true, canSkipIfBelow: "" }]);
  }

  function removeStep(idx: number) {
    setSteps(steps.filter((_, i) => i !== idx));
  }

  function updateStep(idx: number, update: Partial<Step>) {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, ...update } : s)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !module || steps.length === 0) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", userData.user?.id ?? "")
      .single();

    const { data: chain, error: chainErr } = await supabase
      .from("approval_chains")
      .insert({
        tenant_id: profile?.tenant_id,
        name,
        module,
        min_amount: minAmount ? Number(minAmount) : 0,
        max_amount: maxAmount ? Number(maxAmount) : null,
      })
      .select("id")
      .single();

    if (chainErr || !chain) {
      setError(chainErr?.message ?? "Failed to create chain");
      setSaving(false);
      return;
    }

    const stepRows = steps.map((s, i) => ({
      chain_id: chain.id,
      step_order: i + 1,
      approver_role: s.approverRole,
      approver_user_id: s.approverUserId || null,
      is_required: s.isRequired,
      can_skip_if_below: s.canSkipIfBelow ? Number(s.canSkipIfBelow) : null,
    }));

    const { error: stepsErr } = await supabase.from("approval_chain_steps").insert(stepRows);

    setSaving(false);
    if (stepsErr) return setError(stepsErr.message);

    setName("");
    setModule("");
    setMinAmount("");
    setMaxAmount("");
    setSteps([{ approverRole: "supervisor", approverUserId: "", isRequired: true, canSkipIfBelow: "" }]);
    router.refresh();
  }

  const input = "w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2 text-sm text-[#f0ece4]";
  const approverRoles = allRoles.filter((r) => ["tenant_admin", "property_manager", "supervisor"].includes(r));

  return (
    <form onSubmit={handleSave} className="lux-card p-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Chain Name *</label>
          <input className={input} placeholder="e.g. High-Value PO Approval"
            value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Module *</label>
          <select className={input} value={module}
            onChange={(e) => setModule(e.target.value)} required>
            <option value="">Select module…</option>
            {modules.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Min Amount (AED)</label>
          <input className={input} type="number" step="0.01" placeholder="0"
            value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-[#a0977e] mb-1 block">Max Amount (AED)</label>
          <input className={input} type="number" step="0.01" placeholder="No limit"
            value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs text-[#a0977e] mb-2 block">Approval Steps (in order)</label>
        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2 bg-[#0f1626] rounded-lg p-2">
              <span className="text-xs text-[#6b6454] w-6 text-center">{idx + 1}.</span>
              <select
                className="bg-[#1a2640] border border-[rgba(184,144,47,0.15)] rounded-lg px-2 py-1.5 text-xs text-[#f0ece4] flex-1 min-w-[140px]"
                value={step.approverRole}
                onChange={(e) => updateStep(idx, { approverRole: e.target.value })}
              >
                {approverRoles.map((r) => (
                  <option key={r} value={r}>{roleLabels[r]}</option>
                ))}
              </select>
              <select
                className="bg-[#1a2640] border border-[rgba(184,144,47,0.15)] rounded-lg px-2 py-1.5 text-xs text-[#f0ece4] flex-1 min-w-[140px]"
                value={step.approverUserId}
                onChange={(e) => updateStep(idx, { approverUserId: e.target.value })}
              >
                <option value="">Any with role</option>
                {staff
                  .filter((s) => s.role === step.approverRole)
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
              </select>
              <label className="flex items-center gap-1 text-[10px] text-[#a0977e] whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={step.isRequired}
                  onChange={(e) => updateStep(idx, { isRequired: e.target.checked })}
                  className="accent-[#b8902f]"
                />
                Required
              </label>
              <input
                className="bg-[#1a2640] border border-[rgba(184,144,47,0.15)] rounded px-2 py-1.5 text-xs text-[#f0ece4] w-24"
                type="number"
                placeholder="Skip below"
                value={step.canSkipIfBelow}
                onChange={(e) => updateStep(idx, { canSkipIfBelow: e.target.value })}
              />
              {steps.length > 1 && (
                <button type="button" onClick={() => removeStep(idx)}
                  className="text-red-400 text-xs hover:text-red-300 px-1">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addStep}
          className="text-xs text-[#b8902f] hover:text-[#d4af5a] mt-2">
          + Add Step
        </button>
      </div>

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      <button type="submit" disabled={saving}
        className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
        {saving ? "Creating…" : "Create Chain"}
      </button>
    </form>
  );
}
