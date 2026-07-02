"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { camelCaseKeys, type AppNotification } from "@gspop/shared";
import BottomNav from "@/components/BottomNav";
import { Bell, Wrench, Megaphone, CreditCard, ChevronRight } from "lucide-react";

const TYPE_META: Record<string, { Icon: typeof Bell; href: (n: AppNotification) => string }> = {
  complaint_status_update: { Icon: Wrench, href: (n) => `/complaints/${n.entityId}` },
  complaint_new: { Icon: Wrench, href: (n) => `/complaints/${n.entityId}` },
  notice_posted: { Icon: Megaphone, href: () => "/notices" },
  rent_cleared: { Icon: CreditCard, href: () => "/rent" },
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", user?.id ?? "")
        .order("created_at", { ascending: false })
        .limit(50);
      const list = camelCaseKeys<AppNotification[]>(data ?? []);
      setItems(list);
      setLoading(false);

      // Mark everything currently unread as read.
      const unreadIds = list.filter((n) => !n.readAt).map((n) => n.id);
      if (unreadIds.length > 0) {
        await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .in("id", unreadIds);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen pb-32">
      <div className="px-6 pt-10 pb-6">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1.5">
          Updates
        </p>
        <h1 className="font-display text-3xl text-[#eef1f6] font-semibold">Notifications</h1>
      </div>

      <div className="px-5">
        <section className="elevated-card rounded-2xl p-5">
          <ul className="space-y-1">
            {items.map((n) => {
              const meta = TYPE_META[n.type];
              const Icon = meta?.Icon ?? Bell;
              const href = meta?.href(n) ?? "#";
              const unread = !n.readAt;
              return (
                <li key={n.id}>
                  <Link
                    href={href}
                    className="flex items-start gap-3 py-3 border-b border-[var(--hairline)] last:border-0"
                  >
                    <span
                      className={`mt-0.5 w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${
                        unread ? "bg-[var(--gold)] text-[#0f1626]" : "bg-[var(--gold-pale)] text-[var(--gold)]"
                      }`}
                    >
                      <Icon size={16} strokeWidth={1.9} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${unread ? "text-[#eef1f6] font-medium" : "text-[var(--muted)]"}`}>
                        {n.message}
                      </p>
                      <p className="text-[10px] text-[var(--muted)] mt-1 uppercase tracking-wide">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-[#5d6880] mt-1 shrink-0" />
                  </Link>
                </li>
              );
            })}
            {!loading && items.length === 0 && (
              <div className="text-center py-8">
                <Bell size={28} className="mx-auto mb-2 text-[var(--gold)]" strokeWidth={1.5} />
                <p className="text-[var(--muted)] text-sm">You&apos;re all caught up.</p>
              </div>
            )}
          </ul>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
