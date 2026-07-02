"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
          currentBudget > 0
            ? "bg-[#213052] text-[#d4af5a] hover:bg-[rgba(184,144,47,0.15)]"
            : "bg-[#b8902f] text-[#0f1626]"
        }`}
      >
        {currentBudget > 0 ? "Edit Budget" : "Set Budget"}
      </button>
    );
  }

  const input = "w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2.5 text-sm text-[#f0ece4]";

  return (
    <div className="border border-[rgba(184,144,47,0.15)] bg-[#0f1626] rounded-xl p-4 min-w-[280px]">
      <h4 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-2">
        {propertyName} — {year} Budget
      </h4>

      <div className="mb-3">
        <label className="text-xs text-[#a0977e] mb-1 block">Annual Budget (AED) *</label>
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
        <label className="text-xs text-[#a0977e] mb-1 block">Notes (optional)</label>
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
          className="bg-[#b8902f] text-[#0f1626] text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Budget"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="bg-[#213052] text-[#a0977e] text-xs font-medium px-4 py-2 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
