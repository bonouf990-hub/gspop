import React, { useEffect, useRef, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { WorkOrder } from "@gspop/shared";
import { supabase } from "../lib/supabase";

type Props = {
  route: { params: { workOrderId: string } };
};

export default function JobDetailScreen({ route }: Props) {
  const { workOrderId } = route.params;
  const [job, setJob] = useState<WorkOrder | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [beforePhotoTaken, setBeforePhotoTaken] = useState(false);
  const [afterPhotoTaken, setAfterPhotoTaken] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase
      .from("work_orders")
      .select("*")
      .eq("id", workOrderId)
      .single()
      .then(({ data }) => setJob(data as unknown as WorkOrder));
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
    if (!beforePhotoTaken) {
      Alert.alert("Before photo required", "Take a before-photo before checking in.");
      return;
    }
    const position = await recordGpsEvent("check_in");
    if (!position) return;
    await supabase
      .from("work_orders")
      .update({ status: "in_progress" })
      .eq("id", workOrderId);
    setCheckedIn(true);
  }

  async function handleCheckOut() {
    if (!afterPhotoTaken) {
      Alert.alert("After photo required", "Take an after-photo before checking out.");
      return;
    }
    const position = await recordGpsEvent("check_out");
    if (!position) return;
    await supabase
      .from("work_orders")
      .update({ status: "completed_by_technician" })
      .eq("id", workOrderId);
    setCheckedIn(false);
  }

  function formatElapsed(seconds: number) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  async function capturePhoto(stage: "before" | "after") {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) return;
    }
    // Photo capture UI would open the CameraView here; on shutter, upload to
    // Supabase Storage and insert a row into work_order_photos with stage=stage.
    if (stage === "before") setBeforePhotoTaken(true);
    else setAfterPhotoTaken(true);
  }

  if (!job) return <Text style={styles.loading}>Loading job...</Text>;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{job.title}</Text>
      <Text style={styles.description}>{job.description}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Before Photo</Text>
        <TouchableOpacity style={styles.button} onPress={() => capturePhoto("before")}>
          <Text style={styles.buttonText}>{beforePhotoTaken ? "Retake Before Photo" : "Take Before Photo"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. GPS Check-In</Text>
        <TouchableOpacity
          style={[styles.button, checkedIn && styles.buttonDisabled]}
          disabled={checkedIn}
          onPress={handleCheckIn}
        >
          <Text style={styles.buttonText}>{checkedIn ? "Checked In" : "Check In"}</Text>
        </TouchableOpacity>
        {checkedIn && <Text style={styles.timer}>{formatElapsed(elapsedSeconds)}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. After Photo</Text>
        <TouchableOpacity style={styles.button} onPress={() => capturePhoto("after")}>
          <Text style={styles.buttonText}>{afterPhotoTaken ? "Retake After Photo" : "Take After Photo"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. GPS Check-Out & Complete</Text>
        <TouchableOpacity
          style={[styles.button, !checkedIn && styles.buttonDisabled]}
          disabled={!checkedIn}
          onPress={handleCheckOut}
        >
          <Text style={styles.buttonText}>Check Out & Mark Complete</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1320", padding: 16 },
  loading: { color: "#fff", textAlign: "center", marginTop: 40 },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  description: { color: "#8FA3BF", marginTop: 8, marginBottom: 16 },
  section: { backgroundColor: "#162335", borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { color: "#fff", fontWeight: "600", marginBottom: 8 },
  button: { backgroundColor: "#2F6FED", borderRadius: 8, padding: 12, alignItems: "center" },
  buttonDisabled: { backgroundColor: "#3A4658" },
  buttonText: { color: "#fff", fontWeight: "600" },
  timer: { color: "#8FA3BF", marginTop: 8, fontSize: 18, textAlign: "center" },
});
