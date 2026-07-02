import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import PageHeader from "@/components/PageHeader";
import { ScrollText } from "lucide-react";
import { askAI } from "@/lib/ai-service";

type WO = { status: string; type: string; priority: string; actual_cost: number | null; estimated_cost: number | null; title: string; created_at: string };
type CO = { status: string; priority: string; submitted_at: string };

function monthBounds(month: string) {
  // month = "YYYY-MM"
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString(), fiscalYear: y };
}

async function gather(propertyId: string, month: string) {
  const supabase = await createClient();
  const { start, end, fiscalYear } = monthBounds(month);

  const [{ data: prop }, { data: wos }, { data: cos }, { data: budget }] = await Promise.all([
    supabase.from("properties").select("name").eq("id", propertyId).single(),
    supabase.from("work_orders")
      .select("status, type, priority, actual_cost, estimated_cost, title, created_at")
      .eq("property_id", propertyId).gte("created_at", start).lt("created_at", end).limit(1000),
    supabase.from("complaints")
      .select("status, priority, submitted_at")
      .eq("property_id", propertyId).gte("submitted_at", start).lt("submitted_at", end).limit(2000),
    supabase.from("building_budgets")
      .select("total_budget").eq("property_id", propertyId).eq("fiscal_year", fiscalYear).maybeSingle(),
  ]);

  const workOrders = (wos ?? []) as WO[];
  const complaints = (cos ?? []) as CO[];

  const byStatus = (rows: { status: string }[]) =>
    rows.reduce<Record<string, number>>((a, r) => { a[r.status] = (a[r.status] ?? 0) + 1; return a; }, {});
  const spend = workOrders.reduce((s, w) => s + Number(w.actual_cost ?? 0), 0);
  const emergencies = workOrders.filter((w) => w.priority === "emergency").length +
    complaints.filter((c) => c.priority === "emergency").length;

  return {
    buildingName: (prop?.name as string) ?? "Building",
    month,
    workOrderTotal: workOrders.length,
    workOrderByStatus: byStatus(workOrders),
    workOrderByType: workOrders.reduce<Record<string, number>>((a, w) => { a[w.type] = (a[w.type] ?? 0) + 1; return a; }, {}),
    spend,
    complaintTotal: complaints.length,
    complaintByStatus: byStatus(complaints),
    emergencies,
    totalBudget: budget ? Number(budget.total_budget) : null,
    notable: workOrders.filter((w) => w.priority === "emergency" || Number(w.actual_cost ?? 0) > 2000)
      .slice(0, 8).map((w) => `${w.title} (${w.priority}, AED ${Number(w.actual_cost ?? 0).toLocaleString()})`),
  };
}

async function generateReport(propertyId: string, month: string) {
  const d = await gather(propertyId, month);
  const monthLabel = new Date(`${month}-01`).toLocaleDateString("en-AE", { month: "long", year: "numeric" });

  const facts = [
    `Building: ${d.buildingName}`,
    `Period: ${monthLabel}`,
    `Work orders raised: ${d.workOrderTotal} — by status: ${JSON.stringify(d.workOrderByStatus)}; by type: ${JSON.stringify(d.workOrderByType)}`,
    `Maintenance spend this month: AED ${d.spend.toLocaleString()}`,
    d.totalBudget != null ? `Annual building budget: AED ${d.totalBudget.toLocaleString()}` : `Annual building budget: not set`,
    `Resident complaints: ${d.complaintTotal} — by status: ${JSON.stringify(d.complaintByStatus)}`,
    `Emergency-priority items: ${d.emergencies}`,
    d.notable.length ? `Notable / high-cost jobs: ${d.notable.join("; ")}` : `No high-cost jobs this month`,
  ].join("\n");

  const system =
    "You are the operations analyst for ARENCO Real Estate, a residential landlord in Dubai. " +
    "Write a concise monthly building report for the General Manager from the figures provided. " +
    "Use short markdown sections with these headings exactly: '## Summary', '## Maintenance activity', " +
    "'## Cost & budget', '## Resident experience', '## Recommendations'. " +
    "Be specific and use the numbers given; do not invent data you were not given. " +
    "Under Recommendations give 3–5 concrete, prioritised actions. Keep the whole report under 350 words.";

  return askAI(system, `Figures:\n${facts}`, 1500);
}

