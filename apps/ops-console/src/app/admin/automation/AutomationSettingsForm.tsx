"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Settings = {
  leaseReminderDays: number[];
  rentOverdueRepeatDays: number;
  enableLeaseReminders: boolean;
  enableRentOverdue: boolean;
  enablePmGeneration: boolean;
  dailyHourUae: number;
};

const input =
  "bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm text-[#f0ece4]";

function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="w-full flex items-center justify-between gap-4 bg-[#1a2640] border border-[rgba(184,144,47,0.15)] rounded-xl p-4 text-left"
    >
      <div>
        <p className="font-bold text-sm">{label}</p>
        <p className="text-xs text-[#a0977e] mt-0.5">{desc}</p>
      </div>
      <span
        className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${on ? "bg-[#b8902f]" : "bg-[#213052]"}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-[#f0ece4] transition-all ${on ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

export default function AutomationSettingsForm({ tenantId, initial }: { tenantId: string; initial: Settings }) {
  const router = useRouter();
  const [s, setS] = useState<Settings>(initial);
  const [newStage, setNewStage] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function addStage() {
    const n = parseInt(newStage, 10);
    if (!n || n < 1 || n > 365) {
      setErr("Enter a number of days between 1 and 365.");
      return;
    }
    if (s.leaseReminderDays.includes(n)) {
      setErr("That stage already exists.");
      return;
    }
    setErr(null);
    setS({ ...s, leaseReminderDays: [...s.leaseReminderDays, n].sort((a, b) => b - a) });
    setNewStage("");
  }

  function removeStage(n: number) {
    setS({ ...s, leaseReminderDays: s.leaseReminderDays.filter((d) => d !== n) });
  }

  async function save() {
    if (s.leaseReminderDays.length === 0 && s.enableLeaseReminders) {
      setErr("Add at least one reminder stage, or switch lease reminders off.");
      return;
    }
    setSaving(true);
    setErr(null);
    setMsg(null);
    const supabase = createClient();

    const { error: upsertErr } = await supabase.from("automation_settings").upsert({
      tenant_id: tenantId,
      lease_reminder_days: [...s.leaseReminderDays].sort((a, b) => b - a),
      rent_overdue_repeat_days: s.rentOverdueRepeatDays,
      enable_lease_reminders: s.enableLeaseReminders,
      enable_rent_overdue: s.enableRentOverdue,
      enable_pm_generation: s.enablePmGeneration,
      daily_hour_uae: s.dailyHourUae,
      updated_at: new Date().toISOString(),
    });

    if (upsertErr) {
      setErr(upsertErr.message);
      setSaving(false);
      return;
    }

    // Reschedule the daily job if the hour changed.
    if (s.dailyHourUae !== initial.dailyHourUae) {
      const { error: rpcErr } = await supabase.rpc("set_daily_automation_hour", { hour_uae: s.dailyHourUae });
      if (rpcErr) {
        setErr(`Settings saved, but the run time could not be changed: ${rpcErr.message}`);
        setSaving(false);
        return;
      }
    }

    setMsg("Settings saved.");
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Lease renewal reminders */}
      <section className="bg-[#1a2640] border border-[rgba(184,144,47,0.15)] rounded-xl p-5">
        <h2 className="font-bold mb-1">Lease Renewal Reminders</h2>
        <p className="text-xs text-[#a0977e] mb-4">
          Customers are reminded at each stage before their lease expires, and reminders repeat at the next
          stage until the renewal is decided (marked renewed or not renewing).
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          {s.leaseReminderDays.map((d) => (
            <span
              key={d}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(184,144,47,0.12)] text-[#d4af5a] text-sm font-bold"
            >
              {d} days
              <button
                type="button"
                onClick={() => removeStage(d)}
                className="text-[#a0977e] hover:text-[#e08a8a]"
                aria-label={`Remove ${d}-day stage`}
              >
                ✕
              </button>
            </span>
          ))}
          {s.leaseReminderDays.length === 0 && (
            <span className="text-xs text-[#6b6454]">No stages configured.</span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            max={365}
            value={newStage}
            onChange={(e) => setNewStage(e.target.value)}
            placeholder="e.g. 90"
            className={`${input} w-28`}
          />
          <button
            type="button"
            onClick={addStage}
            className="text-xs font-bold px-4 py-2 rounded-lg border border-[#b8902f] text-[#b8902f] hover:bg-[rgba(184,144,47,0.12)]"
          >
            Add Stage
          </button>
        </div>
      </section>

      {/* Rent overdue */}
      <section className="bg-[#1a2640] border border-[rgba(184,144,47,0.15)] rounded-xl p-5">
        <h2 className="font-bold mb-1">Rent Overdue Reminders</h2>
        <p className="text-xs text-[#a0977e] mb-4">
          If a cheque stays overdue, the resident is reminded again after this many days.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#a0977e]">Repeat every</span>
          <input
            type="number"
            min={1}
            max={60}
            value={s.rentOverdueRepeatDays}
            onChange={(e) => setS({ ...s, rentOverdueRepeatDays: parseInt(e.target.value || "7", 10) })}
            className={`${input} w-24`}
          />
          <span className="text-sm text-[#a0977e]">days</span>
        </div>
      </section>

      {/* Run time */}
      <section className="bg-[#1a2640] border border-[rgba(184,144,47,0.15)] rounded-xl p-5">
        <h2 className="font-bold mb-1">Daily Run Time</h2>
        <p className="text-xs text-[#a0977e] mb-4">
          When the daily automation runs (UAE time) — rent sweep, lease reminders, maintenance generation.
        </p>
        <select
          value={s.dailyHourUae}
          onChange={(e) => setS({ ...s, dailyHourUae: parseInt(e.target.value, 10) })}
          className={input}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {h === 0 ? "12:00 AM (midnight)" : h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM (noon)" : `${h - 12}:00 PM`}
            </option>
          ))}
        </select>
      </section>

      {/* Toggles */}
      <div className="space-y-3">
        <Toggle
          on={s.enableLeaseReminders}
          onChange={(v) => setS({ ...s, enableLeaseReminders: v })}
          label="Lease renewal reminders"
          desc="Notify residents and management at the configured stages before expiry."
        />
        <Toggle
          on={s.enableRentOverdue}
          onChange={(v) => setS({ ...s, enableRentOverdue: v })}
          label="Rent overdue notifications"
          desc="Mark pending invoices overdue and remind residents."
        />
        <Toggle
          on={s.enablePmGeneration}
          onChange={(v) => setS({ ...s, enablePmGeneration: v })}
          label="Preventive maintenance generation"
          desc="Automatically create work orders when schedules fall due."
        />
      </div>

      {err && <p className="text-xs text-[#e08a8a]">{err}</p>}
      {msg && <p className="text-xs text-[#5cc98a]">{msg}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="bg-[#b8902f] text-[#0f1626] font-bold rounded-lg px-6 py-2.5 hover:bg-[#d4af5a] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Settings"}
      </button>
    </div>
  );
}
