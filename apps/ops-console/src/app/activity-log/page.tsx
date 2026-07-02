import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import PageHeader from "@/components/PageHeader";
import { ScrollText } from "lucide-react";
import ExportCsv from "@/components/ExportCsv";

type ActivityRow = {
  id: string;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  user: { full_name: string } | null;
};

const ENTITY_LINKS: Record<string, string> = {
  work_order: "/work-orders",
  complaint: "/complaints",
  purchase_order: "/purchasing",
  tender: "/tenders",
  invoice: "/invoices",
  maintenance_schedule: "/maintenance",
  visitor: "/visitors",
  booking: "/bookings",
};

const ACTION_STYLE: Record<string, string> = {
  created: "text-green-700",
  updated: "text-[#d9647f]",
  deleted: "text-red-600",
  approved: "text-green-700",
  rejected: "text-red-700",
  escalated: "text-amber-700",
  completed: "text-green-700",
  assigned: "text-[#d9647f]",
  verified: "text-green-700",
  paid: "text-[#b01b42]",
  disputed: "text-red-600",
};

const ENTITY_STYLE: Record<string, string> = {
  work_order: "bg-[rgba(176,27,66,0.12)] text-[#d9647f]",
  complaint: "bg-[#e9eef6] text-[#5b6b85]",
  purchase_order: "bg-[rgba(176,27,66,0.12)] text-[#d9647f]",
  tender: "bg-[#e9eef6] text-[#5b6b85]",
  invoice: "bg-[rgba(176,27,66,0.12)] text-[#d9647f]",
  maintenance_schedule: "bg-[#e9eef6] text-[#5b6b85]",
  visitor: "bg-[#e9eef6] text-[#5b6b85]",
  booking: "bg-[rgba(176,27,66,0.12)] text-[#d9647f]",
  user: "bg-[#e9eef6] text-[#5b6b85]",
};

async function getPageData() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("activity_log")
    .select(
      `id, user_name, action, entity_type, entity_id, entity_label, details, created_at,
       user:user_profiles(full_name)`
    )
    .order("created_at", { ascending: false })
    .limit(500);

  return { logs: (logs ?? []) as unknown as ActivityRow[] };
}

export default async function ActivityLogPage() {
  const { logs } = await getPageData();

  const grouped = new Map<string, ActivityRow[]>();
  for (const log of logs) {
    const day = new Date(log.created_at).toLocaleDateString("en-AE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)!.push(log);
  }

  const csvRows = logs.map((log) => ({
    Timestamp: new Date(log.created_at).toISOString(),
    User: log.user?.full_name ?? log.user_name ?? "System",
    Action: log.action,
    "Entity Type": log.entity_type,
    "Entity Label": log.entity_label ?? "",
  }));

  return (
    <main className="p-6 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="eyebrow mb-1.5 flex items-center gap-2"><ScrollText size={12} /> Insight &amp; Reporting</p>
        <h1 className="text-2xl font-extrabold mt-1">Activity Log</h1>
        <p className="text-[#5b6b85] text-sm mt-1">
          Complete audit trail of all operations across the platform.
        </p>
        <div className="mt-3 mb-4">
          <ExportCsv rows={csvRows} filename="activity-log" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="lux-card p-4 text-center">
          <p className="text-2xl font-extrabold text-[#d9647f]">{logs.length}</p>
          <p className="text-[10px] text-[#5b6b85] uppercase tracking-wider mt-1">Total Events</p>
        </div>
        <div className="lux-card p-4 text-center">
          <p className="text-2xl font-extrabold text-green-700">
            {logs.filter((l) => l.action === "created").length}
          </p>
          <p className="text-[10px] text-[#5b6b85] uppercase tracking-wider mt-1">Created</p>
        </div>
        <div className="lux-card p-4 text-center">
          <p className="text-2xl font-extrabold text-[#d9647f]">
            {logs.filter((l) => l.action === "updated").length}
          </p>
          <p className="text-[10px] text-[#5b6b85] uppercase tracking-wider mt-1">Updated</p>
        </div>
        <div className="lux-card p-4 text-center">
          <p className="text-2xl font-extrabold text-[#d9647f]">
            {new Set(logs.map((l) => l.user_name ?? l.user?.full_name)).size}
          </p>
          <p className="text-[10px] text-[#5b6b85] uppercase tracking-wider mt-1">Active Users</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12 text-[#8b97ab]">
          <p className="text-lg">No activity recorded yet.</p>
          <p className="text-sm mt-1">Events will appear here as your team uses the platform.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([day, dayLogs]) => (
            <section key={day}>
              <h2 className="eyebrow mb-3 sticky top-0 bg-[#f4f6fa] py-2 z-10">
                {day} ({dayLogs.length})
              </h2>
              <div className="space-y-1">
                {dayLogs.map((log) => {
                  const userName = log.user?.full_name ?? log.user_name ?? "System";
                  const link = log.entity_id && ENTITY_LINKS[log.entity_type]
                    ? `${ENTITY_LINKS[log.entity_type]}/${log.entity_id}`
                    : null;
                  return (
                    <div
                      key={log.id}
                      className="border border-[rgba(176,27,66,0.08)] rounded-lg p-3 flex items-start gap-3 hover:bg-[#ffffff]"
                    >
                      <div className="text-[10px] text-[#8b97ab] w-16 shrink-0 pt-0.5">
                        {new Date(log.created_at).toLocaleTimeString("en-AE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{userName}</span>{" "}
                          <span className={ACTION_STYLE[log.action] ?? "text-[#5b6b85]"}>{log.action}</span>{" "}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ENTITY_STYLE[log.entity_type] ?? "bg-[#e9eef6] text-[#5b6b85]"}`}>
                            {log.entity_type.replace(/_/g, " ")}
                          </span>{" "}
                          {link ? (
                            <Link href={link} className="text-[#d9647f] hover:underline">
                              {log.entity_label ?? log.entity_id?.slice(0, 8)}
                            </Link>
                          ) : (
                            <span className="text-[#5b6b85]">{log.entity_label ?? ""}</span>
                          )}
                        </p>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <p className="text-[10px] text-[#8b97ab] mt-0.5 truncate">
                            {Object.entries(log.details)
                              .map(([k, v]) => `${k}: ${String(v)}`)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
