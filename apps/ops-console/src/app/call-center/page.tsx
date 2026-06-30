import { createClient } from "@/lib/supabase-server";
import CallCenterSearch from "./CallCenterSearch";

export default async function CallCenterPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-1">Call Center</h1>
      <p className="text-gray-500 mb-6">
        Search the caller by name, confirm their unit, then log the complaint the same way the app
        would — it routes to maintenance identically either way.
      </p>
      <CallCenterSearch agentId={userData.user?.id ?? ""} />
    </main>
  );
}
