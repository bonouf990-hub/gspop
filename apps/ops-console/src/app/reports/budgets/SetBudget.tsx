"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Modal from "@/components/Modal";

export default function SetBudget({
  propertyId,
  propertyName,
  year,
  currentBudget,
  currentNotes,
  budgetId,
}: {
  propertyId: string;
  propertyName: string;
  year: number;
  currentBudget: number;
  currentNotes: string | null;
  budgetId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(currentBudget > 0 ? String(currentBudget) : "");
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", userId ?? "")
      .single();

    if (budgetId) {
      const { error: err } = await supabase
        .from("building_budgets")
        .update({
          total_budget: Number(amount),
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", budgetId);
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: err } = await supabase.from("building_budgets").insert({
        tenant_id: profile?.tenant_id,
        property_id: propertyId,
        fiscal_year: year,
        total_budget: Number(amount),
        notes: notes || null,
        created_by: userId,
      });
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  const input = "w-full bg-[#0f1626] border border-[rgba(176,27,66,0.15)] rounded-lg p-2.5 text-sm text-[#eef1f6]";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
          currentBudget > 0
            ? "bg-[#213052] text-[#d9647f] hover:bg-[rgba(176,27,66,0.15)]"
            : "btn-gold"
        }`}
      >
        {currentBudget > 0 ? "Edit Budget" : "Set Budget"}
      </button>

      {open && (
        <Modal title={`${propertyName} — ${year} Budget`} onClose={() => setOpen(false)}>
          <div>
      <div className="mb-3">
        <label className="text-xs text-[#9aa5bd] mb-1 block">Annual Budget (AED) *</label>
        <input
          className={input}
          type="number"
          step="0.01"
          min="0"
          placeholder="e.g. 500000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div className="mb-3">
        <label className="text-xs text-[#9aa5bd] mb-1 block">Notes (optional)</label>
        <input
          className={input}
          placeholder="e.g. Approved by GM, includes HVAC overhaul"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !amount}
          className="btn-gold text-xs px-4 py-2 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Budget"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="bg-[#213052] text-[#9aa5bd] text-xs font-medium px-4 py-2 rounded-lg"
        >
          Cancel
        </button>
      </div>
          </div>
        </Modal>
      )}
    </>
  );
}
