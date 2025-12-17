// src/styles.ts
export const theme = {
  colors: {
    appBackground: "#020617",

    text: "#f9fafb",
    textSoft: "#e5e7eb",
    textMuted: "#9ca3af",

    border: "#1f2937",
    borderSoft: "#334155",

    neonGreen: "#22c55e",
    neonOrange: "#fb923c",
    neonYellow: "#eab308",

    bg: "#0f172a",
    bgElevated: "#1e293b",
    bgSoft: "#0f172a99",

    success: "#4ade80",
    warning: "#facc15",
    danger: "#f87171",

    cardBg: "rgba(15,23,42,0.96)",
    cardBgSoft: "rgba(15,23,42,0.85)",
  },

  shadows: {
    soft: "0 0 8px rgba(0,0,0,0.4)",
    medium: "0 0 14px rgba(0,0,0,0.55)",
    neonGreen: "0 0 12px #22c55e99",
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
};

export const styles = {
  // Cards
  card: {
    background: theme.colors.cardBg,
    border: `1px solid ${theme.colors.borderSoft}`,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  } as React.CSSProperties,

  // ✅ faltava (usado na listagem de modelos)
  cardInner: {
    background: theme.colors.cardBgSoft,
    border: `1px solid ${theme.colors.borderSoft}`,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  } as React.CSSProperties,

  // Inputs
  input: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.borderSoft}`,
    background: theme.colors.bgElevated,
    color: theme.colors.text,
    outline: "none",
  } as React.CSSProperties,

  // ✅ faltava (usado no textarea da descrição)
  textarea: {
    width: "100%",
    minHeight: 90,
    padding: "8px 10px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.borderSoft}`,
    background: theme.colors.bgElevated,
    color: theme.colors.text,
    outline: "none",
    resize: "vertical",
  } as React.CSSProperties,

  // Labels
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: theme.colors.textSoft,
    marginBottom: 4,
  } as React.CSSProperties,

  // Botões base
  button: {
    padding: "8px 16px",
    borderRadius: 10,
    cursor: "pointer",
    border: "none",
    fontWeight: 600,
  } as React.CSSProperties,

  // ✅ faltava
  buttonPrimary: {
    padding: "8px 16px",
    borderRadius: 10,
    cursor: "pointer",
    border: "none",
    fontWeight: 700,
    background: theme.colors.neonGreen,
    color: "#022c22",
  } as React.CSSProperties,

  // ✅ faltava
  buttonSecondary: {
    padding: "8px 16px",
    borderRadius: 10,
    cursor: "pointer",
    border: `1px solid ${theme.colors.borderSoft}`,
    fontWeight: 700,
    background: "transparent",
    color: theme.colors.textSoft,
  } as React.CSSProperties,

  // (opcional, caso você use em outros lugares)
  buttonGhost: {
    padding: "8px 16px",
    borderRadius: 10,
    cursor: "pointer",
    border: "none",
    fontWeight: 700,
    background: "rgba(34,197,94,0.10)",
    color: theme.colors.neonGreen,
  } as React.CSSProperties,

  // Shell
  appShell: {
    background: theme.colors.appBackground,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties,

  mainContent: {
    padding: 24,
    maxWidth: 1600,
    margin: "0 auto",
    width: "100%",
  } as React.CSSProperties,
};

// Se você realmente mantém tipos aqui, ok.
// (O ideal é ficar no src/types.ts, mas não vou mexer nisso agora.)
export type HealthData = any;

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  nivel: "ADM" | "N0" | "N1" | "N2" | "N3" | "N99";
  departamento_id: number | null;
  setor_id: number | null;
  regional_id: number | null;
  grupo_id?: number | null;
};
