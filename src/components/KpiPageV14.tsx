// src/components/KpiPageV14.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Usuario } from "../types";
import { theme } from "../styles";

type Props = {
  perfil: Usuario;
};

type Periodo = "HOJE" | "7D" | "30D";

type Rotina = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string; // "avulsa" | "normal"
  periodicidade: string; // "diaria" | "semanal" | "mensal" | ...
  data_inicio: string; // YYYY-MM-DD
  dia_semana: string | null; // 1..7 (dom..sab) como string
  horario_inicio: string | null; // "HH:MM"
  duracao_minutos: number | null;
  urgencia: string | null;
  responsavel_id: string;
  departamento_id: number | null;
  setor_id: number | null;
  regional_id: number | null;
  tem_checklist: boolean;
  tem_anexo: boolean;
};

type Execucao = {
  id: number;
  rotina_id: string;
  executor_id: string;
  created_at: string; // timestamptz
  inicio_em: string | null;
  pausado_em: string | null;
  finalizado_em: string | null;
  duracao_total_segundos?: number | null;
  departamento_id?: number | null;
  setor_id?: number | null;
  regional_id?: number | null;
};

type KpiResumo = {
  periodo: Periodo;

  planejadas: number; // ocorrências planejadas no período
  finalizadas: number; // execuções finalizadas no período (por dia)
  emExecucao: number;
  pausadas: number;

  pendentes: number; // planejadas - (finalizadas + emExecucao + pausadas) com clamp >=0

  tempoPlanejadoSeg: number; // soma de duracao_minutos (ou 30) * ocorrências
  tempoExecutadoSeg: number; // soma somente das finalizadas (duracao_total_segundos OU diff timestamps)

  taxaExecucaoPct: number | null;
};

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textMuted ?? "#9ca3af",
    marginTop: 2,
  },
  chips: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  chipBtn: {
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
    background: "transparent",
    color: theme.colors.textSoft ?? "#e5e7eb",
    fontSize: 11,
    cursor: "pointer",
  },
  chipBtnActive: {
    border: `1px solid ${theme.colors.neonGreen ?? "#22c55e"}`,
    background: "rgba(34,197,94,0.10)",
    color: theme.colors.neonGreen ?? "#22c55e",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
    gap: 10,
  },
  card: {
    gridColumn: "span 6",
    borderRadius: 16,
    border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
    background: "rgba(15,23,42,0.96)",
    padding: 12,
    minHeight: 92,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  cardSmall: {
    gridColumn: "span 3",
  },
  cardTitle: {
    fontSize: 12,
    color: theme.colors.textMuted ?? "#9ca3af",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: 900,
  },
  cardAux: {
    fontSize: 11,
    color: theme.colors.textSoft ?? "#e5e7eb",
  },
  barWrap: {
    marginTop: 6,
    height: 10,
    borderRadius: 999,
    background: "rgba(148,163,184,0.14)",
    overflow: "hidden",
    border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    background: theme.colors.neonGreen ?? "#22c55e",
    width: "0%",
  },
  warn: {
    borderRadius: 12,
    padding: 10,
    background: "rgba(220,38,38,0.14)",
    border: "1px solid rgba(220,38,38,0.35)",
    color: "#fecaca",
    fontSize: 12,
  },
  info: {
    fontSize: 12,
    color: theme.colors.textMuted ?? "#9ca3af",
  },
  table: {
    gridColumn: "span 12",
    borderRadius: 16,
    border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
    overflow: "hidden",
    background: "rgba(15,23,42,0.96)",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 120px 120px 120px",
    gap: 8,
    padding: "8px 12px",
    fontSize: 11,
    color: theme.colors.textMuted ?? "#9ca3af",
    borderBottom: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
    background: "rgba(2,6,23,0.35)",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 120px 120px 120px",
    gap: 8,
    padding: "8px 12px",
    fontSize: 12,
    borderBottom: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
  },
  tableRight: {
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
};

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayLocalYMD() {
  return ymdLocal(new Date());
}

function addDaysYMD(dateISO: string, delta: number) {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return ymdLocal(d);
}

function weekday_1_7(dateISO: string): string {
  // JS: 0..6 (dom..sab) -> 1..7
  const d = new Date(`${dateISO}T00:00:00`);
  const js = d.getDay();
  return String(js === 0 ? 1 : js + 1);
}

function dayOfMonth(dateISO: string): number {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.getDate();
}

function startOfDayLocalToUTC(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toISOString();
}

function endOfDayLocalToUTCExclusive(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatSeconds(total: number): string {
  const t = Math.max(0, Math.floor(total));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Expansão de recorrência em memória (por dia)
 * - avulsa: só no dia data_inicio
 * - diaria: desde data_inicio em diante
 * - semanal: desde data_inicio em diante E dia_semana bate
 * - mensal: desde data_inicio em diante E dia do mês bate (dia do data_inicio)
 * - fallback: data_inicio exata
 */
function buildAgendaDoDia(rotinasBase: Rotina[], dateISO: string) {
  const domAlvo = dayOfMonth(dateISO);
  const dow = weekday_1_7(dateISO);

  return rotinasBase.filter((r) => {
    if (r.tipo === "avulsa") return r.data_inicio === dateISO;

    const p = (r.periodicidade ?? "").toLowerCase();
    if (!r.data_inicio) return false;

    if (p === "diaria") return r.data_inicio <= dateISO;

    if (p === "semanal") {
      return r.data_inicio <= dateISO && String(r.dia_semana ?? "") === dow;
    }

    if (p === "mensal") {
      if (r.data_inicio > dateISO) return false;
      return dayOfMonth(r.data_inicio) === domAlvo;
    }

    return r.data_inicio === dateISO;
  });
}

function calcDuracaoExecSeg(ex: Execucao): number | null {
  if (!ex.finalizado_em) return null; // ✅ só conta se finalizou
  if (typeof ex.duracao_total_segundos === "number" && ex.duracao_total_segundos >= 0) return ex.duracao_total_segundos;

  if (ex.inicio_em) {
    const a = new Date(ex.inicio_em).getTime();
    const b = new Date(ex.finalizado_em).getTime();
    const diff = Math.floor((b - a) / 1000);
    if (Number.isFinite(diff) && diff >= 0) return diff;
  }
  return null;
}

function labelEscopo(perfil: Usuario) {
  if (perfil.nivel === "N1") return "N1 • Nacional (setor/departamento)";
  if (perfil.nivel === "N2") return `N2 • Regional ${perfil.regional_id ?? "—"} (setor/departamento)`;
  return "N3 • Individual (somente suas rotinas)";
}

export const KpiPageV14: React.FC<Props> = ({ perfil }) => {
  const [periodo, setPeriodo] = useState<Periodo>("30D");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [resumo, setResumo] = useState<KpiResumo | null>(null);

  const [detalheDias, setDetalheDias] = useState<
    { dia: string; planejadas: number; finalizadas: number; tempoPlanSeg: number; tempoExecSeg: number }[]
  >([]);

  const range = useMemo(() => {
    const hoje = todayLocalYMD();
    const ini = periodo === "HOJE" ? hoje : periodo === "7D" ? addDaysYMD(hoje, -6) : addDaysYMD(hoje, -29);
    const fim = hoje;
    return { ini, fim };
  }, [periodo]);

  const carregar = async () => {
    setLoading(true);
    setErro(null);

    try {
      // 1) Buscar rotinas (base) conforme escopo do perfil
      let rq = supabase
        .from("rotinas")
        .select(
          `
          id, titulo, descricao, tipo, periodicidade,
          data_inicio, dia_semana, horario_inicio, duracao_minutos,
          urgencia, responsavel_id, departamento_id, setor_id, regional_id,
          tem_checklist, tem_anexo
        `
        );

      // ✅ Sempre filtra pelo que define o “universo” do perfil
      if (perfil.departamento_id) rq = rq.eq("departamento_id", perfil.departamento_id);
      if (perfil.setor_id) rq = rq.eq("setor_id", perfil.setor_id);

      if (perfil.nivel === "N2" && perfil.regional_id) {
        rq = rq.eq("regional_id", perfil.regional_id);
      }

      if (perfil.nivel === "N3") {
        rq = rq.eq("responsavel_id", perfil.id);
      }

      // Pra não trazer lixo muito antigo: traz rotinas iniciadas até o fim do período
      rq = rq.lte("data_inicio", range.fim);

      const { data: rotData, error: rotErr } = await rq;
      if (rotErr) throw rotErr;

      const rotinasBase = (rotData ?? []) as Rotina[];

      // 2) Montar dias do período e expandir “planejado” por dia
      const dias: string[] = [];
      const totalDias = periodo === "HOJE" ? 1 : periodo === "7D" ? 7 : 30;

      for (let i = 0; i < totalDias; i++) {
        // do início até fim
        dias.push(addDaysYMD(range.ini, i));
      }

      const plannedByDay = new Map<string, Rotina[]>();
      for (const d of dias) {
        plannedByDay.set(d, buildAgendaDoDia(rotinasBase, d));
      }

      // 3) Buscar execuções no intervalo (created_at entre ini e fim+1)
      let eq = supabase
        .from("rotina_execucoes")
        .select(
          "id,rotina_id,executor_id,created_at,inicio_em,pausado_em,finalizado_em,duracao_total_segundos,departamento_id,setor_id,regional_id"
        )
        .gte("created_at", startOfDayLocalToUTC(range.ini))
        .lt("created_at", endOfDayLocalToUTCExclusive(range.fim))
        .order("id", { ascending: false });

      // mesmo escopo das rotinas:
      if (perfil.departamento_id) eq = eq.eq("departamento_id", perfil.departamento_id);
      if (perfil.setor_id) eq = eq.eq("setor_id", perfil.setor_id);

      if (perfil.nivel === "N2" && perfil.regional_id) {
        eq = eq.eq("regional_id", perfil.regional_id);
      }

      if (perfil.nivel === "N3") {
        // N3: só as execuções dele (executor_id)
        eq = eq.eq("executor_id", perfil.id);
      }

      const { data: exData, error: exErr } = await eq;
      if (exErr) throw exErr;

      const execucoes = (exData ?? []) as Execucao[];

      // 4) Indexar execuções por (rotina_id + diaLocal)
      // regra: pega a mais recente por dia (igual você já faz na agenda)
      const execMap = new Map<string, Execucao>();
      for (const ex of execucoes) {
        const diaLocal = ymdLocal(new Date(ex.created_at));
        const key = `${ex.rotina_id}::${diaLocal}`;
        if (!execMap.has(key)) execMap.set(key, ex);
      }

      // 5) Consolidar KPIs
      let planejadas = 0;
      let tempoPlanejadoSeg = 0;

      let finalizadas = 0;
      let emExecucao = 0;
      let pausadas = 0;
      let tempoExecutadoSeg = 0;

      const detalhe: { dia: string; planejadas: number; finalizadas: number; tempoPlanSeg: number; tempoExecSeg: number }[] = [];

      for (const d of dias) {
        const rotDia = plannedByDay.get(d) ?? [];

        let planejadasDia = 0;
        let tempoPlanDia = 0;
        let finalizadasDia = 0;
        let tempoExecDia = 0;

        for (const r of rotDia) {
          planejadasDia++;
          const durMin = r.duracao_minutos == null ? 30 : r.duracao_minutos; // ✅ regra definida por você
          tempoPlanDia += Math.max(1, durMin) * 60;

          const key = `${r.id}::${d}`;
          const ex = execMap.get(key);

          if (ex?.finalizado_em) {
            finalizadasDia++;
            const durEx = calcDuracaoExecSeg(ex);
            if (durEx != null) tempoExecDia += durEx;
          } else if (ex?.pausado_em && !ex.finalizado_em) {
            // status do dia
          } else if (ex?.inicio_em && !ex.finalizado_em) {
            // status do dia
          }
        }

        // status do período: contamos por execuções (map) dentro do período (melhor aproximar)
        // Aqui mantém a contagem total a partir do execMap (por ocorrência planejada),
        // mas sem depender do r (pois pode existir execução sem ocorrência).
        // Para o KPI ficar coerente: vamos contar status com base nas execuções indexadas do próprio dia.
        // (Somente se for execução de rotina que estava planejada naquele dia)
        for (const r of rotDia) {
          const ex = execMap.get(`${r.id}::${d}`);
          if (!ex) continue;
          if (ex.finalizado_em) {
            // já conta em finalizadas acima
          } else if (ex.pausado_em) {
            pausadas++;
          } else if (ex.inicio_em) {
            emExecucao++;
          }
        }

        planejadas += planejadasDia;
        tempoPlanejadoSeg += tempoPlanDia;

        finalizadas += finalizadasDia;
        tempoExecutadoSeg += tempoExecDia;

        detalhe.push({
          dia: d,
          planejadas: planejadasDia,
          finalizadas: finalizadasDia,
          tempoPlanSeg: tempoPlanDia,
          tempoExecSeg: tempoExecDia,
        });
      }

      // Ajuste status: finalizadas já está ok (por ocorrência planejada).
      // pausadas / emExecucao já acumulou por ocorrência planejada também.
      // Agora pendentes = planejadas - (finalizadas + pausadas + emExecucao)
      const pendentes = clamp(planejadas - (finalizadas + pausadas + emExecucao), 0, 999999999);

      const taxaExecucaoPct = planejadas > 0 ? Math.round((finalizadas / planejadas) * 100) : null;

      setResumo({
        periodo,
        planejadas,
        finalizadas,
        emExecucao,
        pausadas,
        pendentes,
        tempoPlanejadoSeg,
        tempoExecutadoSeg,
        taxaExecucaoPct,
      });

      setDetalheDias(detalhe);
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ? String(e.message) : "Erro ao carregar KPI.");
      setResumo(null);
      setDetalheDias([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, perfil.id, perfil.nivel, perfil.departamento_id, perfil.setor_id, perfil.regional_id]);

  const pctTempo = useMemo(() => {
    if (!resumo) return 0;
    if (resumo.tempoPlanejadoSeg <= 0) return 0;
    return clamp(Math.round((resumo.tempoExecutadoSeg / resumo.tempoPlanejadoSeg) * 100), 0, 100);
  }, [resumo]);

  const pctExec = useMemo(() => {
    if (!resumo) return 0;
    if (!resumo.taxaExecucaoPct) return 0;
    return clamp(resumo.taxaExecucaoPct, 0, 100);
  }, [resumo]);

  const tituloPeriodo = (p: Periodo) => (p === "HOJE" ? "Hoje" : p === "7D" ? "Últimos 7 dias" : "Últimos 30 dias");

  const renderChip = (p: Periodo) => {
    const active = periodo === p;
    return (
      <button
        type="button"
        onClick={() => setPeriodo(p)}
        style={{
          ...styles.chipBtn,
          ...(active ? styles.chipBtnActive : {}),
        }}
      >
        {tituloPeriodo(p)}
      </button>
    );
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.title}>KPI</div>
          <div style={styles.subtitle}>
            {labelEscopo(perfil)} • {tituloPeriodo(periodo)}
          </div>
        </div>

        <div style={styles.chips}>
          {renderChip("HOJE")}
          {renderChip("7D")}
          {renderChip("30D")}
        </div>
      </div>

      {loading && <div style={styles.info}>Carregando KPIs…</div>}
      {erro && !loading && <div style={styles.warn}>{erro}</div>}

      {!loading && !erro && resumo && (
        <>
          <div style={styles.grid}>
            {/* Planejado x Executado */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Rotinas planejadas x executadas</div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <div>
                  <div style={styles.cardValue}>{resumo.finalizadas}</div>
                  <div style={styles.cardAux}>Finalizadas</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={styles.cardValue}>{resumo.planejadas}</div>
                  <div style={styles.cardAux}>Planejadas</div>
                </div>
              </div>

              <div style={styles.barWrap}>
                <div style={{ ...styles.barFill, width: `${pctExec}%` }} />
              </div>
              <div style={styles.cardAux}>
                Taxa de execução:{" "}
                <strong style={{ color: theme.colors.neonGreen ?? "#22c55e" }}>
                  {resumo.taxaExecucaoPct == null ? "—" : `${resumo.taxaExecucaoPct}%`}
                </strong>
              </div>
            </div>

            {/* Tempo programado x executado */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Tempo programado x tempo executado</div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <div>
                  <div style={styles.cardValue}>{formatSeconds(resumo.tempoExecutadoSeg)}</div>
                  <div style={styles.cardAux}>Executado (só finalizadas)</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={styles.cardValue}>{formatSeconds(resumo.tempoPlanejadoSeg)}</div>
                  <div style={styles.cardAux}>Programado (null = 30 min)</div>
                </div>
              </div>

              <div style={styles.barWrap}>
                <div style={{ ...styles.barFill, width: `${pctTempo}%` }} />
              </div>
              <div style={styles.cardAux}>
                Cumprimento de tempo:{" "}
                <strong style={{ color: theme.colors.neonGreen ?? "#22c55e" }}>{`${pctTempo}%`}</strong>
              </div>
            </div>

            {/* Status cards (4) */}
            <div style={{ ...styles.card, ...styles.cardSmall }}>
              <div style={styles.cardTitle}>Finalizadas</div>
              <div style={styles.cardValue}>{resumo.finalizadas}</div>
              <div style={styles.cardAux}>Execuções com finalizado_em</div>
            </div>

            <div style={{ ...styles.card, ...styles.cardSmall }}>
              <div style={styles.cardTitle}>Em execução</div>
              <div style={styles.cardValue}>{resumo.emExecucao}</div>
              <div style={styles.cardAux}>inicio_em sem finalizado_em</div>
            </div>

            <div style={{ ...styles.card, ...styles.cardSmall }}>
              <div style={styles.cardTitle}>Pausadas</div>
              <div style={styles.cardValue}>{resumo.pausadas}</div>
              <div style={styles.cardAux}>pausado_em sem finalizado_em</div>
            </div>

            <div style={{ ...styles.card, ...styles.cardSmall }}>
              <div style={styles.cardTitle}>Pendentes</div>
              <div style={styles.cardValue}>{resumo.pendentes}</div>
              <div style={styles.cardAux}>Planejadas sem execução no dia</div>
            </div>

            {/* Detalhe por dia (tabela) */}
            <div style={styles.table}>
              <div style={styles.tableHeader}>
                <div>Dia</div>
                <div style={styles.tableRight}>Planejadas</div>
                <div style={styles.tableRight}>Finalizadas</div>
                <div style={styles.tableRight}>Tempo Exec.</div>
              </div>

              {detalheDias.map((d, idx) => {
                const date = new Date(`${d.dia}T00:00:00`);
                const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                return (
                  <div
                    key={d.dia}
                    style={{
                      ...styles.tableRow,
                      background: idx % 2 === 0 ? "rgba(2,6,23,0.20)" : "rgba(2,6,23,0.10)",
                    }}
                  >
                    <div>{label}</div>
                    <div style={styles.tableRight}>{d.planejadas}</div>
                    <div style={styles.tableRight}>{d.finalizadas}</div>
                    <div style={styles.tableRight}>{formatSeconds(d.tempoExecSeg)}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ gridColumn: "span 12", fontSize: 11, color: theme.colors.textMuted ?? "#9ca3af" }}>
              Observações: Tempo executado só conta quando <strong>finalizado_em</strong> existe. Tempo programado usa{" "}
              <strong>duracao_minutos</strong> e quando estiver null assume <strong>30 minutos</strong>.
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default KpiPageV14;
