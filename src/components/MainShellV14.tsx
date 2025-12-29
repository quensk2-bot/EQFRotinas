// src/components/MainShellV14.tsx
import type React from "react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Usuario } from "../types";
import { theme } from "../styles";
import { supabase } from "../lib/supabaseClient";

import N1ListarRotinas from "./N1ListarRotinas";
import N2CriarRotina from "./N2CriarRotina";
import { RotinasPadraoPage } from "./RotinasPadraoPage";
import { AgendaHoje } from "./AgendaHoje";
import { N1ExecucaoPorRegional } from "./N1ExecucaoPorRegional";
import { ExecucaoAoVivoBoard2 } from "./ExecucaoAoVivoBoard2";
import { N2ListarRotinas } from "./N2ListarRotinas";
import { RotinaExecucaoContainer } from "./RotinaExecucaoContainer";
import { N3CriarRotinaAvulsa } from "./N3CriarRotinaAvulsa";

// ✅ ADICIONADO: Criar Rotina N1 (com “Criar para mim”)
import { N1CreateRotina } from "./N1CreateRotina";

// ✅ KPI NOVO
import KpiPageV14 from "./KpiPageV14";

type Props = {
  perfil: Usuario;
  onLogout: () => void;
};

type MenuKey = "overview" | "rotinas" | "agenda" | "kpi" | "execucao" | "modelos";

type DashPeriodo = "HOJE" | "7D" | "30D";

type DashboardKpi = {
  totalExecucoes: number;
  finalizadas: number;
  emExecucao: number;
  pausadas: number;
  tempoMedioSegundos: number | null;
  planejadasModeloPeriodo: number;
};

type RegionalResumo = {
  regional_id: number | null;
  regional_nome: string;
  planejado: number;
  executado: number;
};

// ✅ FIX: seu ../types não exporta "Rotina" — então definimos aqui um tipo compatível
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

// ✅ FIX: era React.CSSProperties (quebrava com seu import). Agora é CSSProperties.
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
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 700,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted ?? "#9ca3af",
  },
  chipsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    fontSize: 11,
    padding: "3px 8px",
    borderRadius: 999,
    border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
    color: theme.colors.textSoft ?? "#e5e7eb",
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: theme.colors.textMuted ?? "#9ca3af",
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
  kpiRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  kpiItem: {
    flex: "1 1 120px",
    borderRadius: 12,
    padding: 10,
    background: "rgba(15,23,42,0.9)",
    border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
  },
  kpiLabel: {
    fontSize: 11,
    color: theme.colors.textMuted ?? "#9ca3af",
  },
  kpiValue: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: 700,
  },
  kpiAux: {
    fontSize: 11,
    color: theme.colors.textSoft ?? "#e5e7eb",
  },
  errorBox: {
    marginTop: 8,
    borderRadius: 12,
    padding: 8,
    background: "rgba(220,38,38,0.15)",
    color: "#fecaca",
    fontSize: 12,
  },
  infoText: {
    marginTop: 8,
    fontSize: 12,
    color: theme.colors.textMuted ?? "#9ca3af",
  },
  tableContainer: {
    marginTop: 8,
    borderRadius: 14,
    border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
    overflow: "hidden",
  },
  tableHeaderRow: {
    display: "grid",
    gridTemplateColumns: "40px 1fr 80px 90px 80px",
    fontSize: 11,
    padding: "6px 10px",
    background: "rgba(15,23,42,0.95)",
    color: theme.colors.textMuted ?? "#9ca3af",
    borderBottom: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "40px 1fr 80px 90px 80px",
    fontSize: 12,
    padding: "6px 10px",
    borderBottom: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
  },
  tableRowAlt: {
    background: "rgba(15,23,42,0.85)",
  },
  tableCellCenter: {
    textAlign: "center",
  },
};

const STORAGE_MENU_KEY = "eqf_v14_menu_main";
const STORAGE_EXEC_KEY = "eqf_v14_exec_rotina";

