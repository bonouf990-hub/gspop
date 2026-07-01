import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

type Props = {
  onLogout: () => void;
};

export default function ProfileScreen({ onLogout }: Props) {
  const [profile, setProfile] = useState<{
    full_name: string;
    role: string;
    trade: string | null;
    department: string | null;
    phone: string | null;
    email: string;
  } | null>(null);
  const [stats, setStats] = useState<{
    jobsCompleted: number;
    jobsInProgress: number;
    totalHours: number;
    avgRating: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const { data: p } = await supabase
        .from("user_profiles")
        .select("full_name, role, trade, department, phone")
        .eq("id", userId)
        .single();

      if (p) {
        setProfile({ ...p, email: userData.user!.email ?? "" });
      }

      const { data: s } = await supabase
        .from("technician_job_stats")
        .select("jobs_completed, jobs_in_progress, total_hours_logged, avg_supervisor_rating")
        .eq("technician_id", userId)
        .single();

      if (s) {
        setStats({
          jobsCompleted: s.jobs_completed ?? 0,
          jobsInProgress: s.jobs_in_progress ?? 0,
          totalHours: Math.round((s.total_hours_logged ?? 0) * 10) / 10,
          avgRating: Math.round((s.avg_supervisor_rating ?? 0) * 10) / 10,
        });
      }

      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          onLogout();
        },
      },
    ]);
  }

  if (loading) return <ActivityIndicator style={styles.center} size="large" />;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.full_name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() ?? "?"}
          </Text>
        </View>
        <Text style={styles.name}>{profile?.full_name ?? "—"}</Text>
        <Text style={styles.role}>
          {profile?.trade ? `${profile.trade.toUpperCase()} · ` : ""}
          {profile?.role?.replace(/_/g, " ") ?? ""}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contact</Text>
        <Row label="Email" value={profile?.email ?? "—"} />
        <Row label="Phone" value={profile?.phone ?? "—"} />
        <Row label="Department" value={profile?.department ?? "—"} />
      </View>

      {stats && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Performance</Text>
          <View style={styles.statsGrid}>
            <StatBox label="Completed" value={String(stats.jobsCompleted)} />
            <StatBox label="In Progress" value={String(stats.jobsInProgress)} />
            <StatBox label="Hours" value={String(stats.totalHours)} />
            <StatBox label="Avg Rating" value={stats.avgRating > 0 ? `${stats.avgRating}/5` : "—"} />
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1320", padding: 16 },
  center: { flex: 1, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 24, marginTop: 8 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#2F6FED",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "700" },
  name: { color: "#fff", fontSize: 20, fontWeight: "700" },
  role: { color: "#8FA3BF", fontSize: 14, marginTop: 4, textTransform: "capitalize" },
  card: { backgroundColor: "#162335", borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { color: "#fff", fontWeight: "700", fontSize: 15, marginBottom: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#243349",
  },
  rowLabel: { color: "#8FA3BF", fontSize: 14 },
  rowValue: { color: "#fff", fontSize: 14 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap" },
  statBox: {
    width: "50%",
    alignItems: "center",
    paddingVertical: 12,
  },
  statValue: { color: "#fff", fontSize: 22, fontWeight: "700" },
  statLabel: { color: "#8FA3BF", fontSize: 12, marginTop: 2 },
  logoutButton: {
    backgroundColor: "#2D1B1B",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: "#5C2B2B",
  },
  logoutText: { color: "#EF4444", fontWeight: "600", fontSize: 15 },
});
