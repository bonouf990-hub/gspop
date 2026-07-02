import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import PageHeader from "@/components/PageHeader";
import { Timer } from "lucide-react";
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
      <main className="p-6 sm:p-8">
        <p className="text-[#8b97ab]">You don&apos;t have access to Automation Settings.</p>
      </main>
    );
  }

  const { data: settings } = await supabase
    .from("automation_settings")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  return (
    <main className="p-6 sm:p-8 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Administration"
        title="Automation Settings"
        icon={Timer}
        description="Control when reminders go out and which automations run. Changes take effect from the next daily run."
      />

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
