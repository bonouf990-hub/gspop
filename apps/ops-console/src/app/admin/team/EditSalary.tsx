"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function EditSalary({
  userId,
  currentSalary,
  currentHourlyRate,
}: {
  userId: string;
  currentSalary: number | null;
  currentHourlyRate: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [salary, setSalary] = useState(currentSalary ? String(currentSalary) : "");
  const [rate, setRate] = useState(currentHourlyRate ? String(currentHourlyRate) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const update: Record<string, unknown> = {
      monthly_salary: salary ? Number(salary) : null,
      hourly_rate: rate ? Number(rate) : null,
    };
    await supabase.from("user_profiles").update(update).eq("id", userId);
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] text-[#b01b42] hover:text-[#d9647f]"
      >
        Edit
      </button>
    );
  }

  const input = "w-full bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] rounded-lg p-1.5 text-xs text-[#16233c]";

  return (
    <div className="flex items-center gap-2">
      <input
        className={`${input} w-20`}
        type="number"
        placeholder="Salary"
        value={salary}
        onChange={(e) => setSalary(e.target.value)}
      />
      <input
        className={`${input} w-16`}
        type="number"
        step="0.01"
        placeholder="Rate/hr"
        value={rate}
        onChange={(e) => setRate(e.target.value)}
      />
      <button
        onClick={save}
        disabled={saving}
        className="text-xs btn-gold px-3 py-2 disabled:opacity-50"
      >
        {saving ? "…" : "Save"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs px-3 py-2 text-[#8b97ab]">
        ✕
      </button>
    </div>
  );
}
