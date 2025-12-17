// src/components/LoginScreen.tsx
import type React from "react";
import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { theme } from "../styles";

const loginStyles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    width: "100vw",
    margin: 0,
    padding: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "radial-gradient(circle at top, #020617 0, #020617 55%, #000 100%)",
    color: theme.colors.text,
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    boxSizing: "border-box",
  },

  card: {
    width: 380,
    maxWidth: "100%",
    background: "#020617",
    borderRadius: 24,
    border: "2px solid #f97316", // laranja
    boxShadow:
      "0 25px 60px rgba(0,0,0,0.9), 0 0 30px rgba(249,115,22,0.25)", // sombra + glow
    padding: "28px 26px 30px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },

  titleBlock: {
    textAlign: "center",
    marginBottom: 10,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    width: 38,
    height: 38,
    borderRadius: "999px",
    background:
      "conic-gradient(from 120deg, #22c55e, #f97316, #22c55e, #22c55e)",
    boxShadow: "0 0 18px rgba(34,197,94,0.55)",
    border: "2px solid #020617",
  },

  badgeInner: {
    width: 24,
    height: 24,
    borderRadius: "999px",
    background: "#020617",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    color: "#22c55e",
  },

  title: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "0.04em",
    color: "#f97316",
  },

  subtitle: {
    fontSize: 15,
    marginTop: 4,
    fontWeight: 600,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: theme.colors.text,
  },

  sectionTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: 600,
  },

  form: {
    marginTop: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  label: {
    fontSize: 13,
    color: theme.colors.textSoft,
    marginBottom: 2,
  },

  input: {
    width: "100%",
    borderRadius: 999,
    border: "1px solid #1f2937",
    padding: "10px 14px",
    fontSize: 14,
    background: "#020617",
    color: theme.colors.text,
    outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },

  inputFocus: {
    borderColor: theme.colors.neon,
    boxShadow: "0 0 0 2px rgba(34,197,94,0.35)",
  },

  buttonBase: {
    marginTop: 6,
    width: "100%",
    borderRadius: 999,
    border: "none",
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    background: theme.colors.neon,
    color: "#000",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    transition:
      "transform 0.12s ease-out, box-shadow 0.12s ease-out, filter 0.12s ease-out",
  },

  buttonHover: {
    transform: "translateY(-1px) scale(1.02)",
    boxShadow: "0 0 22px rgba(34,197,94,0.6)",
    filter: "brightness(1.05)",
  },

  buttonDisabled: {
    opacity: 0.7,
    cursor: "default",
    boxShadow: "none",
    transform: "none",
  },

  error: {
    marginTop: 4,
    fontSize: 12,
    color: "#f97373",
    textAlign: "center",
  },
};

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [focusField, setFocusField] = useState<"email" | "senha" | null>(null);
  const [buttonHover, setButtonHover] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) {
        console.error("Erro no login:", error.message);
        setErrorMsg("E-mail ou senha inválidos.");
      }
    } catch (err) {
      console.error("Erro inesperado:", err);
      setErrorMsg("Erro inesperado ao tentar entrar.");
    } finally {
      setLoading(false);
    }
  };

  const buttonStyle: React.CSSProperties = {
    ...loginStyles.buttonBase,
    ...(buttonHover && !loading ? loginStyles.buttonHover : {}),
    ...(loading ? loginStyles.buttonDisabled : {}),
  };

  return (
    <div style={loginStyles.container}>
      <div style={loginStyles.card}>
        <div style={loginStyles.titleBlock}>
          <div style={loginStyles.badge}>
            <div style={loginStyles.badgeInner}>EQF</div>
          </div>
          <div style={loginStyles.title}>E.Q.F ROTINA</div>
          <div style={loginStyles.subtitle}>EMPRESARIAL</div>
        </div>

        <div style={loginStyles.sectionTitle}>Acesso</div>

        <form style={loginStyles.form} onSubmit={handleLogin}>
          <div>
            <label style={loginStyles.label}>E-mail</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusField("email")}
              onBlur={() => setFocusField(null)}
              style={{
                ...loginStyles.input,
                ...(focusField === "email" ? loginStyles.inputFocus : {}),
              }}
              placeholder="seuemail@empresa.com"
            />
          </div>

          <div>
            <label style={loginStyles.label}>Senha</label>
            <input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onFocus={() => setFocusField("senha")}
              onBlur={() => setFocusField(null)}
              style={{
                ...loginStyles.input,
                ...(focusField === "senha" ? loginStyles.inputFocus : {}),
              }}
              placeholder="••••••••"
            />
          </div>

          {errorMsg && <p style={loginStyles.error}>{errorMsg}</p>}

          <button
            type="submit"
            style={buttonStyle}
            disabled={loading}
            onMouseEnter={() => setButtonHover(true)}
            onMouseLeave={() => setButtonHover(false)}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
