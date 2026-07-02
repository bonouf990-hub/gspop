"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function SeedDefaults({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);

  async function handleSeed() {
    setSeeding(true);
    const supabase = createClient();
    await supabase.rpc("seed_default_workflow_rules", { p_tenant_id: tenantId });
    setSeeding(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleSeed}
      disabled={seeding}
      className="btn-gold text-sm px-4 py-2 disabled:opacity-50"
    >
      {seeding ? "Setting up…" : "Load Default Rules"}
    </button>
  );
}
