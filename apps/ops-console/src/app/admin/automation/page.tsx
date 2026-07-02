import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import AutomationSettingsForm from "./AutomationSettingsForm";

export default async function AutomationSettingsPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, tenant_id")
    .eq("id", userData.user?.id ?? "")
    .single();

  const isAdmin = profile && ["super_admin", "tenant_admin", "property_manager"].includes(profile.role);
  if (!isAdmin) {
    return (
      <main className="p-8">
        <p className="text-[#6b6454]">You don&apos;t have access to Automation Settings.</p>
      </main>
    );
  }

  const { data: settings } = await supabase
    .from("automation_settings")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">← Dashboard</Link>
      <h1 className="text-2xl font-extrabold mt-1 mb-1">Automation Settings</h1>
      <p className="text-[#a0977e] mb-8">
        Control when reminders go out and which automations run. Changes take effect from the next daily run.
      </p>

      <AutomationSettingsForm
        tenantId={profile.tenant_id as string}
        initial={{
          leaseReminderDays: (settings?.lease_reminder_days as number[]) ?? [90, 60, 30, 10],
          rentOverdueRepeatDays: (settings?.rent_overdue_repeat_days as number) ?? 7,
          enableLeaseReminders: (settings?.enable_lease_reminders as boolean) ?? true,
          enableRentOverdue: (settings?.enable_rent_overdue as boolean) ?? true,
          enablePmGeneration: (settings?.enable_pm_generation as boolean) ?? true,
          dailyHourUae: (settings?.daily_hour_uae as number) ?? 8,
        }}
      />
    </main>
  );
}
