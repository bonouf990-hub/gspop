import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import type { WorkOrder } from "@gspop/shared";
import { supabase } from "../lib/supabase";

type Props = {
  route: { params: { workOrderId: string } };
  navigation: { goBack: () => void };
};

type JobContext = {
  propertyName: string | null;
  unitLabel: string | null;
  assetName: string | null;
  assetCategory: string | null;
};

export default function JobDetailScreen({ route, navigation }: Props) {
  const { workOrderId } = route.params;
  const [job, setJob] = useState<WorkOrder | null>(null);
  const [context, setContext] = useState<JobContext | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [completionNotes, setCompletionNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadJob();
  }, [workOrderId]);

  useEffect(() => {
    if (checkedIn) {
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [checkedIn]);

  async function loadJob() {
    const { data } = await supabase
      .from("work_orders")
      .select("*, properties(name), units(label), assets(name, category)")
      .eq("id", workOrderId)
      .single();

    if (!data) return;

    const property = data.properties as unknown as { name: string } | null;
    const unit = data.units as unknown as { label: string } | null;
    const asset = data.assets as unknown as { name: string; category: string } | null;

    setJob(data as unknown as WorkOrder);
    setContext({
      propertyName: property?.name ?? null,
      unitLabel: unit?.label ?? null,
      assetName: asset?.name ?? null,
      assetCategory: asset?.category ?? null,
    });

    if (data.status === "in_progress") {
      setCheckedIn(true);
      const { data: checkins } = await supabase
        .from("work_order_checkins")
        .select("timestamp")
        .eq("work_order_id", workOrderId)
        .eq("type", "check_in")
        .order("timestamp", { ascending: false })
        .limit(1);
      if (checkins?.[0]) {
        const elapsed = Math.floor(
          (Date.now() - new Date(checkins[0].timestamp).getTime()) / 1000
        );
        setElapsedSeconds(Math.max(0, elapsed));
      }
    }

    const { data: existingPhotos } = await supabase
      .from("work_order_photos")
      .select("stage, storage_path")
      .eq("work_order_id", workOrderId);

    if (existingPhotos) {
      const befores = existingPhotos.filter((p) => p.stage === "before").map((p) => p.storage_path as string);
      const afters = existingPhotos.filter((p) => p.stage === "after").map((p) => p.storage_path as string);

      if (befores.length > 0) {
        const { data: signed } = await supabase.storage
          .from("work-order-photos")
          .createSignedUrls(befores, 3600);
        setBeforePhotos((signed ?? []).map((s) => s.signedUrl).filter((u): u is string => !!u));
      }
      if (afters.length > 0) {
        const { data: signed } = await supabase.storage
          .from("work-order-photos")
          .createSignedUrls(afters, 3600);
        setAfterPhotos((signed ?? []).map((s) => s.signedUrl).filter((u): u is string => !!u));
      }
    }
  }

  async function capturePhoto(stage: "before" | "after") {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera required", "Camera permission is needed to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const ext = asset.uri.split(".").pop() ?? "jpg";
    const fileName = `${workOrderId}/${stage}_${Date.now()}.${ext}`;

    const response = await fetch(asset.uri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from("work-order-photos")
      .upload(fileName, blob, { contentType: asset.mimeType ?? "image/jpeg" });

    if (uploadError) {
      Alert.alert("Upload failed", uploadError.message);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("work_order_photos").insert({
      work_order_id: workOrderId,
      stage,
      storage_path: fileName,
      taken_by: userData.user?.id,
    });

    const { data: signed } = await supabase.storage
      .from("work-order-photos")
      .createSignedUrl(fileName, 3600);

    if (signed) {
      if (stage === "before") {
        setBeforePhotos((prev) => [...prev, signed.signedUrl]);
      } else {
        setAfterPhotos((prev) => [...prev, signed.signedUrl]);
      }
    }
  }

  async function recordGpsEvent(type: "check_in" | "check_out") {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location required", "GPS location is required to check in/out of a job.");
      return null;
    }
    const position = await Location.getCurrentPositionAsync({});
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("work_order_checkins").insert({
      work_order_id: workOrderId,
      technician_id: userData.user?.id,
      type,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy_meters: position.coords.accuracy,
    });
    return position;
  }

  async function handleCheckIn() {
    if (beforePhotos.length === 0) {
      Alert.alert("Before photo required", "Take at least one before-photo before checking in.");
      return;
    }
    setSaving(true);
    const position = await recordGpsEvent("check_in");
    if (!position) {
      setSaving(false);
      return;
    }
    await supabase
      .from("work_orders")
      .update({ status: "in_progress" })
      .eq("id", workOrderId);
    setCheckedIn(true);
    setJob((prev) => (prev ? { ...prev, status: "in_progress" as const } : prev));
    setSaving(false);
  }

  async function handleCheckOut() {
    if (afterPhotos.length === 0) {
      Alert.alert("After photo required", "Take at least one after-photo before checking out.");
      return;
    }
    setSaving(true);
    const position = await recordGpsEvent("check_out");
    if (!position) {
      setSaving(false);
      return;
    }
    const update: Record<string, unknown> = { status: "completed_by_technician" };
    if (completionNotes.trim()) {
      update.description = `${job?.description ?? ""}\n\n--- Technician Notes ---\n${completionNotes.trim()}`;
    }
    await supabase.from("work_orders").update(update).eq("id", workOrderId);
    setSaving(false);
    Alert.alert("Job Complete", "Work order marked as completed.", [
      { text: "OK", onPress: () => navigation.goBack() },
    ]);
  }

  function formatElapsed(seconds: number) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  const isCompleted = job?.status === "completed_by_technician" ||
    job?.status === "verified_by_supervisor" ||
    job?.status === "confirmed_by_resident" ||
    job?.status === "closed";

  if (!job) {
    return <ActivityIndicator style={styles.center} size="large" color="#2F6FED" />;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={[styles.priorityBadge, priorityColor(job.priority)]}>
            <Text style={styles.priorityText}>{job.priority.toUpperCase()}</Text>
          </View>
          <View style={[styles.statusBadge, statusColor(job.status)]}>
            <Text style={styles.statusText}>{job.status.replace(/_/g, " ")}</Text>
          </View>
        </View>
        <Text style={styles.title}>{job.title}</Text>
        <Text style={styles.description}>{job.description}</Text>
      </View>

      {context && (context.propertyName || context.unitLabel || context.assetName) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location & Equipment</Text>
          {context.propertyName && (
            <InfoRow label="Property" value={context.propertyName} />
          )}
          {context.unitLabel && (
            <InfoRow label="Unit" value={context.unitLabel} />
          )}
          {context.assetName && (
            <InfoRow label="Asset" value={context.assetName} />
          )}
          {context.assetCategory && (
            <InfoRow label="Category" value={context.assetCategory} />
          )}
        </View>
      )}

      {!isCompleted && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>1. Before Photos</Text>
            {beforePhotos.length > 0 && (
              <View style={styles.photoGrid}>
                {beforePhotos.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.thumbnail} />
                ))}
              </View>
            )}
            {!checkedIn && (
              <TouchableOpacity style={styles.photoButton} onPress={() => capturePhoto("before")}>
                <Text style={styles.photoButtonText}>
                  {beforePhotos.length > 0 ? "+ Add Another" : "Take Before Photo"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>2. GPS Check-In</Text>
            <TouchableOpacity
              style={[styles.button, (checkedIn || saving) && styles.buttonDisabled]}
              disabled={checkedIn || saving}
              onPress={handleCheckIn}
            >
              <Text style={styles.buttonText}>
                {checkedIn ? "Checked In" : saving ? "Checking in…" : "Check In"}
              </Text>
            </TouchableOpacity>
            {checkedIn && (
              <Text style={styles.timer}>{formatElapsed(elapsedSeconds)}</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>3. After Photos</Text>
            {afterPhotos.length > 0 && (
              <View style={styles.photoGrid}>
                {afterPhotos.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.thumbnail} />
                ))}
              </View>
            )}
            {checkedIn && (
              <TouchableOpacity style={styles.photoButton} onPress={() => capturePhoto("after")}>
                <Text style={styles.photoButtonText}>
                  {afterPhotos.length > 0 ? "+ Add Another" : "Take After Photo"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {checkedIn && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>4. Complete Job</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Completion notes (optional)"
                placeholderTextColor="#6B7D99"
                multiline
                numberOfLines={3}
                value={completionNotes}
                onChangeText={setCompletionNotes}
              />
              <TouchableOpacity
                style={[styles.completeButton, saving && styles.buttonDisabled]}
                disabled={saving}
                onPress={handleCheckOut}
              >
                <Text style={styles.buttonText}>
                  {saving ? "Completing…" : "Check Out & Mark Complete"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {isCompleted && (
        <View style={styles.card}>
          <Text style={styles.completedLabel}>Job Completed</Text>
          {beforePhotos.length > 0 && (
            <>
              <Text style={styles.cardTitle}>Before Photos</Text>
              <View style={styles.photoGrid}>
                {beforePhotos.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.thumbnail} />
                ))}
              </View>
            </>
          )}
          {afterPhotos.length > 0 && (
            <>
              <Text style={[styles.cardTitle, { marginTop: 12 }]}>After Photos</Text>
              <View style={styles.photoGrid}>
                {afterPhotos.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.thumbnail} />
                ))}
              </View>
            </>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function priorityColor(p: string) {
  switch (p) {
    case "emergency": return { backgroundColor: "#7F1D1D" };
    case "high": return { backgroundColor: "#92400E" };
    case "medium": return { backgroundColor: "#1E3A5F" };
    default: return { backgroundColor: "#1C3829" };
  }
}

function statusColor(s: string) {
  if (s === "in_progress") return { backgroundColor: "#1E3A5F" };
  if (s.startsWith("completed") || s === "closed") return { backgroundColor: "#1C3829" };
  return { backgroundColor: "#2D2D3F" };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1320", padding: 16 },
  center: { flex: 1, justifyContent: "center" },
  headerCard: { backgroundColor: "#162335", borderRadius: 12, padding: 16, marginBottom: 12 },
  headerRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { color: "#fff", fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  description: { color: "#8FA3BF", marginTop: 6, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: "#162335", borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { color: "#fff", fontWeight: "700", fontSize: 15, marginBottom: 10 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#243349",
  },
  infoLabel: { color: "#8FA3BF", fontSize: 13 },
  infoValue: { color: "#fff", fontSize: 13, flexShrink: 1, textAlign: "right" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  thumbnail: { width: 80, height: 80, borderRadius: 8, backgroundColor: "#243349" },
  photoButton: {
    borderWidth: 1,
    borderColor: "#2F6FED",
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  photoButtonText: { color: "#2F6FED", fontWeight: "600" },
  button: { backgroundColor: "#2F6FED", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  timer: { color: "#8FA3BF", marginTop: 10, fontSize: 28, textAlign: "center", fontVariant: ["tabular-nums"] },
  notesInput: {
    backgroundColor: "#0B1320",
    color: "#fff",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    textAlignVertical: "top",
    minHeight: 80,
    borderWidth: 1,
    borderColor: "#243349",
  },
  completeButton: {
    backgroundColor: "#16A34A",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  completedLabel: {
    color: "#4ADE80",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
});
