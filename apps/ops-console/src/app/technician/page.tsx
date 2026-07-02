import { createClient } from "@/lib/supabase-server";
import TechnicianDashboard from "./TechnicianDashboard";

type WORow = {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  description: string | null;
  created_at: string;
  started_at: string | null;
  hours_worked: number | null;
  preferred_visit_date: string | null;
  preferred_visit_time: string | null;
  visit_source: string | null;
  properties: { name: string } | null;
  units: { label: string } | null;
};

async function getTechnicianData() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, full_name, trade")
    .eq("id", userId ?? "")
    .single();

  if (!profile) return null;

  const { data: workOrders } = await supabase
    .from("work_orders")
    .select(
      `id, title, type, priority, status, description, created_at, started_at, hours_worked,
       preferred_visit_date, preferred_visit_time, visit_source,
       properties(name), units(label)`
    )
    .or(`assigned_to.eq.${userId},assigned_technician_id.eq.${userId}`)
    .not("status", "in", "(closed,cancelled)")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: todayCheckins } = await supabase
    .from("work_order_checkins")
    .select("id, work_order_id, type, timestamp")
    .eq("technician_id", userId ?? "")
    .gte("timestamp", new Date().toISOString().slice(0, 10) + "T00:00:00Z")
    .order("timestamp", { ascending: false });

  return {
    profile: { name: profile.full_name, role: profile.role, trade: profile.trade },
    userId: userId!,
    workOrders: (workOrders ?? []) as unknown as WORow[],
    todayCheckins: (todayCheckins ?? []) as { id: string; work_order_id: string; type: string; timestamp: string }[],
  };
}

export default async function TechnicianPage() {
  const data = await getTechnicianData();

  if (!data) {
    return (
      <main className="p-6 min-h-screen bg-[#f4f6fa]">
        <p className="text-[#8b97ab]">Not authorized.</p>
      </main>
    );
  }

  return (
    <TechnicianDashboard
      profile={data.profile}
      userId={data.userId}
      workOrders={data.workOrders}
      todayCheckins={data.todayCheckins}
    />
  );
}
