import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

type MovementRow = {
  id: string;
  inventory_item_id: string;
  movement_type: string;
  quantity: number;
  reason: string | null;
  created_at: string;
};

type ItemRow = {
  id: string;
  name: string;
  sku: string | null;
  unit_of_measure: string | null;
  quantity_on_hand: number;
  reorder_threshold: number;
};

type ItemSummary = {
  name: string;
  sku: string | null;
  unit: string | null;
  currentStock: number;
  reorderThreshold: number;
  totalIssued: number;
  totalReceived: number;
  totalReturned: number;
  netChange: number;
  movementCount: number;
};

async function getReportData() {
  const supabase = await createClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  const [{ data: items }, { data: currentMovements }, { data: prevMovements }, { data: partsRequests }] =
    await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, name, sku, unit_of_measure, quantity_on_hand, reorder_threshold")
        .order("name"),
      supabase
        .from("inventory_movements")
        .select("id, inventory_item_id, movement_type, quantity, reason, created_at")
        .gte("created_at", startOfMonth)
        .order("created_at", { ascending: false }),
      supabase
        .from("inventory_movements")
        .select("id, inventory_item_id, movement_type, quantity, created_at")
        .gte("created_at", startOfPrevMonth)
        .lte("created_at", endOfPrevMonth),
      supabase
        .from("parts_requests")
        .select("id, status, created_at")
        .gte("created_at", startOfMonth),
    ]);

  const allItems = (items ?? []) as ItemRow[];
  const currentMvmts = (currentMovements ?? []) as MovementRow[];
  const prevMvmts = (prevMovements ?? []) as MovementRow[];
  const monthRequests = (partsRequests ?? []) as { id: string; status: string; created_at: string }[];

  const itemsById = new Map(allItems.map((i) => [i.id, i]));

  const summaries: ItemSummary[] = allItems.map((item) => {
    const mvmts = currentMvmts.filter((m) => m.inventory_item_id === item.id);
    const totalIssued = mvmts
      .filter((m) => m.movement_type === "issue")
      .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);
    const totalReceived = mvmts
      .filter((m) => m.movement_type === "receipt")
      .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);
    const totalReturned = mvmts
      .filter((m) => m.movement_type === "return")
      .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);
    const netChange = totalReceived + totalReturned - totalIssued;

    return {
      name: item.name,
      sku: item.sku,
      unit: item.unit_of_measure,
      currentStock: Number(item.quantity_on_hand),
      reorderThreshold: Number(item.reorder_threshold),
      totalIssued,
      totalReceived,
      totalReturned,
      netChange,
      movementCount: mvmts.length,
    };
  });

  const topConsumed = [...summaries].sort((a, b) => b.totalIssued - a.totalIssued).slice(0, 10);
  const criticalStock = summaries.filter(
    (s) => s.reorderThreshold > 0 && s.currentStock <= s.reorderThreshold
  );
  const zeroStock = summaries.filter((s) => s.currentStock <= 0);

  const totalIssuedThisMonth = currentMvmts
    .filter((m) => m.movement_type === "issue")
    .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);
  const totalReceivedThisMonth = currentMvmts
    .filter((m) => m.movement_type === "receipt")
    .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);
  const totalIssuedPrevMonth = prevMvmts
    .filter((m) => m.movement_type === "issue")
    .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);
  const totalReceivedPrevMonth = prevMvmts
    .filter((m) => m.movement_type === "receipt")
    .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);

  const issueChange = totalIssuedPrevMonth > 0
    ? Math.round(((totalIssuedThisMonth - totalIssuedPrevMonth) / totalIssuedPrevMonth) * 100)
    : 0;

  const requestsFulfilled = monthRequests.filter((r) =>
    ["delivered", "collected"].includes(r.status)
  ).length;
  const requestsPending = monthRequests.filter((r) =>
    ["requested", "approved", "picking", "delivering"].includes(r.status)
  ).length;
  const requestsRejected = monthRequests.filter((r) => r.status === "rejected").length;

  const insights: string[] = [];

  if (criticalStock.length > 0) {
    insights.push(
      `${criticalStock.length} item${criticalStock.length > 1 ? "s are" : " is"} below reorder threshold and need${criticalStock.length === 1 ? "s" : ""} immediate replenishment: ${criticalStock.slice(0, 3).map((s) => s.name).join(", ")}${criticalStock.length > 3 ? ` and ${criticalStock.length - 3} more` : ""}.`
    );
  }

  if (zeroStock.length > 0) {
    insights.push(
      `${zeroStock.length} item${zeroStock.length > 1 ? "s have" : " has"} zero stock — any work orders requiring ${zeroStock.slice(0, 2).map((s) => s.name).join(" or ")} will be blocked until restocked.`
    );
  }

  if (issueChange > 20) {
    insights.push(
      `Material consumption increased ${issueChange}% versus last month. Review open projects to ensure this aligns with expected work volume.`
    );
  } else if (issueChange < -20 && totalIssuedPrevMonth > 0) {
    insights.push(
      `Material consumption decreased ${Math.abs(issueChange)}% versus last month. Verify that technicians are requesting parts through the system rather than bypassing inventory.`
    );
  }

  if (topConsumed.length > 0 && topConsumed[0].totalIssued > 0) {
    const top = topConsumed[0];
    insights.push(
      `Highest consumption: "${top.name}" with ${top.totalIssued} ${top.unit ?? "units"} issued this month. ${
        top.currentStock <= top.reorderThreshold && top.reorderThreshold > 0
          ? "This item is now below reorder threshold — initiate purchase order."
          : `Current stock: ${top.currentStock} ${top.unit ?? "units"}.`
      }`
    );
  }

  if (requestsRejected > 0 && monthRequests.length > 0) {
    const rejectionRate = Math.round((requestsRejected / monthRequests.length) * 100);
    if (rejectionRate > 15) {
      insights.push(
        `Parts request rejection rate is ${rejectionRate}% (${requestsRejected} of ${monthRequests.length}). Investigate whether technicians are requesting items not typically stocked or if approval criteria needs review.`
      );
    }
  }

  if (summaries.filter((s) => s.movementCount === 0).length > summaries.length * 0.5 && summaries.length > 5) {
    const dormant = summaries.filter((s) => s.movementCount === 0 && s.currentStock > 0);
    if (dormant.length > 0) {
      insights.push(
        `${dormant.length} stocked item${dormant.length > 1 ? "s had" : " had"} no movement this month. Consider reviewing whether these items are still needed or if stock can be reduced to free up storage and capital.`
      );
    }
  }

  if (insights.length === 0) {
    insights.push("All inventory levels are healthy with normal consumption patterns this month.");
  }

  const monthName = now.toLocaleString("default", { month: "long", year: "numeric" });

  return {
    monthName,
    summaries,
    topConsumed,
    criticalStock,
    zeroStock,
    totalIssuedThisMonth,
    totalReceivedThisMonth,
    totalIssuedPrevMonth,
    issueChange,
    totalMovements: currentMvmts.length,
    requestsFulfilled,
    requestsPending,
    requestsRejected,
    totalRequests: monthRequests.length,
    insights,
  };
}

