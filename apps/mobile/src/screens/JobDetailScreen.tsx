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
import { BASE, COLORS, SHADOWS } from "../theme";

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
    const sec = String(seconds % 60).padStart(2, "0");
    return `${h}:${m}:${sec}`;
  }

  const isCompleted = job?.status === "completed_by_technician" ||
    job?.status === "verified_by_supervisor" ||
    job?.status === "confirmed_by_resident" ||
    job?.status === "closed";

  if (!job) {
    return <ActivityIndicator style={st.center} size="large" color={COLORS.gold} />;
  }

  const prio = priorityMeta(job.priority);
  const stat = statusMeta(job.status);

  return (
    <ScrollView style={st.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={st.headerCard}>
        <View style={st.badgeRow}>
          <View style={[st.badge, { backgroundColor: prio.bg }]}>
            <Text style={[st.badgeText, { color: prio.color }]}>{job.priority.toUpperCase()}</Text>
          </View>
          <View style={[st.badge, { backgroundColor: stat.bg }]}>
            <Text style={[st.badgeText, { color: stat.color }]}>{job.status.replace(/_/g, " ")}</Text>
          </View>
        </View>
        <Text style={st.title}>{job.title}</Text>
        {job.description ? <Text style={st.description}>{job.description}</Text> : null}
        <View style={st.goldBar} />
      </View>

      {context && (context.propertyName || context.unitLabel || context.assetName) && (
        <View style={BASE.card}>
          <Text style={BASE.goldLabel}>LOCATION & EQUIPMENT</Text>
          {context.propertyName && <InfoRow label="Property" value={context.propertyName} />}
          {context.unitLabel && <InfoRow label="Unit" value={context.unitLabel} />}
          {context.assetName && <InfoRow label="Asset" value={context.assetName} />}
          {context.assetCategory && <InfoRow label="Category" value={context.assetCategory} last />}
        </View>
      )}

      {!isCompleted && (
        <>
          <View style={BASE.card}>
            <View style={st.stepHeader}>
              <View style={st.stepNumber}>
                <Text style={st.stepNumberText}>1</Text>
              </View>
              <Text style={BASE.goldLabel}>BEFORE PHOTOS</Text>
            </View>
            {beforePhotos.length > 0 && (
              <View style={st.photoGrid}>
                {beforePhotos.map((uri, i) => (
                  <View key={i} style={st.thumbnailWrap}>
                    <Image source={{ uri }} style={st.thumbnail} />
                  </View>
                ))}
              </View>
            )}
            {!checkedIn && (
              <TouchableOpacity style={st.photoButton} onPress={() => capturePhoto("before")} activeOpacity={0.7}>
                <Text style={st.photoIcon}>📷</Text>
                <Text style={st.photoButtonText}>
                  {beforePhotos.length > 0 ? "Add Another Photo" : "Take Before Photo"}
                </Text>
              </TouchableOpacity>
            )}
            {beforePhotos.length > 0 && !checkedIn && (
              <Text style={st.photoCount}>{beforePhotos.length} photo{beforePhotos.length !== 1 ? "s" : ""} captured</Text>
            )}
          </View>

          <View style={BASE.card}>
            <View style={st.stepHeader}>
              <View style={[st.stepNumber, checkedIn && st.stepComplete]}>
                <Text style={st.stepNumberText}>{checkedIn ? "✓" : "2"}</Text>
              </View>
              <Text style={BASE.goldLabel}>GPS CHECK-IN</Text>
            </View>
            {!checkedIn ? (
              <TouchableOpacity
                style={[st.goldButton, saving && st.buttonDisabled]}
                disabled={saving}
                onPress={handleCheckIn}
                activeOpacity={0.8}
              >
                <Text style={st.goldButtonText}>
                  {saving ? "Checking in…" : "Check In at Location"}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={st.timerContainer}>
                <View style={st.timerRing}>
                  <Text style={st.timerText}>{formatElapsed(elapsedSeconds)}</Text>
                </View>
                <Text style={st.timerLabel}>Time on Site</Text>
              </View>
            )}
          </View>

          <View style={BASE.card}>
            <View style={st.stepHeader}>
              <View style={st.stepNumber}>
                <Text style={st.stepNumberText}>3</Text>
              </View>
              <Text style={BASE.goldLabel}>AFTER PHOTOS</Text>
            </View>
            {afterPhotos.length > 0 && (
              <View style={st.photoGrid}>
                {afterPhotos.map((uri, i) => (
                  <View key={i} style={st.thumbnailWrap}>
                    <Image source={{ uri }} style={st.thumbnail} />
                  </View>
                ))}
              </View>
            )}
            {checkedIn && (
              <TouchableOpacity style={st.photoButton} onPress={() => capturePhoto("after")} activeOpacity={0.7}>
                <Text style={st.photoIcon}>📷</Text>
                <Text style={st.photoButtonText}>
                  {afterPhotos.length > 0 ? "Add Another Photo" : "Take After Photo"}
                </Text>
              </TouchableOpacity>
            )}
            {afterPhotos.length > 0 && (
              <Text style={st.photoCount}>{afterPhotos.length} photo{afterPhotos.length !== 1 ? "s" : ""} captured</Text>
            )}
            {!checkedIn && (
              <View style={st.lockedOverlay}>
                <Text style={st.lockedText}>Check in first to take after photos</Text>
              </View>
            )}
          </View>

          {checkedIn && (
            <View style={BASE.card}>
              <View style={st.stepHeader}>
                <View style={st.stepNumber}>
                  <Text style={st.stepNumberText}>4</Text>
                </View>
                <Text style={BASE.goldLabel}>COMPLETE JOB</Text>
              </View>
              <TextInput
                style={st.notesInput}
                placeholder="Completion notes (optional)"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                value={completionNotes}
                onChangeText={setCompletionNotes}
              />
              <TouchableOpacity
                style={[st.completeButton, saving && st.buttonDisabled]}
                disabled={saving}
                onPress={handleCheckOut}
                activeOpacity={0.8}
              >
                <Text style={st.completeButtonText}>
                  {saving ? "Completing…" : "Check Out & Complete"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {isCompleted && (
        <View style={BASE.card}>
          <View style={st.completedBanner}>
            <View style={st.completedIcon}>
              <Text style={st.completedIconText}>✓</Text>
            </View>
            <Text style={st.completedLabel}>Job Completed</Text>
          </View>
          {beforePhotos.length > 0 && (
            <>
              <Text style={BASE.goldLabel}>BEFORE PHOTOS</Text>
              <View style={st.photoGrid}>
                {beforePhotos.map((uri, i) => (
                  <View key={i} style={st.thumbnailWrap}>
                    <Image source={{ uri }} style={st.thumbnail} />
                  </View>
                ))}
              </View>
            </>
          )}
          {afterPhotos.length > 0 && (
            <>
              <View style={[BASE.divider, { marginVertical: 14 }]} />
              <Text style={BASE.goldLabel}>AFTER PHOTOS</Text>
              <View style={st.photoGrid}>
                {afterPhotos.map((uri, i) => (
                  <View key={i} style={st.thumbnailWrap}>
                    <Image source={{ uri }} style={st.thumbnail} />
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[st.infoRow, !last && st.infoRowBorder]}>
      <Text style={st.infoLabel}>{label}</Text>
      <Text style={st.infoValue}>{value}</Text>
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

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, justifyContent: "center", backgroundColor: COLORS.background },

  headerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    ...SHADOWS.card,
  },
  badgeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  title: { color: COLORS.textPrimary, fontSize: 20, fontWeight: "800", lineHeight: 26, letterSpacing: 0.3 },
  description: { color: COLORS.textSecondary, marginTop: 8, fontSize: 14, lineHeight: 21 },
  goldBar: { width: 32, height: 2, backgroundColor: COLORS.gold, marginTop: 16, borderRadius: 1 },

  stepHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.goldPale,
    borderWidth: 1,
    borderColor: COLORS.gold,
    justifyContent: "center",
    alignItems: "center",
  },
  stepComplete: { backgroundColor: COLORS.successBg, borderColor: COLORS.success },
  stepNumberText: { color: COLORS.gold, fontSize: 11, fontWeight: "800" },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  infoRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hairline,
  },
  infoLabel: { color: COLORS.textSecondary, fontSize: 13 },
  infoValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: "500", flexShrink: 1, textAlign: "right" },

  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  thumbnailWrap: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  thumbnail: { width: 80, height: 80, backgroundColor: COLORS.surfaceElevated },

  photoButton: {
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  photoIcon: { fontSize: 16 },
  photoButtonText: { color: COLORS.gold, fontWeight: "700", fontSize: 14, letterSpacing: 0.3 },
  photoCount: { color: COLORS.textMuted, fontSize: 11, marginTop: 6, letterSpacing: 0.5, fontWeight: "500" },

  goldButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    ...SHADOWS.elevated,
  },
  goldButtonText: { color: COLORS.background, fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },
  buttonDisabled: { opacity: 0.5 },

  timerContainer: { alignItems: "center", paddingVertical: 8 },
  timerRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: COLORS.gold,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.goldPale,
  },
  timerText: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
  },
  timerLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 10,
  },

  lockedOverlay: {
    paddingVertical: 12,
    alignItems: "center",
  },
  lockedText: { color: COLORS.textMuted, fontSize: 12, fontStyle: "italic" },

  notesInput: {
    backgroundColor: COLORS.background,
    color: COLORS.textPrimary,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    marginBottom: 14,
    textAlignVertical: "top",
    minHeight: 90,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  completeButton: {
    backgroundColor: COLORS.success,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    ...SHADOWS.elevated,
  },
  completeButtonText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },

  completedBanner: { alignItems: "center", marginBottom: 18 },
  completedIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.successBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  completedIconText: { color: COLORS.success, fontSize: 24, fontWeight: "800" },
  completedLabel: {
    color: COLORS.success,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
