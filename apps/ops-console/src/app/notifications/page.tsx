import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import NotificationActions from "./NotificationActions";

type NotificationRow = {
  id: string;
  title: string | null;
  message: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const ENTITY_LINKS: Record<string, string> = {
  work_order: "/work-orders",
  complaint: "/complaints",
  purchase_order: "/purchasing",
  tender: "/tenders",
  invoice: "/invoices",
  maintenance_schedule: "/maintenance",
};

const TYPE_STYLE: Record<string, { bg: string; dot: string }> = {
  info: { bg: "border-blue-200 bg-blue-50", dot: "bg-blue-400" },
  warning: { bg: "border-amber-200 bg-amber-50", dot: "bg-amber-400" },
  urgent: { bg: "border-red-200 bg-red-50", dot: "bg-red-400" },
  success: { bg: "border-green-200 bg-green-50", dot: "bg-green-400" },
};

async function getPageData() {
  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return { notifications: (notifications ?? []) as NotificationRow[] };
}

export default async function NotificationsPage() {
  const { notifications } = await getPageData();

  const unread = notifications.filter((n) => !n.read_at);
  const urgent = notifications.filter((n) => n.type === "urgent" && !n.read_at);

  return (
    <main className="p-6 sm:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold mt-1">Notifications</h1>
          <p className="text-[#5b6b85] text-sm mt-1">
            {unread.length > 0
              ? `${unread.length} unread notification${unread.length === 1 ? "" : "s"}`
              : "All caught up"}
          </p>
        </div>
        {unread.length > 0 && (
          <NotificationActions mode="mark-all-read" ids={unread.map((n) => n.id)} />
        )}
      </div>

      {urgent.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-bold text-red-600 tracking-[0.15em] uppercase mb-3">
            Urgent ({urgent.length})
          </h2>
          <div className="space-y-2">
            {urgent.map((n) => (
              <NotificationCard key={n.id} n={n} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="eyebrow mb-3">
          All Notifications ({notifications.length})
        </h2>
        <div className="space-y-2">
          {notifications.map((n) => (
            <NotificationCard key={n.id} n={n} />
          ))}
          {notifications.length === 0 && (
            <p className="text-[#8b97ab] text-center py-8">No notifications yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function NotificationCard({ n }: { n: NotificationRow }) {
  const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.info;
  const href = n.link
    ? n.link
    : n.entity_type && n.entity_id && ENTITY_LINKS[n.entity_type]
      ? `${ENTITY_LINKS[n.entity_type]}/${n.entity_id}`
      : null;

  const now = Date.now();
  const created = new Date(n.created_at).getTime();
  const diffMin = Math.floor((now - created) / 60000);
  let timeAgo: string;
  if (diffMin < 1) timeAgo = "just now";
  else if (diffMin < 60) timeAgo = `${diffMin}m ago`;
  else if (diffMin < 1440) timeAgo = `${Math.floor(diffMin / 60)}h ago`;
  else timeAgo = `${Math.floor(diffMin / 1440)}d ago`;

  const isRead = Boolean(n.read_at);

  return (
    <div
      className={`border rounded-xl p-4 flex items-start gap-3 shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)] ${style.bg} ${
        isRead ? "opacity-60" : ""
      }`}
    >
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isRead ? "bg-[#8b97ab]" : style.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium ${isRead ? "text-[#5b6b85]" : ""}`}>{n.title ?? n.message}</p>
          <span className="text-[10px] text-[#8b97ab] shrink-0">{timeAgo}</span>
        </div>
        {n.title && <p className="text-xs text-[#5b6b85] mt-0.5">{n.message}</p>}
        <div className="flex items-center gap-2 mt-2">
          {href && (
            <Link
              href={href}
              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#e9eef6] text-[#d9647f] hover:bg-[rgba(176,27,66,0.15)]"
            >
              View Details
            </Link>
          )}
          {!isRead && (
            <NotificationActions mode="mark-read" ids={[n.id]} />
          )}
        </div>
      </div>
    </div>
  );
}
