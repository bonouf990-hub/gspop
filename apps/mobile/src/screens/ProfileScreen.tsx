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
import { BASE, COLORS, SHADOWS } from "../theme";

type Props = { onLogout: () => void };

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

      if (p) setProfile({ ...p, email: userData.user!.email ?? "" });

      const { data: st } = await supabase
        .from("technician_job_stats")
        .select("jobs_completed, jobs_in_progress, total_hours_logged, avg_supervisor_rating")
        .eq("technician_id", userId)
        .single();

      if (st) {
        setStats({
          jobsCompleted: st.jobs_completed ?? 0,
          jobsInProgress: st.jobs_in_progress ?? 0,
          totalHours: Math.round((st.total_hours_logged ?? 0) * 10) / 10,
          avgRating: Math.round((st.avg_supervisor_rating ?? 0) * 10) / 10,
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  function handleLogout() {
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

  if (loading) return <ActivityIndicator style={s.center} size="large" color={COLORS.gold} />;

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "?";

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.heroSection}>
        <View style={s.avatarRing}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
        </View>
        <Text style={s.name}>{profile?.full_name ?? "—"}</Text>
        {profile?.trade && (
          <View style={s.tradeBadge}>
            <Text style={s.tradeBadgeText}>{profile.trade.toUpperCase()}</Text>
          </View>
        )}
        <Text style={s.roleLabel}>{profile?.role?.replace(/_/g, " ") ?? ""}</Text>
        <View style={s.goldBar} />
      </View>

      <View style={s.content}>
        <View style={BASE.card}>
          <Text style={BASE.goldLabel}>CONTACT INFORMATION</Text>
          <InfoRow label="Email" value={profile?.email ?? "—"} />
          <InfoRow label="Phone" value={profile?.phone ?? "—"} />
          <InfoRow label="Department" value={profile?.department ?? "—"} last />
        </View>

        {stats && (
          <View style={BASE.card}>
            <Text style={BASE.goldLabel}>PERFORMANCE</Text>
            <View style={s.statsGrid}>
              <StatBox label="Completed" value={String(stats.jobsCompleted)} icon="✓" />
              <StatBox label="In Progress" value={String(stats.jobsInProgress)} icon="⚡" />
              <StatBox label="Hours" value={String(stats.totalHours)} icon="⏱" />
              <StatBox label="Rating" value={stats.avgRating > 0 ? `${stats.avgRating}` : "—"} icon="★" suffix="/5" />
            </View>
          </View>
        )}

        <TouchableOpacity style={s.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.row, !last && s.rowBorder]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

function StatBox({ label, value, icon, suffix }: { label: string; value: string; icon: string; suffix?: string }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={s.statValue}>
        {value}
        {suffix && <Text style={s.statSuffix}>{suffix}</Text>}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: "center", backgroundColor: COLORS.background },
  heroSection: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 24,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: COLORS.gold,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: COLORS.gold, fontSize: 28, fontWeight: "800", letterSpacing: 1 },
  name: { color: COLORS.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: 0.5 },
  tradeBadge: {
    backgroundColor: COLORS.goldPale,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  tradeBadgeText: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  roleLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 6,
    textTransform: "capitalize",
    letterSpacing: 0.5,
  },
  goldBar: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.gold,
    marginTop: 16,
    borderRadius: 1,
  },
  content: { paddingHorizontal: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hairline,
  },
  rowLabel: { color: COLORS.textSecondary, fontSize: 13 },
  rowValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: "500" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap" },
  statBox: {
    width: "50%",
    alignItems: "center",
    paddingVertical: 14,
  },
  statIcon: { fontSize: 16, marginBottom: 4 },
  statValue: { color: COLORS.textPrimary, fontSize: 26, fontWeight: "800" },
  statSuffix: { fontSize: 14, fontWeight: "500", color: COLORS.textSecondary },
  statLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3, letterSpacing: 0.5, fontWeight: "500" },
  logoutButton: {
    backgroundColor: COLORS.dangerBg,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(192,57,43,0.25)",
  },
  logoutText: { color: COLORS.danger, fontWeight: "700", fontSize: 14, letterSpacing: 0.5 },
});
