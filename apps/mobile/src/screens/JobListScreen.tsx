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
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "active" ? "Active" : "Completed"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2F6FED" />
        }
        renderItem={({ item }) => {
          const property = item.properties as { name: string } | null;
          const unit = item.units as { label: string } | null;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("JobDetail", { workOrderId: item.id })}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.priorityDot, dotColor(item.priority)]} />
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
              <Text style={styles.cardLocation} numberOfLines={1}>
                {[property?.name, unit?.label].filter(Boolean).join(" · ") || "—"}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardType}>{item.type}</Text>
                <Text style={styles.cardStatus}>{item.status.replace(/_/g, " ")}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.empty}>
              {tab === "active" ? "No active jobs." : "No completed jobs yet."}
            </Text>
          )
        }
      />
    </View>
  );
}

function dotColor(priority: string) {
  switch (priority) {
    case "emergency": return { backgroundColor: "#EF4444" };
    case "high": return { backgroundColor: "#F59E0B" };
    case "medium": return { backgroundColor: "#3B82F6" };
    default: return { backgroundColor: "#6B7280" };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1320" },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#162335",
  },
  tabActive: { backgroundColor: "#2F6FED" },
  tabText: { color: "#8FA3BF", fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  card: {
    backgroundColor: "#162335",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "600", flex: 1 },
  cardLocation: { color: "#8FA3BF", fontSize: 13, marginBottom: 8 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between" },
  cardType: { color: "#6B7D99", fontSize: 12, textTransform: "capitalize" },
  cardStatus: { color: "#8FA3BF", fontSize: 12, textTransform: "capitalize" },
  empty: { color: "#8FA3BF", textAlign: "center", marginTop: 40, fontSize: 14 },
});
