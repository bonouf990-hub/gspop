import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { COLORS, SHADOWS } from "../theme";

type Props = {
  navigation: { navigate: (screen: string, params: { workOrderId: string }) => void };
};

type JobRow = {
  id: string;
  title: string;
  priority: string;
  status: string;
  type: string;
  properties: { name: string } | null;
  units: { label: string } | null;
};

const TABS = ["active", "completed"] as const;
type Tab = (typeof TABS)[number];

const ACTIVE_STATUSES = ["assigned", "in_progress", "paused"];
const COMPLETED_STATUSES = ["completed_by_technician", "verified_by_supervisor", "confirmed_by_resident", "closed"];

export default function JobListScreen({ navigation }: Props) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("active");

  const loadJobs = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const technicianId = userData.user?.id;
    const statuses = tab === "active" ? ACTIVE_STATUSES : COMPLETED_STATUSES;
    const { data } = await supabase
      .from("work_orders")
      .select("id, title, priority, status, type, properties(name), units(label)")
      .eq("assigned_technician_id", technicianId)
      .in("status", statuses)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    setJobs((data ?? []) as unknown as JobRow[]);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    loadJobs();
  }, [loadJobs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  }, [loadJobs]);

  return (
    <View style={s.screen}>
      <View style={s.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === "active" ? "Active Jobs" : "Completed"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
        }
        renderItem={({ item }) => {
          const property = item.properties as { name: string } | null;
          const unit = item.units as { label: string } | null;
          const prio = priorityMeta(item.priority);
          const stat = statusMeta(item.status);
          return (
            <TouchableOpacity
              style={s.card}
              onPress={() => navigation.navigate("JobDetail", { workOrderId: item.id })}
              activeOpacity={0.7}
            >
              <View style={s.cardTop}>
                <View style={[s.priorityStrip, { backgroundColor: prio.color }]} />
                <View style={s.cardContent}>
                  <View style={s.badgeRow}>
                    <View style={[s.badge, { backgroundColor: prio.bg }]}>
                      <Text style={[s.badgeText, { color: prio.color }]}>{item.priority.toUpperCase()}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: stat.bg }]}>
                      <Text style={[s.badgeText, { color: stat.color }]}>{item.status.replace(/_/g, " ")}</Text>
                    </View>
                  </View>
                  <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={s.cardMeta}>
                    <Text style={s.metaLocation} numberOfLines={1}>
                      {[property?.name, unit?.label].filter(Boolean).join("  ·  ") || "—"}
                    </Text>
                  </View>
                  <View style={s.cardBottom}>
                    <Text style={s.typeLabel}>{item.type}</Text>
                    <Text style={s.chevron}>›</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading ? null : (
            <View style={s.emptyContainer}>
              <View style={s.emptyIcon}>
                <Text style={s.emptyIconText}>{tab === "active" ? "✓" : "—"}</Text>
              </View>
              <Text style={s.emptyTitle}>
                {tab === "active" ? "All Clear" : "No History"}
              </Text>
              <Text style={s.emptyDesc}>
                {tab === "active"
                  ? "No active jobs assigned right now."
                  : "Completed jobs will appear here."}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

function priorityMeta(p: string) {
  switch (p) {
    case "emergency": return { color: "#e74c3c", bg: "rgba(231,76,60,0.12)" };
    case "high": return { color: "#f39c12", bg: "rgba(243,156,18,0.12)" };
    case "medium": return { color: "#5dade2", bg: "rgba(93,173,226,0.12)" };
    default: return { color: "#7f8c8d", bg: "rgba(127,140,141,0.12)" };
  }
}

function statusMeta(s: string) {
  if (s === "in_progress") return { color: "#f39c12", bg: "rgba(243,156,18,0.12)" };
  if (s === "assigned") return { color: "#5dade2", bg: "rgba(93,173,226,0.12)" };
  if (s === "paused") return { color: "#e67e22", bg: "rgba(230,126,34,0.12)" };
  if (s.includes("completed") || s === "closed") return { color: "#27ae60", bg: "rgba(39,174,96,0.12)" };
  return { color: "#7f8c8d", bg: "rgba(127,140,141,0.12)" };
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  tabActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  tabText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600", letterSpacing: 0.5 },
  tabTextActive: { color: COLORS.background, fontWeight: "700" },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    overflow: "hidden",
    ...SHADOWS.card,
  },
  cardTop: { flexDirection: "row" },
  priorityStrip: { width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  cardContent: { flex: 1, padding: 16 },
  badgeRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  cardTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: "700", lineHeight: 22 },
  cardMeta: { marginTop: 6 },
  metaLocation: { color: COLORS.textSecondary, fontSize: 12, letterSpacing: 0.3 },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.hairline,
  },
  typeLabel: { color: COLORS.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "600" },
  chevron: { color: COLORS.gold, fontSize: 22, fontWeight: "300" },
  emptyContainer: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.goldPale,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIconText: { color: COLORS.gold, fontSize: 24 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: 6 },
  emptyDesc: { color: COLORS.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 19 },
});
