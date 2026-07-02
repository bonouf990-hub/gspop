import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import PageHeader from "@/components/PageHeader";
import { Megaphone } from "lucide-react";
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
      <main className="p-6 sm:p-8">
        <p className="text-[#8b97ab]">You don&apos;t have access to Building Notices.</p>
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
    <main className="p-6 sm:p-8 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Community & Residents"
        title="Building Notices"
        icon={Megaphone}
        description="Post announcements to residents. Each resident on the building is notified in their app."
        actions={
          <PostNoticeForm
            properties={(properties ?? []).map((p) => ({ id: p.id, name: p.name }))}
            tenantId={callerProfile.tenant_id}
            userId={userData.user!.id}
          />
        }
      />

      <div className="space-y-3">
        {(notices ?? []).map((n) => {
          const prop = n.properties as unknown as { name: string } | null;
          const expired = n.expires_at && new Date(n.expires_at) < new Date();
          return (
            <div key={n.id} className="lux-card p-4">
              <div className="flex justify-between items-start">
                <p className="font-medium">{n.title}</p>
                {expired && <span className="text-xs text-[#8b97ab]">expired</span>}
              </div>
              <p className="text-sm text-[#5b6b85] mt-1">{n.body}</p>
              <p className="text-xs text-[#8b97ab] mt-2">
                {prop?.name ?? "—"} · {new Date(n.posted_at).toLocaleString()}
              </p>
            </div>
          );
        })}
        {(notices ?? []).length === 0 && <p className="text-[#8b97ab]">No notices yet.</p>}
      </div>
    </main>
  );
}
