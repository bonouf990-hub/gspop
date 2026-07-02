import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import PageHeader from "@/components/PageHeader";
import { UserCog } from "lucide-react";
import { getOwner } from "@/lib/require-owner";
import AccessManager from "./AccessManager";

export default async function OwnerAccessPage() {
  const owner = await getOwner();
  if (!owner) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("list_owners");
  const owners = (data ?? []) as { id: string; full_name: string; email: string }[];

  return (
    <main className="p-6 sm:p-8 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Private · Owner only"
        title="Owner Access"
        icon={UserCog}
        description="Control who can see the private owner tools (Integrity Watch). Grant or revoke by email — takes effect the moment they refresh."
      />

      <AccessManager owners={owners} myId={owner.id} />

      <Link href="/gm/integrity" className="text-sm text-[#5b6b85] hover:text-[#b01b42] inline-block mt-6">← Integrity Watch</Link>
    </main>
  );
}
