import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getOwner } from "@/lib/require-owner";
import AccessManager from "./AccessManager";

export default async function OwnerAccessPage() {
  const owner = await getOwner();
  if (!owner) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("list_owners");
  const owners = (data ?? []) as { id: string; full_name: string; email: string }[];

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <span className="text-xl">🔑</span>
        <p className="eyebrow">Private · Owner only</p>
      </div>
      <h1 className="mt-1">Owner Access</h1>
      <p className="text-[#5b6b85] mt-1 mb-6">
        Control who can see the private owner tools (Integrity Watch). Grant or revoke by email — takes effect the moment
        they refresh.
      </p>

      <AccessManager owners={owners} myId={owner.id} />

      <Link href="/gm/integrity" className="text-sm text-[#5b6b85] hover:text-[#b01b42] inline-block mt-6">← Integrity Watch</Link>
    </main>
  );
}
