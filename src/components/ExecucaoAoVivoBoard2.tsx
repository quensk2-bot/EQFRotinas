// src/components/ExecucaoAoVivoBoard2.tsx
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { theme } from "../styles";
import type { Usuario } from "../types";

// ---------------------------------------------------------
// TIPOS
// ---------------------------------------------------------
type ResponsavelJoin = {
  id: string;
  nome: string | null;
} | null;

type RegionalJoin = {
  id: number;
  nome: string | null;
} | null;

type RotinaJoin = {
  id: string;
  titulo: string;
  duracao_minutos: number | null;
  data_inicio: string | null;
  tipo: string | null;
  periodicidade: string | null;
  dia_semana: string | null;
  departamento_id: number | null;
  setor_id: number | null;
  regional_id: number | null;
  responsavel_id?: string | null;
  responsavel?: ResponsavelJoin;
  regional?: RegionalJoin;
};

type ExecutorJoin = {
  id: string;
  nome: string | null;
  nivel: string | null;
  departamento_id: number | null;
  setor_id: number | null;
  regional_id: number | null;
};

type ExecucaoRow = {
  id: number | string; // pode ser "virtual-<rotinaId>"
  rotina_id: string;
  executor_id: string | null;
  inicio_em: string | null;
  pausado_em: string | null;
  finalizado_em: string | null;
  duracao_total_segundos: number | null;
  created_at: string | null;
  rotina: RotinaJoin | null;
  executor: ExecutorJoin | null;
};

type StatusExec =
  | "PENDENTE"
  | "EM_EXECUCAO"
  | "PAUSADA"
  | "FINALIZADA"
  | "ATRASO_LEVE"
  | "ATRASO_CRITICO";

type Props = {
  perfil: Usuario;
};

// ---------------------------------------------------------
// CONFIG (modo restrito para N2)
// ---------------------------------------------------------
const STRICT_N2 = true;

