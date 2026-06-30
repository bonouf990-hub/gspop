import React, { useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View, StyleSheet, ActivityIndicator } from "react-native";
import type { WorkOrder } from "@gspop/shared";
import { supabase } from "../lib/supabase";

type Props = {
  navigation: { navigate: (screen: string, params: { workOrderId: string }) => void };
};

export default function JobListScreen({ navigation }: Props) {
  const [jobs, setJobs] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadJobs() {
      const { data: userData } = await supabase.auth.getUser();
      const technicianId = userData.user?.id;
      const { data } = await supabase
        .from("work_orders")
        .select("*")
        .eq("assigned_technician_id", technicianId)
        .in("status", ["assigned", "in_progress", "paused"])
        .order("priority", { ascending: false });
      setJobs((data ?? []) as unknown as WorkOrder[]);
      setLoading(false);
    }
    loadJobs();
  }, []);

  if (loading) return <ActivityIndicator style={styles.center} size="large" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate("JobDetail", { workOrderId: item.id })}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.priority.toUpperCase()} · {item.status.replace(/_/g, " ")}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No jobs assigned right now.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0B1320" },
  center: { flex: 1, justifyContent: "center" },
  card: {
    backgroundColor: "#162335",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "600" },
  meta: { color: "#8FA3BF", marginTop: 4, fontSize: 13 },
  empty: { color: "#8FA3BF", textAlign: "center", marginTop: 40 },
});
