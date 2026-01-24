// src/components/MainShellV14.tsx
import type React from "react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Usuario } from "../types";
import { theme } from "../styles";

import N1ListarRotinas from "./N1ListarRotinas";
import { RotinasPadraoPage } from "./RotinasPadraoPage";
import { AgendaHoje } from "./AgendaHoje";
import { N1ExecucaoPorRegional } from "./N1ExecucaoPorRegional";
import { ExecucaoAoVivoBoard2 } from "./ExecucaoAoVivoBoard2";
import { N2ListarRotinas } from "./N2ListarRotinas";
import { RotinaExecucaoContainer } from "./RotinaExecucaoContainer";
import { N3CriarRotinaAvulsa } from "./N3CriarRotinaAvulsa";

import KpiPageV14 from "./KpiPageV14";
import KpiAuditoria from "./KpiAuditoria";
import RotinasAtivasAdmin from "./RotinasAtivasAdmin";

type Props = {
  perfil: Usuario;
  onLogout: () => void;
};

type MenuKey =
  | "overview"
  | "rotinas"
  | "agenda"
  | "kpi"
  | "kpi-auditoria"
  | "rotinas-ativas"
  | "execucao"
  | "modelos";

type Rotina = {
  id: string;
  titulo: string;
  descricao?: string | null;
  tipo?: string | null;
  periodicidade?: string | null;
  data_inicio?: string | null;
  dia_semana?: string | null;
  horario_inicio?: string | null;
  duracao_minutos?: number | null;
  urgencia?: string | null;
  responsavel_id?: string;
  departamento_id?: number | null;
  setor_id?: number | null;
  regional_id?: number | null;
  tem_checklist?: boolean;
  tem_anexo?: boolean;
};

const shellStyles: Record<string, CSSProperties> = {
  root: {
    display: "flex",
    minHeight: "100vh",
    width: "100vw",
    overflowX: "hidden",
    background: theme.colors.appBackground ?? "#020617",
    color: theme.colors.text ?? "#f9fafb",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  sidebar: {
    width: 260,
    padding: 16,
    boxSizing: "border-box",
    borderRight: `1px solid ${theme.colors.border ?? "#1f2937"}`,
    background:
      "radial-gradient(circle at top left, rgba(251, 146, 60, 0.15), transparent 60%), #020617",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  logo: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: theme.colors.neonOrange ?? "#fb923c",
  },
  userBox: {
    borderRadius: 16,
    padding: 12,
    background: "rgba(15, 23, 42, 0.9)",
    border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  userName: {
    fontSize: 14,
    fontWeight: 600,
  },
  userMeta: {
    fontSize: 11,
    color: theme.colors.textMuted ?? "#9ca3af",
  },
  logoutButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    padding: "4px 10px",
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    background: theme.colors.neonGreen ?? "#22c55e",
    color: "#022c22",
    fontSize: 11,
    fontWeight: 600,
  },
  menuList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginTop: 8,
  },
  menuLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: theme.colors.textMuted ?? "#9ca3af",
    marginBottom: 4,
  },
  menuButton: {
    padding: "8px 10px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "transparent",
    background: "transparent",
    color: theme.colors.textSoft ?? "#e5e7eb",
    fontSize: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
  },
  menuButtonActive: {
    background: "rgba(34,197,94,0.08)",
    borderColor: theme.colors.neonGreen ?? "#22c55e",
    color: theme.colors.neonGreen ?? "#22c55e",
  },
  menuButtonLeft: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  menuBullet: {
    width: 6,
    height: 6,
    borderRadius: "999px",
    background: theme.colors.neonOrange ?? "#fb923c",
  },
  main: {
    flex: 1,
    width: "100%",
    padding: 24,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  cardsGridTwo: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.4fr)",
    gap: 14,
  },
  cardsGridSingle: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 14,
  },
  card: {
    background: "rgba(15,23,42,0.96)",
    borderRadius: 18,
    border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minHeight: 120,
  },
  cardHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 600,
  },
  cardSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted ?? "#9ca3af",
    marginTop: 2,
  },
};

