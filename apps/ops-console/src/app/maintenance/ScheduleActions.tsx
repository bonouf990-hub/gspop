"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function ScheduleActions({
  scheduleId,
  isActive,
}: {
  scheduleId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [acting, setActing] = useState(false);

  async function toggleActive() {
    setActing(true);
    const supabase = createClient();
    await supabase
      .from("maintenance_schedules")
      .update({ is_active: !isActive })
      .eq("id", scheduleId);
    setActing(false);
    router.refresh();
  }

  async function generateWO() {
    setActing(true);
    const supabase = createClient();

    const { data: schedule } = await supabase
      .from("maintenance_schedules")
      .select("*, property:properties(name)")
      .eq("id", scheduleId)
      .single();

    if (!schedule) {
      setActing(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    await supabase.from("work_orders").insert({
      tenant_id: schedule.tenant_id,
      property_id: schedule.property_id,
      unit_id: schedule.unit_id,
      title: `[PM] ${schedule.title}`,
      description: schedule.description,
      type: schedule.type === "certification" ? "inspection" : schedule.type,
      priority: schedule.priority,
      status: "assigned",
      assigned_technician_id: schedule.assigned_technician_id,
      reported_by: userId,
      maintenance_schedule_id: scheduleId,
      estimated_cost: null,
    });

    const nextMap: Record<string, number> = {
      daily: 1, weekly: 7, biweekly: 14, monthly: 30,
      quarterly: 91, biannual: 182, annual: 365,
    };
    const days = nextMap[schedule.frequency] ?? 30;
    const nextDate = new Date(schedule.next_due_date);
    nextDate.setDate(nextDate.getDate() + days);

    await supabase
      .from("maintenance_schedules")
      .update({
        last_generated_at: new Date().toISOString(),
        next_due_date: nextDate.toISOString().slice(0, 10),
      })
      .eq("id", scheduleId);

    setActing(false);
    router.refresh();
  }

  return (
    <div className="flex gap-1">
      {isActive && (
        <button
          onClick={generateWO}
          disabled={acting}
          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-green-800 text-green-200 disabled:opacity-50"
        >
          Generate WO
        </button>
      )}
      <button
        onClick={toggleActive}
        disabled={acting}
        className={`text-[10px] font-bold px-2 py-1 rounded-lg disabled:opacity-50 ${
          isActive
            ? "bg-[#e9eef6] text-[#5b6b85]"
            : "bg-amber-500 text-white"
        }`}
      >
        {isActive ? "Pause" : "Resume"}
      </button>
    </div>
  );
}
