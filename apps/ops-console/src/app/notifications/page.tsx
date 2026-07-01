import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import NotificationActions from "./NotificationActions";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  link: string | null;
  is_read: boolean;
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
  info: { bg: "border-blue-500/30 bg-blue-950/10", dot: "bg-blue-400" },
  warning: { bg: "border-amber-500/30 bg-amber-950/10", dot: "bg-amber-400" },
  urgent: { bg: "border-red-500/30 bg-red-950/10", dot: "bg-red-400" },
  success: { bg: "border-green-500/30 bg-green-950/10", dot: "bg-green-400" },
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

  const unread = notifications.filter((n) => !n.is_read);
  const urgent = notifications.filter((n) => n.type === "urgent" && !n.is_read);

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-extrabold mt-1">Notifications</h1>
          <p className="text-[#a0977e] text-sm mt-1">
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
          <h2 className="text-xs font-bold text-red-400 tracking-[0.15em] uppercase mb-3">
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
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
          All Notifications ({notifications.length})
        </h2>
        <div className="space-y-2">
          {notifications.map((n) => (
            <NotificationCard key={n.id} n={n} />
          ))}
          {notifications.length === 0 && (
            <p className="text-[#6b6454] text-center py-8">No notifications yet.</p>
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

  return (
    <div
      className={`border rounded-xl p-4 flex items-start gap-3 ${style.bg} ${
        n.is_read ? "opacity-60" : ""
      }`}
    >
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.is_read ? "bg-[#6b6454]" : style.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium ${n.is_read ? "text-[#a0977e]" : ""}`}>{n.title}</p>
          <span className="text-[10px] text-[#6b6454] shrink-0">{timeAgo}</span>
        </div>
        <p className="text-xs text-[#a0977e] mt-0.5">{n.message}</p>
        <div className="flex items-center gap-2 mt-2">
          {href && (
            <Link
              href={href}
              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#213052] text-[#d4af5a] hover:bg-[rgba(184,144,47,0.15)]"
            >
              View Details
            </Link>
          )}
          {!n.is_read && (
            <NotificationActions mode="mark-read" ids={[n.id]} />
          )}
        </div>
      </div>
    </div>
  );
}
