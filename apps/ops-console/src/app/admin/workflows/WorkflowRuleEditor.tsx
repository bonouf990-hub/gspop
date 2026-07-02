"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Rule = {
  id: string;
  module: string;
  action: string;
  allowed_roles: string[];
  max_amount: number | null;
  requires_approval_above: number | null;
  is_active: boolean;
  notes: string | null;
};

export default function WorkflowRuleEditor({
  rule,
  allRoles,
  roleLabels,
}: {
  rule: Rule;
  allRoles: string[];
  roleLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<string[]>(rule.allowed_roles);
  const [maxAmount, setMaxAmount] = useState(rule.max_amount?.toString() ?? "");
  const [approvalAbove, setApprovalAbove] = useState(rule.requires_approval_above?.toString() ?? "");
  const [isActive, setIsActive] = useState(rule.is_active);
  const [notes, setNotes] = useState(rule.notes ?? "");
  const [saving, setSaving] = useState(false);

  function toggleRole(role: string) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    await supabase.from("workflow_rules").update({
      allowed_roles: roles,
      max_amount: maxAmount ? Number(maxAmount) : null,
      requires_approval_above: approvalAbove ? Number(approvalAbove) : null,
      is_active: isActive,
      notes: notes || null,
      updated_by: userData.user?.id,
      updated_at: new Date().toISOString(),
    }).eq("id", rule.id);

    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#213052] text-[#d4af5a] hover:bg-[rgba(184,144,47,0.15)]"
      >
        Edit
      </button>
    );
  }

  const input = "w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2 text-sm text-[#f0ece4]";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2640] border border-[rgba(184,144,47,0.15)] rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-4">
          Edit Rule: {rule.module.replace(/_/g, " ")} → {rule.action}
        </h3>

        <div className="mb-4">
          <label className="text-xs text-[#a0977e] mb-2 block">Allowed Roles</label>
          <div className="flex flex-wrap gap-2">
            {allRoles.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  roles.includes(role)
                    ? "bg-[#b8902f] text-[#0f1626]"
                    : "bg-[#0f1626] text-[#6b6454] border border-[rgba(184,144,47,0.15)]"
                }`}
              >
                {roleLabels[role] ?? role}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-[#a0977e] mb-1 block">Requires Approval Above (AED)</label>
            <input
              className={input}
              type="number"
              step="0.01"
              placeholder="No threshold"
              value={approvalAbove}
              onChange={(e) => setApprovalAbove(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-[#a0977e] mb-1 block">Max Amount (AED)</label>
            <input
              className={input}
              type="number"
              step="0.01"
              placeholder="No limit"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-[#a0977e] mb-1 block">Notes</label>
          <textarea
            className={input}
            rows={2}
            placeholder="Optional notes about this rule…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-[#b8902f]"
            />
            <span className="text-[#a0977e]">Rule is active</span>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || roles.length === 0}
            className="bg-[#b8902f] text-[#0f1626] text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Rule"}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="bg-[#213052] text-sm font-medium px-4 py-2 rounded-lg text-[#a0977e]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