const STORAGE_MENU_KEY = "eqf_v14_menu_main";
const STORAGE_EXEC_KEY = "eqf_v14_exec_rotina";

export const MainShellV14: React.FC<Props> = ({ perfil, onLogout }) => {
  const isN3 = perfil.nivel === "N3";
  const cardStyleN3: CSSProperties = isN3
    ? {
        ...shellStyles.card,
        borderRadius: 12,
        border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
        minHeight: "calc(100vh - 120px)",
        padding: 16,
        width: "100%",
        maxWidth: 1160,
        margin: "0 auto",
      }
    : shellStyles.card;
  const gridSingleN3: CSSProperties = isN3
    ? { ...shellStyles.cardsGridSingle, width: "100%", marginTop: 0, justifyItems: "center" }
    : shellStyles.cardsGridSingle;

  const [menu, setMenu] = useState<MenuKey>(() => {
    if (typeof window === "undefined") return "agenda";
    const stored = window.localStorage.getItem(STORAGE_MENU_KEY) as MenuKey | null;
    if (stored && stored !== "overview") return stored;
    return "agenda";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_MENU_KEY, menu);
  }, [menu]);

  const [execOpen, setExecOpen] = useState(false);
  const [rotinaSelecionada, setRotinaSelecionada] = useState<Rotina | null>(null);

  const abrirExecucao = (rotina: Rotina) => {
    setRotinaSelecionada(rotina);
    setExecOpen(true);
    try {
      window.localStorage.setItem(
        STORAGE_EXEC_KEY,
        JSON.stringify({ rotinaId: rotina.id, executorId: perfil.id })
      );
    } catch {
      // ignore
    }
  };

  const minimizarExecucao = () => {
    setExecOpen(false);
  };

  const reabrirExecucao = () => {
    if (rotinaSelecionada) setExecOpen(true);
  };

  const fecharExecucao = () => {
    setExecOpen(false);
    setRotinaSelecionada(null);
    try {
      window.localStorage.removeItem(STORAGE_EXEC_KEY);
    } catch {
      // ignore
    }
  };

  const finalizarExecucao = () => {
    fecharExecucao();
  };

  const menuItems = useMemo(() => {
    if (perfil.nivel === "N1") {
      return [
        ["rotinas", "Rotinas & Execucao"],
        ["agenda", "Agenda do dia"],
        ["kpi", "KPI"],
        ["kpi-auditoria", "KPI Auditoria"],
        ["rotinas-ativas", "Rotinas ativas"],
        ["execucao", "Execucao ao vivo"],
        ["modelos", "Modelos de rotina"],
      ] as [MenuKey, string][];
    }

    if (perfil.nivel === "N2") {
      return [
        ["rotinas", "Rotinas & Execucao"],
        ["agenda", "Agenda do dia"],
        ["kpi", "KPI"],
        ["kpi-auditoria", "KPI Auditoria"],
        ["rotinas-ativas", "Rotinas ativas"],
        ["execucao", "Execucao ao vivo"],
      ] as [MenuKey, string][];
    }

    return [
      ["rotinas", "Rotinas & Execucao"],
      ["agenda", "Agenda do dia"],
      ["kpi", "KPI"],
      ["kpi-auditoria", "KPI Auditoria"],
      ["rotinas-ativas", "Rotinas ativas"],
      ["execucao", "Execucao ao vivo"],
    ] as [MenuKey, string][];
  }, [perfil.nivel]);


  const renderRotinas = () => {
    if (perfil.nivel === "N1") {
      return (
        <div style={shellStyles.cardsGridSingle}>
          <div style={shellStyles.card}>
            <N1ListarRotinas perfil={perfil} />
          </div>
        </div>
      );
    }

    if (perfil.nivel === "N2") {
      return (
        <div style={shellStyles.cardsGridSingle}>
          <div style={shellStyles.card}>
            <N2ListarRotinas perfil={perfil} onAbrirExecucao={abrirExecucao} />
          </div>
        </div>
      );
    }

    return (
      <div style={gridSingleN3}>
        <div style={cardStyleN3}>
          <N3CriarRotinaAvulsa perfil={perfil} />
        </div>

        <div style={cardStyleN3}>
          <AgendaHoje perfil={perfil} autoScrollToHour={false} onAbrirExecucao={abrirExecucao} />
        </div>
      </div>
    );
  };

  const renderAgenda = () => (
    <div style={gridSingleN3}>
      <div style={cardStyleN3}>
        <AgendaHoje perfil={perfil} autoScrollToHour onAbrirExecucao={abrirExecucao} />
      </div>
    </div>
  );

  const renderKpi = () => (
    <div style={gridSingleN3}>
      <div style={cardStyleN3}>
        <KpiPageV14 perfil={perfil} />
      </div>
    </div>
  );

  const renderKpiAuditoria = () => (
    <div style={gridSingleN3}>
      <div style={cardStyleN3}>
        <KpiAuditoria perfil={perfil} />
      </div>
    </div>
  );

  const renderRotinasAtivas = () => (
    <div style={gridSingleN3}>
      <div style={cardStyleN3}>
        <RotinasAtivasAdmin perfil={perfil} />
      </div>
    </div>
  );

  const renderExecucaoAoVivo = () => (
    <div style={gridSingleN3}>
      <div style={cardStyleN3}>
        <ExecucaoAoVivoBoard2 perfil={perfil} />
      </div>
    </div>
  );

  const renderModelos = () => (
    <div style={gridSingleN3}>
      <div style={cardStyleN3}>
        <RotinasPadraoPage usuarioLogado={perfil} />
      </div>
    </div>
  );

  return (
    <div style={shellStyles.root}>
      <aside style={shellStyles.sidebar}>
        <div style={shellStyles.logo}>Rotina Empresarial EQF</div>

        <div style={shellStyles.userBox}>
          <div style={shellStyles.userName}>{perfil.nome}</div>
          <div style={shellStyles.userMeta}>
            Nivel: {perfil.nivel}
            {perfil.setor_id ? `  Setor ${perfil.setor_id}` : ""}
            {perfil.regional_id ? `  Regional ${perfil.regional_id}` : ""}
          </div>
          <button style={shellStyles.logoutButton} onClick={onLogout}>
            Sair
          </button>
        </div>

        <div>
          <div style={shellStyles.menuLabel}>Navegacao</div>
          <div style={shellStyles.menuList}>
            {menuItems.map(([key, label]) => {
              const active = menu === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMenu(key)}
                  style={{
                    ...shellStyles.menuButton,
                    ...(active ? shellStyles.menuButtonActive : {}),
                  }}
                >
                  <span style={shellStyles.menuButtonLeft}>
                    <span style={shellStyles.menuBullet} />
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <main style={{ ...shellStyles.main, ...(isN3 ? { padding: 0, gap: 0 } : {}) }}>
        {menu === "rotinas" && renderRotinas()}
        {menu === "agenda" && renderAgenda()}
        {menu === "kpi" && renderKpi()}
        {menu === "kpi-auditoria" && renderKpiAuditoria()}
        {menu === "rotinas-ativas" && renderRotinasAtivas()}
        {menu === "execucao" && renderExecucaoAoVivo()}
        {menu === "modelos" && perfil.nivel === "N1" && renderModelos()}

        <RotinaExecucaoContainer
          open={execOpen}
          rotina={rotinaSelecionada}
          perfil={perfil}
          onClose={minimizarExecucao}
          onRestore={reabrirExecucao}
          onDismiss={fecharExecucao}
          onFinalizada={finalizarExecucao}
        />
      </main>
    </div>
  );
};

export default MainShellV14;
