import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getOwner } from "@/lib/require-owner";
import { askAI } from "@/lib/ai-service";

const WINDOW_DAYS = 120;
const PO_HIGH_VALUE = 50000; // matches the approval escalation threshold

type Finding = {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  amount: number;
  who: string;
};

function name(v: unknown): string {
  const o = v as { full_name?: string } | null;
  return o?.full_name ?? "—";
}

async function detect() {
  const supabase = await createClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();
  const findings: Finding[] = [];

  const [{ data: parts }, { data: moves }, { data: pos }] = await Promise.all([
    supabase.from("parts_requests")
      .select("work_order_id, inventory_item_id, requested_by, quantity, total_cost, status, created_at, inventory_item:inventory_items(name), requester:user_profiles!parts_requests_requested_by_fkey(full_name), work_order:work_orders(case_number)")
      .gte("created_at", since).limit(5000),
    supabase.from("inventory_movements")
      .select("inventory_item_id, work_order_id, moved_by, movement_type, quantity, total_cost, created_at, inventory_item:inventory_items(name), mover:user_profiles!inventory_movements_moved_by_fkey(full_name)")
      .gte("created_at", since).limit(5000),
    supabase.from("purchase_orders")
      .select("amount, status, requested_by, created_at, requester:user_profiles!purchase_orders_requested_by_fkey(full_name)")
      .gte("created_at", since).limit(2000),
  ]);

  const partsRows = (parts ?? []) as unknown as {
    work_order_id: string | null; inventory_item_id: string; requested_by: string; quantity: number; total_cost: number | null;
    inventory_item: { name: string } | null; requester: unknown; work_order: { case_number: string | null } | null;
  }[];
  const moveRows = (moves ?? []) as unknown as {
    inventory_item_id: string; work_order_id: string | null; moved_by: string; movement_type: string; quantity: number;
    total_cost: number | null; inventory_item: { name: string } | null; mover: unknown;
  }[];
  const poRows = (pos ?? []) as unknown as { amount: number; status: string; requester: unknown }[];

  // A) Double parts on the same job — same item requested 2+ times for one job card.
  const byJobItem = new Map<string, typeof partsRows>();
  for (const r of partsRows) {
    if (!r.work_order_id) continue;
    const k = `${r.work_order_id}|${r.inventory_item_id}`;
    byJobItem.set(k, [...(byJobItem.get(k) ?? []), r]);
  }
  for (const [, rows] of byJobItem) {
    if (rows.length >= 2) {
      const cost = rows.reduce((s, r) => s + Number(r.total_cost ?? 0), 0);
      findings.push({
        severity: "high",
        title: `Same part requested ${rows.length}× on one job`,
        detail: `Job ${rows[0].work_order?.case_number ?? "—"}: "${rows[0].inventory_item?.name ?? "item"}" was requisitioned ${rows.length} times. Possible double-ordering for a single repair.`,
        amount: cost,
        who: name(rows[0].requester),
      });
    }
  }

  // B) Repeat requisitions — one person pulling the same item many times.
  const byPersonItem = new Map<string, { rows: typeof partsRows; who: string; item: string }>();
  for (const r of partsRows) {
    const k = `${r.requested_by}|${r.inventory_item_id}`;
    const e = byPersonItem.get(k) ?? { rows: [], who: name(r.requester), item: r.inventory_item?.name ?? "item" };
    e.rows.push(r);
    byPersonItem.set(k, e);
  }
  for (const [, e] of byPersonItem) {
    if (e.rows.length >= 5) {
      const cost = e.rows.reduce((s, r) => s + Number(r.total_cost ?? 0), 0);
      findings.push({
        severity: "medium",
        title: `Repeat requisitions of one part`,
        detail: `${e.who} requisitioned "${e.item}" ${e.rows.length} times in ${WINDOW_DAYS} days. Worth checking against the jobs it was used on.`,
        amount: cost,
        who: e.who,
      });
    }
  }

  // C) Stock issued with no job attached — parts leaving the store off-book.
  const noJob = new Map<string, { count: number; cost: number; who: string }>();
  for (const m of moveRows) {
    if (m.movement_type === "issue" && !m.work_order_id) {
      const who = name(m.mover);
      const e = noJob.get(who) ?? { count: 0, cost: 0, who };
      e.count += 1; e.cost += Number(m.total_cost ?? 0);
      noJob.set(who, e);
    }
  }
  for (const [, e] of noJob) {
    findings.push({
      severity: "high",
      title: `Stock issued with no job attached`,
      detail: `${e.who} recorded ${e.count} stock issue(s) not linked to any work order — parts left the store without a job to justify them.`,
      amount: e.cost,
      who: e.who,
    });
  }

  // D) Stock adjustments — write-offs / shrinkage.
  const adj = new Map<string, { count: number; cost: number; who: string }>();
  for (const m of moveRows) {
    if (m.movement_type === "adjustment") {
      const who = name(m.mover);
      const e = adj.get(who) ?? { count: 0, cost: 0, who };
      e.count += 1; e.cost += Math.abs(Number(m.total_cost ?? 0));
      adj.set(who, e);
    }
  }
  for (const [, e] of adj) {
    if (e.count >= 2) {
      findings.push({
        severity: "medium",
        title: `Manual stock adjustments`,
        detail: `${e.who} made ${e.count} manual stock adjustment(s) — a common route for covering shrinkage. Cross-check against physical count.`,
        amount: e.cost,
        who: e.who,
      });
    }
  }

  // E) PO structuring — purchase orders parked just under the sign-off threshold.
  const structuredBy = new Map<string, { count: number; cost: number; who: string }>();
  for (const p of poRows) {
    const amt = Number(p.amount);
    if (amt >= PO_HIGH_VALUE * 0.9 && amt < PO_HIGH_VALUE) {
      const who = name(p.requester);
      const e = structuredBy.get(who) ?? { count: 0, cost: 0, who };
      e.count += 1; e.cost += amt;
      structuredBy.set(who, e);
    }
  }
  for (const [, e] of structuredBy) {
    if (e.count >= 2) {
      findings.push({
        severity: "high",
        title: `Purchase orders just under the approval limit`,
        detail: `${e.who} raised ${e.count} PO(s) in the ${(PO_HIGH_VALUE * 0.9).toLocaleString()}–${PO_HIGH_VALUE.toLocaleString()} band — just below the ${PO_HIGH_VALUE.toLocaleString()} escalation threshold. Possible splitting to avoid sign-off.`,
        amount: e.cost,
        who: e.who,
      });
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || b.amount - a.amount);
  return findings;
}

async function brief(findings: Finding[]): Promise<string | null> {
  if (findings.length === 0) return null;
  const facts = findings.map((f, i) =>
    `${i + 1}. [${f.severity}] ${f.title} — ${f.detail} (person: ${f.who}, value ~AED ${Math.round(f.amount).toLocaleString()})`
  ).join("\n");
  const system =
    "You are a discreet integrity analyst reporting privately to the owner of ARENCO Real Estate. " +
    "You are given patterns already detected deterministically from the operational data. " +
    "Write a short, calm briefing for the owner ONLY. Rank the concerns, estimate the money at risk, and for each give " +
    "one discreet next step to verify it (e.g. pull the job cards, do a surprise stock count). " +
    "Be careful and fair: these are PATTERNS TO INVESTIGATE, not proof of wrongdoing — say so, and never state anyone is guilty. " +
    "Under 250 words. Use markdown with a short intro line then a bulleted list.";
  try {
    return await askAI(system, `Detected patterns:\n${facts}`, 900);
  } catch {
    return null;
  }
}

const SEV_STYLE: Record<string, string> = {
  high: "border-l-red-500 bg-red-50/40",
  medium: "border-l-amber-500 bg-amber-50/40",
  low: "border-l-[#8b97ab] bg-[#f7f9fc]",
};

export default async function IntegrityWatchPage() {
  const owner = await getOwner();
  if (!owner) notFound(); // hard lock — non-owners can't reach this

  const findings = await detect();
  const briefing = await brief(findings);

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <span className="text-xl">🛡️</span>
        <p className="eyebrow">Private · Owner only</p>
      </div>
      <h1 className="mt-1">Integrity Watch</h1>
      <p className="text-[#5b6b85] mt-1 mb-6">
        A silent audit of the last {WINDOW_DAYS} days — parts, stock and purchasing. Visible only to you; no one else
        sees this page or is alerted. Findings are <b>patterns to investigate</b>, not proof of wrongdoing.
      </p>

      {findings.length === 0 ? (
        <div className="lux-card p-8 text-center">
          <p className="text-lg font-bold text-green-700">Nothing flagged</p>
          <p className="text-sm text-[#8b97ab] mt-1">
            No suspicious patterns in the last {WINDOW_DAYS} days. This gets sharper as store, requisition and purchasing
            activity builds up — the checks run every time you open this page.
          </p>
        </div>
      ) : (
        <>
          {briefing && (
            <section className="lux-card p-6 mb-6 border-l-4 border-l-[#b01b42]">
              <h2 className="eyebrow mb-3">Your private briefing</h2>
              <div className="text-sm text-[#43536e] leading-relaxed whitespace-pre-line">{briefing}</div>
            </section>
          )}
          <h2 className="eyebrow mb-3">Flagged patterns ({findings.length})</h2>
          <div className="space-y-3">
            {findings.map((f, i) => (
              <div key={i} className={`lux-card p-5 border-l-4 ${SEV_STYLE[f.severity]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[#16233c]">{f.title}</p>
                    <p className="text-sm text-[#5b6b85] mt-1">{f.detail}</p>
                    <p className="text-[11px] text-[#8b97ab] mt-1.5 uppercase tracking-wider">{f.severity} · {f.who}</p>
                  </div>
                  {f.amount > 0 && (
                    <span className="shrink-0 text-sm font-bold text-[#16233c] tabular-nums">AED {Math.round(f.amount).toLocaleString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-[11px] text-[#8b97ab] mt-8 pt-3 border-t border-[#eef1f7]">
        Checked: duplicate parts on a job · repeat requisitions · stock issued with no job · manual stock adjustments ·
        purchase orders split under the approval limit. Reviewed privately by you — heads of department are not notified.
      </p>
    </main>
  );
}
