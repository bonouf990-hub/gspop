import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { requireManagementRole } from "@/lib/check-permission";
import ApprovalDecision from "./ApprovalDecision";

type ApprovalRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  level: number;
  decision: string;
  spend_limit_at_decision: number | null;
  comment: string | null;
  decided_at: string | null;
  approver: { full_name: string } | null;
};

async function getApprovals() {
  const supabase = await createClient();

  const [{ data: pending }, { data: recent }] = await Promise.all([
    supabase
      .from("approvals")
      .select(
        "id, entity_type, entity_id, level, decision, spend_limit_at_decision, comment, decided_at, approver:user_profiles!approvals_approver_id_fkey(full_name)"
      )
      .eq("decision", "pending")
      .order("level"),
    supabase
      .from("approvals")
      .select(
        "id, entity_type, entity_id, level, decision, spend_limit_at_decision, comment, decided_at, approver:user_profiles!approvals_approver_id_fkey(full_name)"
      )
      .neq("decision", "pending")
      .order("decided_at", { ascending: false })
      .limit(20),
  ]);

  const allRows = [...(pending ?? []), ...(recent ?? [])] as unknown as ApprovalRow[];
  const woIds = allRows.filter((a) => a.entity_type === "work_order").map((a) => a.entity_id);
  const poIds = allRows.filter((a) => a.entity_type === "purchase_order").map((a) => a.entity_id);

  const [{ data: woData }, { data: poData }] = await Promise.all([
    woIds.length > 0
      ? supabase.from("work_orders").select("id, title, estimated_cost").in("id", woIds)
      : { data: [] },
    poIds.length > 0
      ? supabase.from("purchase_orders").select("id, description, amount").in("id", poIds)
      : { data: [] },
  ]);

  const entityMap = new Map<string, { label: string; cost: string }>();
  (woData ?? []).forEach((w: { id: string; title: string; estimated_cost: number | null }) =>
    entityMap.set(w.id, {
      label: w.title,
      cost: w.estimated_cost ? `AED ${Number(w.estimated_cost).toLocaleString()}` : "—",
    })
  );
  (poData ?? []).forEach((p: { id: string; description: string; amount: number | null }) =>
    entityMap.set(p.id, {
      label: p.description ?? "Purchase Order",
      cost: p.amount ? `AED ${Number(p.amount).toLocaleString()}` : "—",
    })
  );

  return {
    pending: (pending ?? []) as unknown as ApprovalRow[],
    recent: (recent ?? []) as unknown as ApprovalRow[],
    entityMap,
  };
}

export default async function ApprovalsPage() {
  const auth = await requireManagementRole();
  if (!auth.allowed) {
    return <main className="p-8"><p className="text-[#6b6454]">You don&apos;t have access to Approvals.</p></main>;
  }

  const { pending, recent, entityMap } = await getApprovals();

  function renderRow(a: ApprovalRow) {
    const entity = entityMap.get(a.entity_id);
    const approver = a.approver as { full_name: string } | null;
    return (
      <tr key={a.id} className="border-b border-[rgba(184,144,47,0.08)] hover:bg-[#213052]">
        <td className="py-2.5">
          <span className="font-medium">{entity?.label ?? a.entity_id.slice(0, 8)}</span>
          <span className="text-xs text-[#6b6454] ml-2 capitalize">
            {a.entity_type.replace(/_/g, " ")}
          </span>
        </td>
        <td className="py-2.5 text-[#a0977e]">Level {a.level}</td>
        <td className="py-2.5 text-[#d4af5a] font-medium">{entity?.cost ?? "—"}</td>
        <td className="py-2.5 text-[#a0977e]">{approver?.full_name ?? "—"}</td>
        <td className="py-2.5">
          <ApprovalDecision approvalId={a.id} currentDecision={a.decision} />
        </td>
      </tr>
    );
  }

  return (
    <main className="p-8">
      <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-extrabold mt-1 mb-1">Approvals</h1>
      <p className="text-[#a0977e] mb-6">Spend requests and escalations awaiting sign-off.</p>

      <section className="mb-8">
        <h2 className="eyebrow mb-3">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-[#6b6454] text-sm">Nothing pending approval.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[600px]">
            <thead>
              <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 font-medium">Level</th>
                <th className="py-2 font-medium">Cost</th>
                <th className="py-2 font-medium">Approver</th>
                <th className="py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>{pending.map(renderRow)}</tbody>
          </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="eyebrow mb-3">
          Recent Decisions
        </h2>
        {recent.length === 0 ? (
          <p className="text-[#6b6454] text-sm">No recent decisions.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[600px]">
            <thead>
              <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 font-medium">Level</th>
                <th className="py-2 font-medium">Cost</th>
                <th className="py-2 font-medium">Approver</th>
                <th className="py-2 font-medium">Decision</th>
              </tr>
            </thead>
            <tbody>{recent.map(renderRow)}</tbody>
          </table>
          </div>
        )}
      </section>
    </main>
  );
}
