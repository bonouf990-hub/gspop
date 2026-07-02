import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import PageHeader from "@/components/PageHeader";
import { Phone } from "lucide-react";
import CallCenterSearch from "./CallCenterSearch";

export default async function CallCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  return (
    <main className="p-6 sm:p-8 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Maintenance & Help Desk"
        title="Call Center"
        icon={Phone}
        description="Search the caller by name or phone, confirm their unit, then log the complaint the same way the app would — it routes to maintenance identically either way."
      />
      <CallCenterSearch agentId={userData.user?.id ?? ""} initialPhone={phone} />
    </main>
  );
}