// ---------------------------------------------------------
// ESTILOS
// ---------------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: "flex", flexDirection: "column", gap: 16 },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  title: { fontSize: 20, fontWeight: 700 },
  subtitle: { fontSize: 13, color: theme.colors.textMuted },
  rightControls: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },

  select: {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${theme.colors.borderSoft}`,
    background: "rgba(15,23,42,0.8)",
    color: theme.colors.textSoft,
    fontSize: 12,
    outline: "none",
    cursor: "pointer",
  },

  pillRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  pill: {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    border: `1px solid ${theme.colors.borderSoft}`,
    color: theme.colors.textSoft,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  pillDot: { width: 8, height: 8, borderRadius: "999px" },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  },
  card: {
    background: "rgba(15,23,42,0.95)",
    borderRadius: 16,
    border: `1px solid ${theme.colors.borderSoft}`,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minHeight: 96,
  },
  cardHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  badgeStatus: {
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  tempoTxt: { fontFamily: "monospace", fontSize: 13, fontWeight: 700 },
  rotinaTitulo: { fontSize: 13, fontWeight: 700 },
  rotinaLocal: { fontSize: 11, color: theme.colors.textMuted },

  executorTxt: { fontSize: 12, color: theme.colors.textSoft, fontWeight: 700 },

  footer: {
    marginTop: 4,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 11,
    color: theme.colors.textMuted,
    gap: 10,
    flexWrap: "wrap",
  },
  statusResumoRow: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 },
  resumoCard: {
    flex: "0 0 auto",
    minWidth: 120,
    padding: 10,
    borderRadius: 12,
    background: "rgba(15,23,42,0.9)",
    border: `1px solid ${theme.colors.borderSoft}`,
  },
  resumoLabel: { fontSize: 11, color: theme.colors.textMuted },
  resumoValue: { fontSize: 18, fontWeight: 800 },
};

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------
function formatSeconds(total: number | null | undefined): string {
  const t = Math.max(0, Math.floor(total ?? 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function statusToLabel(status: StatusExec): string {
  switch (status) {
    case "PENDENTE":
      return "Pendente";
    case "EM_EXECUCAO":
      return "Em execução";
    case "PAUSADA":
      return "Pausada";
    case "FINALIZADA":
      return "Finalizada";
    case "ATRASO_LEVE":
      return "Atraso leve";
    case "ATRASO_CRITICO":
      return "Atraso crítico";
    default:
      return status;
  }
}

function statusToColor(status: StatusExec): { bg: string; dot: string } {
  switch (status) {
    case "PENDENTE":
      return { bg: "rgba(59,130,246,0.20)", dot: "#60a5fa" };
    case "EM_EXECUCAO":
      return { bg: "rgba(34,197,94,0.20)", dot: "#4ade80" };
    case "PAUSADA":
      return { bg: "rgba(234,179,8,0.20)", dot: "#facc15" };
    case "FINALIZADA":
      return { bg: "rgba(148,163,184,0.20)", dot: "#e5e7eb" };
    case "ATRASO_LEVE":
      return { bg: "rgba(249,115,22,0.20)", dot: "#fb923c" };
    case "ATRASO_CRITICO":
      return { bg: "rgba(220,38,38,0.25)", dot: "#fca5a5" };
    default:
      return { bg: "rgba(148,163,184,0.20)", dot: "#e5e7eb" };
  }
}

// ✅ tempo atual coerente com seu RotinaExecucaoContainer:
// - pausada/finalizada: usa duracao_total_segundos salvo
// - em execução: usa max(duracao_total_segundos, agora - inicio_em)
function getTempoAtualSeg(exec: ExecucaoRow): number {
  const base = typeof exec.duracao_total_segundos === "number" ? exec.duracao_total_segundos : 0;

  if (exec.finalizado_em) return Math.max(0, base);
  if (exec.pausado_em) return Math.max(0, base);

  if (exec.inicio_em) {
    const inicioMs = new Date(exec.inicio_em).getTime();
    if (!Number.isNaN(inicioMs)) {
      const diff = Math.floor((Date.now() - inicioMs) / 1000);
      return Math.max(0, Math.max(base, diff));
    }
  }

  return Math.max(0, base);
}

// ✅ status baseado no TEMPO ATUAL (não apenas inicio_em)
function calcularStatus(exec: ExecucaoRow, tempoAtualSeg: number): StatusExec {
  if (exec.finalizado_em) return "FINALIZADA";
  if (exec.pausado_em) return "PAUSADA";
  if (!exec.inicio_em) return "PENDENTE";

  const planejadoMin = exec.rotina?.duracao_minutos ?? null;
  if (planejadoMin && planejadoMin > 0) {
    const planejadoSeg = planejadoMin * 60;
    const diff = tempoAtualSeg - planejadoSeg;
    if (diff > 15 * 60 && diff <= 30 * 60) return "ATRASO_LEVE";
    if (diff > 30 * 60) return "ATRASO_CRITICO";
  }

  return "EM_EXECUCAO";
}

// --- recorrência (mesma lógica da AgendaHoje) ---
function weekday_1_7(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  const js = d.getDay();
  return String(js === 0 ? 1 : js + 1);
}
function dayOfMonth(dateISO: string): number {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.getDate();
}
function startOfDayUTC(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00.000Z`).toISOString();
}
function endOfDayUTCExclusive(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

// ---------------------------------------------------------
// FILTRO DE HIERARQUIA (N1 e N2)
// ---------------------------------------------------------
function pertenceAoGestor(exec: ExecucaoRow, perfil: Usuario): boolean {
  const r = exec.rotina;
  const u = exec.executor;

  // pendente virtual
  if (r && !u) {
    if (perfil.nivel === "N2") {
      if (STRICT_N2) {
        if (perfil.departamento_id != null) {
          if (r.departamento_id == null) return false;
          if (r.departamento_id !== perfil.departamento_id) return false;
        }
        if (perfil.setor_id != null) {
          if (r.setor_id == null) return false;
          if (r.setor_id !== perfil.setor_id) return false;
        }
        if (perfil.regional_id != null) {
          if (r.regional_id == null) return false;
          if (r.regional_id !== perfil.regional_id) return false;
        }
        return true;
      }

      if (perfil.departamento_id && r.departamento_id && r.departamento_id !== perfil.departamento_id) return false;
      if (perfil.setor_id && r.setor_id && r.setor_id !== perfil.setor_id) return false;
      if (perfil.regional_id && r.regional_id && r.regional_id !== perfil.regional_id) return false;
      return true;
    }

    if (perfil.nivel === "N1") {
      if (perfil.departamento_id && r.departamento_id && r.departamento_id !== perfil.departamento_id) return false;
      if (perfil.setor_id && r.setor_id && r.setor_id !== perfil.setor_id) return false;
      return true;
    }

    return true;
  }

  // join incompleto
  if (!r || !u) {
    return perfil.nivel === "N2" && STRICT_N2 ? false : true;
  }

  const nivelExec = (u.nivel ?? "").toString().toUpperCase();
  if (["ADM", "N0", "N99"].includes(nivelExec)) return true;

  if (perfil.nivel === "N2") {
    if (STRICT_N2) {
      if (perfil.departamento_id != null) {
        if (r.departamento_id == null) return false;
        if (r.departamento_id !== perfil.departamento_id) return false;
      }
      if (perfil.setor_id != null) {
        if (r.setor_id == null) return false;
        if (r.setor_id !== perfil.setor_id) return false;
      }
      if (perfil.regional_id != null) {
        if (r.regional_id == null) return false;
        if (r.regional_id !== perfil.regional_id) return false;
      }
    } else {
      if (perfil.departamento_id && r.departamento_id && r.departamento_id !== perfil.departamento_id) return false;
      if (perfil.setor_id && r.setor_id && r.setor_id !== perfil.setor_id) return false;
      if (perfil.regional_id && r.regional_id && r.regional_id !== perfil.regional_id) return false;
    }

    if (nivelExec && !["N2", "N3"].includes(nivelExec)) return false;
    return true;
  }

  if (perfil.nivel === "N1") {
    if (perfil.departamento_id && r.departamento_id && r.departamento_id !== perfil.departamento_id) return false;
    if (perfil.setor_id && r.setor_id && r.setor_id !== perfil.setor_id) return false;

    if (nivelExec && !["N2", "N3"].includes(nivelExec)) return false;
    return true;
  }

  return true;
}

// ---------------------------------------------------------
// COMPONENTE (HOJE ONLY + FILTRO REGIONAL + NOME REGIONAL)
// ---------------------------------------------------------
export function ExecucaoAoVivoBoard2({ perfil }: Props) {
  const [linhas, setLinhas] = useState<ExecucaoRow[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [regionalFiltro, setRegionalFiltro] = useState<string>("TODAS");

  useEffect(() => {
    let cancelado = false;

    const carregar = async () => {
      setCarregando(true);
      setErro(null);

      const hojeISO = new Date().toISOString().slice(0, 10);
      const di = startOfDayUTC(hojeISO);
      const df = endOfDayUTCExclusive(hojeISO);

      try {
        // (1) Execuções reais do dia
        const { data: execData, error: execError } = await supabase
          .from("rotina_execucoes")
          .select(
            `
            id,
            rotina_id,
            executor_id,
            inicio_em,
            pausado_em,
            finalizado_em,
            duracao_total_segundos,
            created_at,
            rotina:rotinas (
              id,
              titulo,
              duracao_minutos,
              data_inicio,
              tipo,
              periodicidade,
              dia_semana,
              departamento_id,
              setor_id,
              regional_id,
              responsavel_id,
              responsavel:usuarios!rotinas_responsavel_id_fkey (
                id,
                nome
              ),
              regional:regionais!rotinas_regional_id_fkey (
                id,
                nome
              )
            ),
            executor:usuarios (
              id,
              nome,
              nivel,
              departamento_id,
              setor_id,
              regional_id
            )
          `
          )
          .gte("created_at", di)
          .lt("created_at", df)
          .order("created_at", { ascending: false });

        if (execError) {
          console.error("Erro ao carregar execuções ao vivo (hoje):", execError);
          if (!cancelado) setErro("Erro ao carregar execuções ao vivo.");
          return;
        }

        const execucoesReais = ((execData as any) ?? []) as ExecucaoRow[];

        // rotinas que já tiveram execução hoje
        const execHojeIds = new Set<string>();
        execucoesReais.forEach((e) => {
          if (e.rotina_id) execHojeIds.add(e.rotina_id);
        });

        // (2) Pendentes virtuais do dia
        const { data: rotinasHojeData, error: rotErr } = await supabase
          .from("rotinas")
          .select(
            `
            id,
            titulo,
            duracao_minutos,
            data_inicio,
            tipo,
            periodicidade,
            dia_semana,
            departamento_id,
            setor_id,
            regional_id,
            responsavel_id,
            responsavel:usuarios!rotinas_responsavel_id_fkey (
              id,
              nome
            ),
            regional:regionais!rotinas_regional_id_fkey (
              id,
              nome
            )
          `
          )
          .or(
            [
              `and(tipo.eq.avulsa,data_inicio.eq.${hojeISO})`,
              `and(tipo.eq.normal,periodicidade.eq.diaria,data_inicio.lte.${hojeISO})`,
              `and(tipo.eq.normal,periodicidade.eq.semanal,data_inicio.lte.${hojeISO},dia_semana.eq.${weekday_1_7(hojeISO)})`,
              `and(tipo.eq.normal,periodicidade.eq.mensal,data_inicio.lte.${hojeISO})`,
            ].join(",")
          );

        if (rotErr) console.error("Erro ao carregar pendências de hoje:", rotErr);

        let rotinasHoje = ((rotinasHojeData as any) ?? []) as any[];

        // mensal: só quando dia do mês bate com data_inicio
        const domAlvo = dayOfMonth(hojeISO);
        rotinasHoje = rotinasHoje.filter((r) => {
          if ((r.periodicidade ?? "") !== "mensal") return true;
          if (!r.data_inicio) return false;
          return dayOfMonth(r.data_inicio) === domAlvo;
        });

        const pendentesVirtuais: ExecucaoRow[] = rotinasHoje
          .filter((r) => !execHojeIds.has(r.id))
          .map((r) => ({
            id: `virtual-${r.id}`,
            rotina_id: r.id,
            executor_id: null,
            inicio_em: null,
            pausado_em: null,
            finalizado_em: null,
            duracao_total_segundos: 0,
            created_at: di,
            rotina: {
              id: r.id,
              titulo: r.titulo ?? `Rotina ${r.id}`,
              duracao_minutos: r.duracao_minutos ?? null,
              data_inicio: r.data_inicio ?? null,
              tipo: r.tipo ?? null,
              periodicidade: r.periodicidade ?? null,
              dia_semana: r.dia_semana ?? null,
              departamento_id: r.departamento_id ?? null,
              setor_id: r.setor_id ?? null,
              regional_id: r.regional_id ?? null,
              responsavel_id: r.responsavel_id ?? null,
              responsavel: r.responsavel ?? null,
              regional: r.regional ?? null,
            },
            executor: null,
          }));

        const combinado = [...pendentesVirtuais, ...execucoesReais];
        if (!cancelado) setLinhas(combinado);
      } catch (e) {
        console.error("Erro inesperado ao carregar execuções ao vivo:", e);
        if (!cancelado) setErro("Erro inesperado ao carregar execuções ao vivo.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    };

    void carregar();
    const id = window.setInterval(carregar, 20000);

    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [perfil.id]);

  // ✅ recalcula tempo/status com base no tempo atual real
  const linhasComStatus = useMemo(() => {
    return linhas.map((e) => {
      const tempoAtualSeg = getTempoAtualSeg(e);
      const status = calcularStatus(e, tempoAtualSeg);
      return { ...e, status, tempoAtualSeg };
    });
  }, [linhas]);

  const baseVisivel = useMemo(() => {
    return linhasComStatus.filter((e) => pertenceAoGestor(e as ExecucaoRow, perfil)) as (ExecucaoRow & {
      status: StatusExec;
      tempoAtualSeg: number;
    })[];
  }, [linhasComStatus, perfil]);

  const regionaisDisponiveis = useMemo(() => {
    const mapa = new Map<string, { key: string; nome: string }>();

    baseVisivel.forEach((e) => {
      const id = e.rotina?.regional_id;
      const key = id == null ? "null" : String(id);
      const nome = e.rotina?.regional?.nome ?? (id == null ? "Sem regional" : `Regional ${id}`);
      if (!mapa.has(key)) mapa.set(key, { key, nome });
    });

    const arr = Array.from(mapa.values());
    arr.sort((a, b) => {
      if (a.key === "null") return 1;
      if (b.key === "null") return -1;
      return Number(a.key) - Number(b.key);
    });

    return arr;
  }, [baseVisivel]);

  const linhasFiltradas = useMemo(() => {
    if (regionalFiltro === "TODAS") return baseVisivel;
    return baseVisivel.filter((e) => {
      const reg = e.rotina?.regional_id;
      const k = reg == null ? "null" : String(reg);
      return k === regionalFiltro;
    });
  }, [baseVisivel, regionalFiltro]);

  const totais = useMemo(() => {
    const base: Record<StatusExec, number> = {
      PENDENTE: 0,
      EM_EXECUCAO: 0,
      PAUSADA: 0,
      FINALIZADA: 0,
      ATRASO_LEVE: 0,
      ATRASO_CRITICO: 0,
    };
    for (const e of linhasFiltradas) base[e.status]++;
    return base;
  }, [linhasFiltradas]);

  useEffect(() => {
    if (regionalFiltro === "TODAS") return;
    const existe = regionaisDisponiveis.some((r) => r.key === regionalFiltro);
    if (!existe) setRegionalFiltro("TODAS");
  }, [regionalFiltro, regionaisDisponiveis]);

  return (
    <div style={styles.wrapper}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.title}>Execução ao vivo</div>
          <div style={styles.subtitle}>Somente HOJE • incluindo pendentes que ainda não iniciaram</div>
        </div>

        <div style={styles.rightControls}>
          <select value={regionalFiltro} onChange={(e) => setRegionalFiltro(e.target.value)} style={styles.select}>
            <option value="TODAS">Todas as regionais</option>
            {regionaisDisponiveis.map((r) => (
              <option key={r.key} value={r.key}>
                {r.nome}
              </option>
            ))}
          </select>

          <div style={styles.pillRow}>
            <div style={styles.pill}>
              <span style={{ ...styles.pillDot, background: statusToColor("PENDENTE").dot }} />
              Pendente: {totais.PENDENTE}
            </div>
            <div style={styles.pill}>
              <span style={{ ...styles.pillDot, background: statusToColor("EM_EXECUCAO").dot }} />
              Em execução: {totais.EM_EXECUCAO}
            </div>
            <div style={styles.pill}>
              <span style={{ ...styles.pillDot, background: statusToColor("PAUSADA").dot }} />
              Pausadas: {totais.PAUSADA}
            </div>
            <div style={styles.pill}>
              <span style={{ ...styles.pillDot, background: statusToColor("FINALIZADA").dot }} />
              Finalizadas: {totais.FINALIZADA}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.statusResumoRow}>
        <div style={styles.resumoCard}>
          <div style={styles.resumoLabel}>Atraso leve</div>
          <div style={styles.resumoValue}>{totais.ATRASO_LEVE}</div>
        </div>
        <div style={styles.resumoCard}>
          <div style={styles.resumoLabel}>Atraso crítico</div>
          <div style={styles.resumoValue}>{totais.ATRASO_CRITICO}</div>
        </div>
      </div>

      {erro && (
        <div style={{ padding: 10, borderRadius: 12, background: "rgba(220,38,38,0.15)", color: "#fecaca", fontSize: 13 }}>
          {erro}
        </div>
      )}

      {carregando && <div style={{ fontSize: 13, color: theme.colors.textMuted }}>Carregando execuções ao vivo...</div>}

      <div style={styles.grid}>
        {linhasFiltradas.map((e) => {
          const status = e.status as StatusExec;
          const cores = statusToColor(status);

          const titulo = e.rotina?.titulo ?? `Rotina ${e.rotina_id}`;

          const nomePessoa =
            e.executor?.nome ?? (status === "PENDENTE" ? e.rotina?.responsavel?.nome ?? null : null) ?? "—";

          const labelPessoa = e.executor?.nome
            ? "Executor"
            : status === "PENDENTE"
              ? e.rotina?.responsavel?.nome
                ? "Responsável"
                : "Executor"
              : "Executor";

          const localTxt = (() => {
            const dep = e.rotina?.departamento_id ? `Dep ${e.rotina.departamento_id}` : null;
            const set = e.rotina?.setor_id ? `Setor ${e.rotina.setor_id}` : null;

            const regNome =
              e.rotina?.regional?.nome ?? (e.rotina?.regional_id != null ? `Regional ${e.rotina.regional_id}` : null);

            const reg = regNome ? `Reg ${regNome}` : null;

            const parts = [dep, set, reg].filter(Boolean);
            return parts.length ? parts.join(" • ") : "Local não informado";
          })();

          return (
            <div key={String(e.id)} style={styles.card}>
              <div style={styles.cardHeaderRow}>
                <div>
                  <div style={styles.rotinaTitulo}>{titulo}</div>
                  <div style={styles.rotinaLocal}>{localTxt}</div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ ...styles.badgeStatus, background: cores.bg }}>
                    <span style={{ ...styles.pillDot, background: cores.dot }} />
                    {statusToLabel(status)}
                  </div>

                  {/* ✅ mostra tempo atual real (não só o salvo) */}
                  <div style={styles.tempoTxt}>{formatSeconds((e as any).tempoAtualSeg ?? e.duracao_total_segundos)}</div>
                </div>
              </div>

              <div style={styles.executorTxt}>
                {labelPessoa}: {nomePessoa}
                {e.executor?.nivel ? ` • ${e.executor.nivel}` : ""}
              </div>

              <div style={styles.footer}>
                <span>ID Execução: {String(e.id)}</span>
                <span>
                  Início:{" "}
                  {e.inicio_em
                    ? new Date(e.inicio_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                    : "— não iniciado"}
                </span>
              </div>
            </div>
          );
        })}

        {!carregando && linhasFiltradas.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              fontSize: 13,
              color: theme.colors.textMuted,
              padding: 12,
              borderRadius: 12,
              border: `1px dashed ${theme.colors.borderSoft}`,
            }}
          >
            Nenhuma execução encontrada para HOJE.
          </div>
        )}
      </div>
    </div>
  );
}

export default ExecucaoAoVivoBoard2;
