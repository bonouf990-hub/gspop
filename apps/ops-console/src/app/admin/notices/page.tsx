import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import PostNoticeForm from "./PostNoticeForm";

export default async function NoticesAdminPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const { data: callerProfile } = await supabase
    .from("user_profiles")
    .select("role, tenant_id")
    .eq("id", userData.user?.id ?? "")
    .single();

  const isAdmin = callerProfile && ["tenant_admin", "property_manager"].includes(callerProfile.role);
  if (!isAdmin || !callerProfile) {
    return (
      <main className="p-8">
        <p className="text-[#6b6454]">You don&apos;t have access to Building Notices.</p>
      </main>
    );
  }

  const [{ data: properties }, { data: notices }] = await Promise.all([
    supabase.from("properties").select("id, name").order("name"),
    supabase
      .from("building_notices")
      .select("id, title, body, posted_at, expires_at, properties(name)")
      .order("posted_at", { ascending: false }),
  ]);

  return (
    <main className="p-8 max-w-3xl">
      <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">← Dashboard</Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-2">Building Notices</h1>
      <p className="text-[#a0977e] mb-6">
        Post announcements to residents. Each resident on the building is notified in their app.
      </p>

      <PostNoticeForm
        properties={(properties ?? []).map((p) => ({ id: p.id, name: p.name }))}
        tenantId={callerProfile.tenant_id}
        userId={userData.user!.id}
      />

      <div className="space-y-3">
        {(notices ?? []).map((n) => {
          const prop = n.properties as unknown as { name: string } | null;
          const expired = n.expires_at && new Date(n.expires_at) < new Date();
          return (
            <div key={n.id} className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-4">
              <div className="flex justify-between items-start">
                <p className="font-medium">{n.title}</p>
                {expired && <span className="text-xs text-[#6b6454]">expired</span>}
              </div>
              <p className="text-sm text-[#a0977e] mt-1">{n.body}</p>
              <p className="text-xs text-[#6b6454] mt-2">
                {prop?.name ?? "—"} · {new Date(n.posted_at).toLocaleString()}
              </p>
            </div>
          );
        })}
        {(notices ?? []).length === 0 && <p className="text-[#6b6454]">No notices yet.</p>}
      </div>
    </main>
  );
}