// Minimal, safe markdown rendering (headings, bullets, bold) without dangerouslySetInnerHTML.
function renderReport(text: string) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: string) => {
    if (bullets.length) {
      out.push(<ul key={key} className="list-disc pl-5 space-y-1 my-2">{bullets.map((b, i) => <li key={i} className="text-[#43536e] text-sm">{inline(b)}</li>)}</ul>);
      bullets = [];
    }
  };
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="text-[#16233c]">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>);
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) { flush(`u${i}`); out.push(<h3 key={i} className="eyebrow mt-5 mb-2">{line.slice(3)}</h3>); }
    else if (line.startsWith("# ")) { flush(`u${i}`); out.push(<h2 key={i} className="font-bold text-lg mt-5 mb-2">{line.slice(2)}</h2>); }
    else if (/^[-*]\s+/.test(line)) { bullets.push(line.replace(/^[-*]\s+/, "")); }
    else if (line.trim() === "") { flush(`u${i}`); }
    else { flush(`u${i}`); out.push(<p key={i} className="text-[#43536e] text-sm leading-relaxed my-1.5">{inline(line)}</p>); }
  });
  flush("end");
  return out;
}

export default async function AISummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ building?: string; month?: string }>;
}) {
  const { building, month } = await searchParams;
  const supabase = await createClient();
  const { data: buildings } = await supabase.from("properties").select("id, name").order("name");
  const buildingList = (buildings ?? []) as { id: string; name: string }[];

  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const chosenMonth = month || defaultMonth;

  let report: string | null = null;
  let errorMsg: string | null = null;
  if (building) {
    try {
      report = await generateReport(building, chosenMonth);
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : "Could not generate the report.";
    }
  }

  const selectCls = "bg-white border border-[#d8dfeb] rounded-lg px-3 py-2 text-sm text-[#16233c]";

  return (
    <main className="p-6 sm:p-8 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Insight & Reporting · AI"
        title="AI Monthly Building Report"
        icon={ScrollText}
        description="Pick a building and month — the assistant writes a GM-ready summary from that month's work orders, complaints and spend against budget."
      />

      <form className="flex flex-wrap gap-3 items-end mb-6">
        <div>
          <label className="text-xs text-[#5b6b85] mb-1 block">Building</label>
          <select name="building" defaultValue={building ?? ""} className={selectCls} required>
            <option value="">Select building…</option>
            {buildingList.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#5b6b85] mb-1 block">Month</label>
          <input type="month" name="month" defaultValue={chosenMonth} className={selectCls} />
        </div>
        <button type="submit" className="btn-gold text-sm px-5 py-2">Generate report</button>
      </form>

      {errorMsg && (
        <div className="lux-card p-4 border-l-4 border-l-red-500">
          <p className="text-sm text-red-700">{errorMsg}</p>
          <p className="text-xs text-[#8b97ab] mt-1">If this mentions the API key, set ANTHROPIC_API_KEY in the console environment.</p>
        </div>
      )}

      {report && (
        <section className="lux-card p-7">
          {renderReport(report)}
          <p className="text-[11px] text-[#8b97ab] mt-6 pt-3 border-t border-[#eef1f7]">
            Generated by ARENCO One AI from live figures. Review before circulating.
          </p>
        </section>
      )}

      {!report && !errorMsg && (
        <div className="lux-card p-8 text-center text-[#8b97ab]">
          Choose a building and month, then Generate to produce the report.
        </div>
      )}

      <Link href="/reports/dashboard" className="text-sm text-[#5b6b85] hover:text-[#b01b42] inline-block mt-6">← Analytics Dashboard</Link>
    </main>
  );
}
