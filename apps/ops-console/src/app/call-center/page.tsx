import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
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
    <main className="p-8">
      <Link href="/" className="text-sm text-[#9aa5bd] hover:text-[#b01b42]">← Dashboard</Link>
      <h1 className="text-2xl font-extrabold mt-1 mb-1">Call Center</h1>
      <p className="text-[#9aa5bd] mb-6">
        Search the caller by name or phone, confirm their unit, then log the complaint the same way
        the app would — it routes to maintenance identically either way.
      </p>
      <CallCenterSearch agentId={userData.user?.id ?? ""} initialPhone={phone} />
    </main>
  );
}
