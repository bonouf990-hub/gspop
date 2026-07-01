import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { COLORS, SHADOWS } from "../theme";

type Props = { onLogin: () => void };

export default function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Enter your email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      Alert.alert("Sign-in failed", error.message);
      return;
    }
    onLogin();
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.inner}>
        <View style={s.logoContainer}>
          <View style={s.logoRing}>
            <Text style={s.logoIcon}>GS</Text>
          </View>
        </View>

        <Text style={s.brand}>GOLDEN SANDS</Text>
        <Text style={s.subtitle}>Operations Portal</Text>
        <View style={s.goldBar} />

        <View style={s.formCard}>
          <Text style={s.formLabel}>SIGN IN</Text>

          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Email</Text>
            <TextInput
              style={s.input}
              placeholder="your.name@gspop.com"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Password</Text>
            <TextInput
              style={s.input}
              placeholder="Enter password"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            disabled={loading}
            onPress={handleLogin}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={s.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>Golden Sands Property Operations</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: "center" },
  inner: { paddingHorizontal: 28 },
  logoContainer: { alignItems: "center", marginBottom: 20 },
  logoRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: COLORS.gold,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(184,144,47,0.08)",
  },
  logoIcon: {
    color: COLORS.gold,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 2,
  },
  brand: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 4,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: "center",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 4,
  },
  goldBar: {
    width: 48,
    height: 2,
    backgroundColor: COLORS.gold,
    alignSelf: "center",
    marginTop: 16,
    marginBottom: 28,
    borderRadius: 1,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    ...SHADOWS.card,
  },
  formLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.gold,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.background,
    color: COLORS.textPrimary,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  button: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
    ...SHADOWS.elevated,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.background, fontWeight: "800", fontSize: 15, letterSpacing: 1 },
  footer: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 32,
    letterSpacing: 1,
  },
});