function formatSeconds(total: number | null | undefined): string {
  if (total == null) return "—";
  const t = total;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatPeriodoLabel(p: DashPeriodo): string {
  if (p === "HOJE") return "Hoje";
  if (p === "7D") return "Últimos 7 dias";
  return "Últimos 30 dias";
}
export const MainShellV14: React.FC<Props> = ({ perfil, onLogout }) => {
  const isN3 = perfil.nivel === "N3";
  const cardStyleN3: CSSProperties = isN3
    ? { ...shellStyles.card, borderRadius: 0, border: "none", minHeight: "calc(100vh - 48px)", padding: 16, width: "100%" }
    : shellStyles.card;
  const gridSingleN3: CSSProperties = isN3
    ? { ...shellStyles.cardsGridSingle, width: "100%", marginTop: 0 }
    : shellStyles.cardsGridSingle;
  const cardStyle = (extra?: CSSProperties): CSSProperties => ({
    ...shellStyles.card,
    ...(isN3
      ? {
          borderRadius: 0,
          border: "none",
          minHeight: "calc(100vh - 48px)",
          padding: 16,
        }
      : {}),
    ...(extra || {}),
  });
  const singleGridStyle: CSSProperties = {
    ...shellStyles.cardsGridSingle,
    ...(isN3 ? { width: "100%", marginTop: 0 } : {}),
  };
  const [menu, setMenu] = useState<MenuKey>(() => {
    if (typeof window === "undefined") return perfil.nivel === "N1" ? "overview" : "agenda";
    const stored = window.localStorage.getItem(STORAGE_MENU_KEY) as MenuKey | null;
    if (stored) return stored;
    return perfil.nivel === "N1" ? "overview" : "agenda";
  });

  // Execução (modal + persistência)
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

  // ✅ MENU: KPI liberado N1/N2/N3
  const menuItems = useMemo(() => {
    if (perfil.nivel === "N1") {
      return [
        ["overview", "Dashboard"],
        ["rotinas", "Rotinas & Execução"],
        ["agenda", "Agenda do dia"],
        ["kpi", "KPI"],
        ["execucao", "Execução ao vivo"],
        ["modelos", "Modelos de rotina"],
      ] as [MenuKey, string][];
    }

    if (perfil.nivel === "N2") {
      return [
        ["overview", "Dashboard"],
        ["rotinas", "Rotinas & Execução"],
        ["agenda", "Agenda do dia"],
        ["kpi", "KPI"],
        ["execucao", "Execução ao vivo"],
      ] as [MenuKey, string][];
    }

    return [
      ["overview", "Dashboard"],
      ["rotinas", "Rotinas & Execução"],
      ["agenda", "Agenda do dia"],
      ["kpi", "KPI"],
    ] as [MenuKey, string][];
  }, [perfil.nivel]);

  useEffect(() => {
    const allowed = new Set(menuItems.map(([k]) => k));
    if (!allowed.has(menu)) setMenu(perfil.nivel === "N1" ? "overview" : "agenda");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil.nivel, menuItems]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_MENU_KEY, menu);
  }, [menu]);

  // reabrir automaticamente o card de execucao somente para o executor e somente se houver execucao em aberto
  useEffect(() => {
    if (rotinaSelecionada) {
      setExecOpen(true);
      try {
        window.localStorage.setItem(
          STORAGE_EXEC_KEY,
          JSON.stringify({ rotinaId: rotinaSelecionada.id, executorId: perfil.id })
        );
      } catch {
        // ignore
      }
      return;
    }

    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_EXEC_KEY) : null;
    if (!raw) return;

    let stored: { rotinaId: string; executorId: string } | null = null;
    try {
      stored = JSON.parse(raw);
    } catch {
      stored = null;
    }

    if (!stored || stored.executorId !== perfil.id) {
      window.localStorage.removeItem(STORAGE_EXEC_KEY);
      return;
    }

    void (async () => {
      const { data: rotinaData } = await supabase.from("rotinas").select("*").eq("id", stored!.rotinaId).maybeSingle();
      const { data: execRow } = await supabase
        .from("rotina_execucoes")
        .select("id, finalizado_em")
        .eq("rotina_id", stored!.rotinaId)
        .eq("executor_id", perfil.id)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      const emAberto = execRow && !execRow.finalizado_em;
      if (rotinaData && emAberto) {
        setRotinaSelecionada(rotinaData as any);
        setExecOpen(true);
      } else {
        window.localStorage.removeItem(STORAGE_EXEC_KEY);
      }
    })().catch(() => {
      window.localStorage.removeItem(STORAGE_EXEC_KEY);
    });
  }, [rotinaSelecionada, perfil.id, supabase]);

  // reabrir automaticamente o card de execucao ao entrar na agenda se houver rotina selecionada ou armazenada
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_EXEC_KEY) : null;
    if (!rotinaSelecionada && stored) {
      void supabase
        .from("rotinas")
        .select("*")
        .eq("id", stored)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setRotinaSelecionada(data as any);
        })
        .catch(() => {});
    }
    if (menu === "agenda" && (rotinaSelecionada || stored)) {
      setExecOpen(true);
    }
  }, [menu, rotinaSelecionada]);

  // reabrir automaticamente o card de execucao quando estiver na Agenda e houver rotina selecionada
  useEffect(() => {
    if (menu === "agenda" && rotinaSelecionada) {
      setExecOpen(true);
    }
  }, [menu, rotinaSelecionada]);

  // DASHBOARD – KPI N1
  const [dashPeriodo, setDashPeriodo] = useState<DashPeriodo>("30D");
  const [dashKpi, setDashKpi] = useState<DashboardKpi | null>(null);
  const [dashRegionais, setDashRegionais] = useState<RegionalResumo[]>([]);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashErro, setDashErro] = useState<string | null>(null);

  useEffect(() => {
    if (perfil.nivel !== "N1") return;

    let cancelado = false;

    const carregarDashboard = async () => {
      setDashLoading(true);
      setDashErro(null);

      try {
        const hoje = new Date();
        const inicio = new Date(hoje);

        if (dashPeriodo === "HOJE") {
          inicio.setHours(0, 0, 0, 0);
        } else if (dashPeriodo === "7D") {
          inicio.setDate(inicio.getDate() - 6);
          inicio.setHours(0, 0, 0, 0);
        } else {
          inicio.setDate(inicio.getDate() - 29);
          inicio.setHours(0, 0, 0, 0);
        }

        const inicioISO = inicio.toISOString();
        const inicioDataStr = inicio.toISOString().slice(0, 10);
        const hojeStr = hoje.toISOString().slice(0, 10);

        let execQuery = supabase
          .from("rotina_execucoes")
          .select("id,inicio_em,pausado_em,finalizado_em,duracao_total_segundos,departamento_id,setor_id,regional_id,created_at")
          .gte("created_at", inicioISO);

        if (perfil.departamento_id) execQuery = execQuery.eq("departamento_id", perfil.departamento_id);
        if (perfil.setor_id) execQuery = execQuery.eq("setor_id", perfil.setor_id);

        const { data: execData, error: execError } = await execQuery;
        if (execError) throw execError;

        const execs = (execData ?? []) as any[];
        const totalExec = execs.length;

        let finalizadas = 0;
        let emExecucao = 0;
        let pausadas = 0;
        let somaDur = 0;
        let qtdDur = 0;

        const mapaExecRegional = new Map<number | null, number>();

        execs.forEach((e: any) => {
          const regId = (e.regional_id ?? null) as number | null;

          if (e.finalizado_em) {
            finalizadas++;
            mapaExecRegional.set(regId, (mapaExecRegional.get(regId) ?? 0) + 1);
            if (typeof e.duracao_total_segundos === "number") {
              somaDur += e.duracao_total_segundos;
              qtdDur++;
            }
          } else if (e.pausado_em) {
            pausadas++;
          } else if (e.inicio_em) {
            emExecucao++;
          }
        });

        const tempoMedioSegundos = qtdDur > 0 ? Math.round(somaDur / qtdDur) : null;

        let rotQuery = supabase.from("rotinas").select("id,departamento_id,setor_id,regional_id,data_inicio");

        if (perfil.departamento_id) rotQuery = rotQuery.eq("departamento_id", perfil.departamento_id);
        if (perfil.setor_id) rotQuery = rotQuery.eq("setor_id", perfil.setor_id);

        rotQuery = rotQuery.gte("data_inicio", inicioDataStr).lte("data_inicio", hojeStr);

        const { data: rotData, error: rotError } = await rotQuery;
        if (rotError) throw rotError;

        const mapaPlanejadoRegional = new Map<number | null, number>();
        (rotData ?? []).forEach((r: any) => {
          const regId = (r.regional_id ?? null) as number | null;
          mapaPlanejadoRegional.set(regId, (mapaPlanejadoRegional.get(regId) ?? 0) + 1);
        });

        let planejadasModeloPeriodo = 0;
        try {
          const { data: modelos, error: modelosError } = await supabase.from("rotinas_padrao").select("id, periodicidade");
          if (!modelosError && modelos) {
            modelos.forEach((m: any) => {
              const p = (m.periodicidade ?? "")
                .toString()
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

              if (p === "diaria") {
                planejadasModeloPeriodo += dashPeriodo === "HOJE" ? 1 : dashPeriodo === "7D" ? 7 : 30;
              } else if (p === "semanal") {
                planejadasModeloPeriodo += dashPeriodo === "HOJE" ? 0 : dashPeriodo === "7D" ? 1 : 4;
              } else if (p === "mensal") {
                if (dashPeriodo === "30D") planejadasModeloPeriodo += 1;
              }
            });
          }
        } catch {
          // silencioso
        }

        const idsRegionais = new Set<number | null>([
          ...Array.from(mapaPlanejadoRegional.keys()),
          ...Array.from(mapaExecRegional.keys()),
        ]);

        const regionaisResumo: RegionalResumo[] = [];
        idsRegionais.forEach((id) => {
          const planejado = mapaPlanejadoRegional.get(id) ?? 0;
          const executado = mapaExecRegional.get(id) ?? 0;
          regionaisResumo.push({
            regional_id: id,
            regional_nome: id ? `Regional ${id}` : "Sem regional",
            planejado,
            executado,
          });
        });

        regionaisResumo.sort((a, b) => (b.executado || 0) - (a.executado || 0));

        if (!cancelado) {
          setDashKpi({
            totalExecucoes: totalExec,
            finalizadas,
            emExecucao,
            pausadas,
            tempoMedioSegundos,
            planejadasModeloPeriodo,
          });
          setDashRegionais(regionaisResumo);
        }
      } catch (err: any) {
        console.error("Erro ao carregar dashboard N1:", err);
        if (!cancelado) setDashErro(err.message ?? "Erro ao carregar painel.");
      } finally {
        if (!cancelado) setDashLoading(false);
      }
    };

    void carregarDashboard();
    return () => {
      cancelado = true;
    };
  }, [perfil.nivel, perfil.departamento_id, perfil.setor_id, dashPeriodo]);

  // OVERVIEW
  const renderOverview = () => {
    if (perfil.nivel === "N1") {
      const taxaExec =
        dashKpi && dashKpi.planejadasModeloPeriodo > 0
          ? Math.round((dashKpi.finalizadas / dashKpi.planejadasModeloPeriodo) * 100)
          : 0;

      return (
        <>
          <div style={shellStyles.headerRow}>
            <div>
              <div style={shellStyles.headerTitle}>Visão geral – Nível 1</div>
              <div style={shellStyles.headerSubtitle}>KPI nacional do seu setor • {formatPeriodoLabel(dashPeriodo)}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <div style={shellStyles.chipsRow}>
                <div style={shellStyles.chip}>
                  Setor ID: {perfil.setor_id ?? "—"} • Departamento: {perfil.departamento_id ?? "—"}
                </div>
                <div style={shellStyles.chip}>
                  Usuário: {perfil.nome} ({perfil.nivel})
                </div>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                {(["HOJE", "7D", "30D"] as DashPeriodo[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDashPeriodo(p)}
                    style={{
                      padding: "3px 8px",
                      fontSize: 11,
                      borderRadius: 999,
                      border:
                        dashPeriodo === p
                          ? `1px solid ${theme.colors.neonGreen ?? "#22c55e"}`
                          : `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
                      background: dashPeriodo === p ? theme.colors.neonGreen ?? "#22c55e" : "transparent",
                      color: dashPeriodo === p ? "#022c22" : "#e5e7eb",
                      cursor: "pointer",
                    }}
                  >
                    {p === "HOJE" ? "Hoje" : p === "7D" ? "Últimos 7 dias" : "Últimos 30 dias"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={shellStyles.sectionTitle}>Resumo de execução</div>

          <div style={shellStyles.cardsGridTwo}>
            <div style={shellStyles.card}>
              <div style={shellStyles.cardHeaderRow}>
                <div>
                  <div style={shellStyles.cardTitle}>KPI nacional do setor – Nível 1</div>
                  <div style={shellStyles.cardSubtitle}>
                    Execuções de rotina (N2 + N3) do seu setor em todas as regionais, no período selecionado.
                  </div>
                </div>
              </div>

              {dashLoading && <div style={shellStyles.infoText}>Carregando dados do dashboard...</div>}
              {dashErro && !dashLoading && <div style={shellStyles.errorBox}>{dashErro}</div>}

              {!dashLoading && !dashErro && dashKpi && (
                <>
                  <div style={shellStyles.kpiRow}>
                    <div style={shellStyles.kpiItem}>
                      <div style={shellStyles.kpiLabel}>Execuções planejadas (modelo N1 – período)</div>
                      <div style={shellStyles.kpiValue}>{dashKpi.planejadasModeloPeriodo}</div>
                      <div style={shellStyles.kpiAux}>Baseado em templates do N1 e período selecionado.</div>
                    </div>

                    <div style={shellStyles.kpiItem}>
                      <div style={shellStyles.kpiLabel}>Execuções finalizadas (real)</div>
                      <div style={shellStyles.kpiValue}>{dashKpi.finalizadas}</div>
                      <div style={shellStyles.kpiAux}>De um total de {dashKpi.totalExecucoes} execuções.</div>
                    </div>

                    <div style={shellStyles.kpiItem}>
                      <div style={shellStyles.kpiLabel}>Execuções em andamento</div>
                      <div style={shellStyles.kpiValue}>{dashKpi.emExecucao}</div>
                      <div style={shellStyles.kpiAux}>Iniciadas e ainda não finalizadas.</div>
                    </div>

                    <div style={shellStyles.kpiItem}>
                      <div style={shellStyles.kpiLabel}>Tempo médio das execuções</div>
                      <div style={shellStyles.kpiValue}>{formatSeconds(dashKpi.tempoMedioSegundos)}</div>
                      <div style={shellStyles.kpiAux}>Somente execuções finalizadas.</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 11 }}>
                    <span style={{ color: theme.colors.textMuted ?? "#9ca3af" }}>
                      Taxa de execução vs planejamento ({formatPeriodoLabel(dashPeriodo)}):{" "}
                    </span>
                    <strong
                      style={{
                        color:
                          dashKpi.planejadasModeloPeriodo > 0
                            ? taxaExec >= 90
                              ? theme.colors.neonGreen ?? "#22c55e"
                              : taxaExec >= 70
                                ? theme.colors.neonOrange ?? "#fb923c"
                                : "#f97373"
                            : theme.colors.textMuted ?? "#9ca3af",
                      }}
                    >
                      {dashKpi.planejadasModeloPeriodo > 0 ? `${taxaExec}%` : "—"}
                    </strong>
                  </div>
                </>
              )}
            </div>

            <div style={shellStyles.card}>
              <div style={shellStyles.cardHeaderRow}>
                <div>
                  <div style={shellStyles.cardTitle}>Planejado x Executado – Regionais do setor</div>
                  <div style={shellStyles.cardSubtitle}>
                    Comparativo entre rotinas planejadas e execuções finalizadas por conta regional.
                  </div>
                </div>
              </div>

              <div style={shellStyles.tableContainer}>
                <div style={shellStyles.tableHeaderRow}>
                  <span>#</span>
                  <span>Regional</span>
                  <span style={shellStyles.tableCellCenter}>Planejado</span>
                  <span style={shellStyles.tableCellCenter}>Executado</span>
                  <span style={shellStyles.tableCellCenter}>Cumprimento</span>
                </div>

                {dashRegionais.length === 0 && (
                  <div style={{ padding: 10, fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af" }}>
                    Nenhuma rotina planejada ou executada no período.
                  </div>
                )}

                {dashRegionais.map((reg, idx) => {
                  const pct = reg.planejado > 0 ? Math.round((reg.executado / reg.planejado) * 100) : 0;
                  return (
                    <div
                      key={`${reg.regional_id ?? "null"}-${idx}`}
                      style={{
                        ...shellStyles.tableRow,
                        ...(idx % 2 === 1 ? shellStyles.tableRowAlt : {}),
                      }}
                    >
                      <span>{idx + 1}</span>
                      <span>{reg.regional_nome}</span>
                      <span style={shellStyles.tableCellCenter}>{reg.planejado}</span>
                      <span style={shellStyles.tableCellCenter}>{reg.executado}</span>
                      <span style={shellStyles.tableCellCenter}>{reg.planejado > 0 ? `${pct}%` : "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={shellStyles.sectionTitle}>Agenda do dia</div>
          <div style={shellStyles.cardsGridSingle}>
            <div style={shellStyles.card}>
              <AgendaHoje perfil={perfil} autoScrollToHour={false} onAbrirExecucao={abrirExecucao} />
            </div>
          </div>
        </>
      );
    }

    if (perfil.nivel === "N2") {
      return (
        <>
          <div style={shellStyles.headerRow}>
            <div>
              <div style={shellStyles.headerTitle}>Visão geral – Nível 2</div>
              <div style={shellStyles.headerSubtitle}>Agenda e execuções em tempo real da sua regional.</div>
            </div>
            <div style={shellStyles.chipsRow}>
              <div style={shellStyles.chip}>
                Dep: {perfil.departamento_id ?? "—"} • Setor: {perfil.setor_id ?? "—"} • Regional:{" "}
                {perfil.regional_id ?? "—"}
              </div>
            </div>
          </div>

          <div style={shellStyles.cardsGridTwo}>
            <div style={shellStyles.card}>
              <div style={shellStyles.cardHeaderRow}>
                <div>
                  <div style={shellStyles.cardTitle}>Agenda do dia</div>
                  <div style={shellStyles.cardSubtitle}>Rotinas agendadas hoje (suas e da equipe).</div>
                </div>
              </div>
              <AgendaHoje perfil={perfil} autoScrollToHour={false} onAbrirExecucao={abrirExecucao} />
            </div>

            <div style={shellStyles.card}>
              <div style={shellStyles.cardHeaderRow}>
                <div>
                  <div style={shellStyles.cardTitle}>Execução ao vivo</div>
                  <div style={shellStyles.cardSubtitle}>Acompanhamento da sua regional em tempo real.</div>
                </div>
              </div>
              <ExecucaoAoVivoBoard2 perfil={perfil} />
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div style={shellStyles.headerRow}>
          <div>
            <div style={shellStyles.headerTitle}>Visão geral – Nível 3</div>
            <div style={shellStyles.headerSubtitle}>Rotinas atribuídas para você.</div>
          </div>
          <div style={shellStyles.chipsRow}>
            <div style={shellStyles.chip}>
              Setor: {perfil.setor_id ?? "—"} • Regional: {perfil.regional_id ?? "—"}
            </div>
          </div>
        </div>

        <div style={gridSingleN3}>
          <div style={cardStyleN3}>
            <AgendaHoje perfil={perfil} autoScrollToHour={false} onAbrirExecucao={abrirExecucao} />
          </div>
        </div>
      </>
    );
  };

  // ROTINAS
  const renderRotinas = () => {
    if (perfil.nivel === "N1") {
      return (
        <div style={shellStyles.cardsGridSingle}>
          {/* ✅ ADICIONADO sem mexer no resto: Criar rotina N1 */}
          <div style={shellStyles.card}>
            <N1CreateRotina perfil={perfil} />
          </div>

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
            <N2CriarRotina usuarioLogado={perfil} />
          </div>

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
  // ✅ KPI NOVO (N1/N2/N3)
  // Agora o menu KPI aponta para o KpiPageV14 (individual/regional/nacional conforme perfil)
  const renderKpi = () => (
    <div style={gridSingleN3}>
      <div style={cardStyleN3}>
        <KpiPageV14 perfil={perfil} />
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
            Nível: {perfil.nivel}
            {perfil.setor_id ? ` • Setor ${perfil.setor_id}` : ""}
            {perfil.regional_id ? ` • Regional ${perfil.regional_id}` : ""}
          </div>
          <button style={shellStyles.logoutButton} onClick={onLogout}>
            Sair
          </button>
        </div>

        <div>
          <div style={shellStyles.menuLabel}>Navegação</div>
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
        {menu === "overview" && renderOverview()}
        {menu === "rotinas" && renderRotinas()}
        {menu === "agenda" && renderAgenda()}
        {menu === "kpi" && renderKpi()}
        {menu === "execucao" && renderExecucaoAoVivo()}
        {menu === "modelos" && perfil.nivel === "N1" && renderModelos()}

        {/* ✅ Modal Execução */}
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