export default async function InventoryReportPage() {
  const {
    monthName,
    topConsumed,
    criticalStock,
    totalIssuedThisMonth,
    totalReceivedThisMonth,
    totalIssuedPrevMonth,
    issueChange,
    totalMovements,
    requestsFulfilled,
    requestsPending,
    requestsRejected,
    totalRequests,
    insights,
  } = await getReportData();

  const kpis = [
    { label: "Total Issued", value: totalIssuedThisMonth, color: "text-amber-700" },
    { label: "Total Received", value: totalReceivedThisMonth, color: "text-green-700" },
    { label: "Movements", value: totalMovements, color: "text-[#d9647f]" },
    {
      label: "vs Last Month",
      value: `${issueChange >= 0 ? "+" : ""}${issueChange}%`,
      color: Math.abs(issueChange) > 20 ? "text-amber-700" : "text-[#d9647f]",
    },
    { label: "Parts Fulfilled", value: requestsFulfilled, color: "text-green-700" },
    { label: "Parts Pending", value: requestsPending, color: requestsPending > 0 ? "text-amber-700" : "text-[#d9647f]" },
    { label: "Rejected", value: requestsRejected, color: requestsRejected > 0 ? "text-red-600" : "text-[#8b97ab]" },
  ];

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <div className="flex gap-3 text-sm">
            <Link href="/" className="text-[#5b6b85] hover:text-[#b01b42]">← Dashboard</Link>
            <Link href="/inventory" className="text-[#5b6b85] hover:text-[#b01b42]">← Inventory</Link>
          </div>
          <h1 className="mt-1">Inventory Report — {monthName}</h1>
          <p className="text-[#5b6b85] text-sm mt-1">
            AI-analyzed monthly inventory summary with consumption insights and recommendations.
          </p>
        </div>
        <div className="text-xs text-[#8b97ab]">
          Generated: {new Date().toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="lux-card p-4 text-center">
            <p className={`text-2xl font-extrabold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-[#5b6b85] uppercase tracking-wider mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <section className="border border-[#b01b42] bg-[#ffffff] rounded-xl p-5 mb-8">
        <h2 className="eyebrow mb-3">
          AI Insights & Recommendations
        </h2>
        <ul className="space-y-2">
          {insights.map((insight, idx) => (
            <li key={idx} className="text-sm text-[#16233c] flex gap-2">
              <span className="text-[#b01b42] font-bold shrink-0">→</span>
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <section className="lux-card p-5">
          <h2 className="eyebrow mb-3">
            Top 10 Consumed Items
          </h2>
          {topConsumed.length === 0 || topConsumed[0].totalIssued === 0 ? (
            <p className="text-[#8b97ab] text-sm">No items issued this month.</p>
          ) : (
            <div className="space-y-2">
              {topConsumed
                .filter((s) => s.totalIssued > 0)
                .map((s, idx) => {
                  const maxIssued = topConsumed[0].totalIssued;
                  const pct = maxIssued > 0 ? (s.totalIssued / maxIssued) * 100 : 0;
                  return (
                    <div key={idx}>
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="font-medium">
                          {s.name}
                          {s.sku && <span className="text-[#8b97ab] ml-1">({s.sku})</span>}
                        </span>
                        <span className="text-[#d9647f] font-bold">
                          {s.totalIssued} {s.unit ?? ""}
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#f4f6fa] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#b01b42] rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        <section className="lux-card p-5">
          <h2 className="eyebrow mb-3">
            Critical Stock Levels
          </h2>
          {criticalStock.length === 0 ? (
            <p className="text-green-700 text-sm">All items above reorder threshold.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#5b6b85]">
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 font-medium">On Hand</th>
                  <th className="py-2 font-medium">Threshold</th>
                  <th className="py-2 font-medium">Deficit</th>
                </tr>
              </thead>
              <tbody>
                {criticalStock.map((s, idx) => (
                  <tr key={idx} className="border-b border-[rgba(176,27,66,0.08)]">
                    <td className="py-2 font-medium">
                      {s.name}
                      {s.sku && <span className="text-[#8b97ab] ml-1">({s.sku})</span>}
                    </td>
                    <td className={`py-2 font-bold ${s.currentStock <= 0 ? "text-red-600" : "text-amber-700"}`}>
                      {s.currentStock}
                    </td>
                    <td className="py-2 text-[#8b97ab]">{s.reorderThreshold}</td>
                    <td className="py-2 text-red-600 font-bold">
                      {s.reorderThreshold - s.currentStock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="lux-card p-5">
        <h2 className="eyebrow mb-3">
          Parts Request Summary — {monthName}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-extrabold text-[#d9647f]">{totalRequests}</p>
            <p className="text-[10px] text-[#5b6b85] uppercase tracking-wider mt-1">Total Requests</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-green-700">{requestsFulfilled}</p>
            <p className="text-[10px] text-[#5b6b85] uppercase tracking-wider mt-1">Fulfilled</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-amber-700">{requestsPending}</p>
            <p className="text-[10px] text-[#5b6b85] uppercase tracking-wider mt-1">In Progress</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-red-600">{requestsRejected}</p>
            <p className="text-[10px] text-[#5b6b85] uppercase tracking-wider mt-1">Rejected</p>
          </div>
        </div>
        {totalRequests > 0 && (
          <div className="mt-4 h-3 bg-[#f4f6fa] rounded-full overflow-hidden flex">
            {requestsFulfilled > 0 && (
              <div
                className="h-full bg-green-500"
                style={{ width: `${(requestsFulfilled / totalRequests) * 100}%` }}
              />
            )}
            {requestsPending > 0 && (
              <div
                className="h-full bg-amber-500"
                style={{ width: `${(requestsPending / totalRequests) * 100}%` }}
              />
            )}
            {requestsRejected > 0 && (
              <div
                className="h-full bg-red-500"
                style={{ width: `${(requestsRejected / totalRequests) * 100}%` }}
              />
            )}
          </div>
        )}
      </section>
    </main>
  );
}
