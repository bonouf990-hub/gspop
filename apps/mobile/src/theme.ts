import { StyleSheet } from "react-native";

export const COLORS = {
  background: "#0f1626",
  surface: "#1a2640",
  surfaceElevated: "#213052",
  gold: "#b8902f",
  goldSoft: "#d4af5a",
  goldPale: "rgba(184,144,47,0.12)",
  white: "#ffffff",
  textPrimary: "#f0ece4",
  textSecondary: "#a0977e",
  textMuted: "#6b6454",
  hairline: "rgba(184,144,47,0.15)",
  accent: "#d4af5a",
  danger: "#c0392b",
  dangerBg: "rgba(192,57,43,0.12)",
  success: "#27ae60",
  successBg: "rgba(39,174,96,0.12)",
  warning: "#f39c12",
  warningBg: "rgba(243,156,18,0.12)",
  info: "#5dade2",
  infoBg: "rgba(93,173,226,0.12)",
};

export const SHADOWS = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  elevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
};

export const BASE = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    padding: 18,
    marginBottom: 14,
    ...SHADOWS.card,
  },
  goldLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: COLORS.gold,
    fontWeight: "700",
    marginBottom: 10,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.hairline,
    marginVertical: 10,
  },
});
