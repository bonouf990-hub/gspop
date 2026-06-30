import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type Approval } from "@gspop/shared";

async function getPendingApprovals(): Promise<Approval[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("approvals")
    .select("*")
    .eq("decision", "pending")
    .order("level", { ascending: true });
  return camelCaseKeys<Approval[]>(data ?? []);
}

export default async function ApprovalsPage() {
  const approvals = await getPendingApprovals();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Pending Approvals</h1>
      <ul className="space-y-3">
        {approvals.map((a) => (
          <li key={a.id} className="border border-gray-700 rounded-lg p-4">
            <p className="font-medium">
              {a.entityType.replace(/_/g, " ")} &middot; Level {a.level}
            </p>
            <p className="text-sm text-gray-500">
              Spend limit at decision: {a.spendLimitAtDecision ?? "n/a"}
            </p>
          </li>
        ))}
        {approvals.length === 0 && <p className="text-gray-500">Nothing pending approval.</p>}
      </ul>
    </main>
  );
}
