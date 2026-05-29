export const theme = {
  colors: {
    primary: "#0EA5E9",
    primaryDark: "#0369A1",
    primaryLight: "#E0F2FE",
    accent: "#FACC15",
    success: "#22C55E",
    danger: "#EF4444",
    background: "#F8FAFC",
    card: "#FFFFFF",
    textPrimary: "#0F172A",
    textSecondary: "#64748B",
    border: "#E2E8F0"
  },
  radius: {
    card: "16px",
    button: "10px",
    pill: "999px"
  },
  shadow: {
    card: "0 4px 12px rgba(15, 23, 42, 0.08)",
    floating: "0 8px 24px rgba(15, 23, 42, 0.12)"
  }
} as const;

export type Theme = typeof theme;
