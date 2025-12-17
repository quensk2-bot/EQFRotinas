import { useState, type FormEvent } from "react"
import { supabase } from "../lib/supabaseClient"
import { useNavigate } from "react-router-dom"
import { Shield, Loader2 } from "lucide-react"

const envLabel: string =
  import.meta.env.MODE === "production"
    ? "Ambiente de Produção"
    : import.meta.env.MODE === "development"
    ? "Ambiente de Desenvolvimento"
    : "Ambiente de Homologação"

interface Style {
  [key: string]: string | number | undefined
}

const loginStyles: Record<string, Style> = {
  root: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    backgroundImage:
      "radial-gradient(circle at top, rgba(255,122,26,0.12), transparent 55%), radial-gradient(circle at bottom, rgba(0,255,153,0.08), transparent 55%)",
    color: "#ffffff",
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "24px",
    boxSizing: "border-box",
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: "420px",
    borderRadius: "20px",
    border: "1px solid #ff7a1a",
    background:
      "radial-gradient(circle at top left, rgba(255,122,26,0.12), rgba(0,0,0,0.98))",
    boxShadow: "0 0 40px rgba(0,0,0,0.9)",
    padding: "32px 32px 28px",
  },
  headerBrand: {
    textAlign: "center",
    marginBottom: "28px",
  },
  title: {
    fontSize: "26px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  titleEqf: {
    color: "#ff7a1a",
  },
  titleRest: {
    color: "#ffffff",
    marginLeft: "4px",
  },
  subtitle: {
    marginTop: "10px",
    fontSize: "13px",
    color: "#b0b3c0",
  },
  envBadge: {
    marginTop: "8px",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: "999px",
    backgroundColor: "rgba(5,5,5,0.9)",
    border: "1px solid rgba(255,255,255,0.06)",
    fontSize: "11px",
    color: "#9ca3af",
  },
  envDot: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "radial-gradient(circle, #22c55e, #15803d)",
    boxShadow: "0 0 8px rgba(34,197,94,0.8)",
  },
  form: {
    marginTop: "4px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    color: "#e5e7eb",
    marginBottom: "6px",
  },
  inputWrapper: {
    marginBottom: "18px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.35)",
    backgroundColor: "rgba(15,23,42,0.9)",
    color: "#f9fafb",
    fontSize: "14px",
    outline: "none",
  },
  helperRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "18px",
  },
  remember: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#9ca3af",
  },
  link: {
    fontSize: "12px",
    color: "#f97316",
    cursor: "pointer",
  },
  button: {
    width: "100%",
    border: "none",
    borderRadius: "999px",
    padding: "10px 16px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "4px",
    background: "linear-gradient(135deg, #22c55e, #00ff99)",
    color: "#041016",
    boxShadow: "0 0 18px rgba(34,197,94,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "default",
    boxShadow: "none",
  },
  errorBox: {
    marginTop: "14px",
    padding: "8px 10px",
    borderRadius: "10px",
    backgroundColor: "rgba(127,29,29,0.85)",
    border: "1px solid rgba(248,113,113,0.8)",
    color: "#fee2e2",
    fontSize: "13px",
  },
  footer: {
    marginTop: "22px",
    fontSize: "11px",
    color: "#6b7280",
    textAlign: "center",
  },
}

export function LoginScreen() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error("Erro ao fazer login:", error)
      setError(
        "Não foi possível entrar. Verifique e-mail e senha e tente novamente."
      )
      setLoading(false)
      return
    }

    if (data?.session) {
      navigate("/app")
    } else {
      setError("Login não autorizado. Tente novamente.")
      setLoading(false)
    }
  }

  return (
    <div style={loginStyles.root}>
      <div style={loginStyles.card}>
        <div style={loginStyles.headerBrand}>
          <div style={loginStyles.title}>
            <span style={loginStyles.titleEqf}>E.Q.F</span>
            <span style={loginStyles.titleRest}> ROTINA EMPRESARIAL</span>
          </div>
          <div style={loginStyles.subtitle}>
            Acesso ao painel de rotinas por nível de usuário.
          </div>
          <div style={loginStyles.envBadge}>
            <span style={loginStyles.envDot} />
            <span>{envLabel}</span>
          </div>
        </div>

        <form style={loginStyles.form} onSubmit={handleLogin}>
          <div style={loginStyles.inputWrapper}>
            <label style={loginStyles.label}>E-mail</label>
            <input
              type="email"
              required
              placeholder="seu.email@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={loginStyles.input}
            />
          </div>

          <div style={loginStyles.inputWrapper}>
            <label style={loginStyles.label}>Senha</label>
            <input
              type="password"
              required
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={loginStyles.input}
            />
          </div>

          <div style={loginStyles.helperRow}>
            <div style={loginStyles.remember}>
              <Shield size={14} />
              <span>Uso exclusivo interno</span>
            </div>
            <span style={loginStyles.link}>Esqueceu a senha?</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...loginStyles.button,
              ...(loading ? loginStyles.buttonDisabled : {}),
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        {error && <div style={loginStyles.errorBox}>{error}</div>}

        <div style={loginStyles.footer}>
          EQF V13 • Rotina Empresarial • Acesso seguro
        </div>
      </div>
    </div>
  )
}
